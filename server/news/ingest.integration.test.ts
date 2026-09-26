/**
 * Ingest end to end against a real Postgres: feeds, relevance and event matching are mocked,
 * everything from dedupe to the stored rows, the feed and the scoring claim is real.
 *
 * Skipped unless TEST_DATABASE_URL is set. Uses its OWN database, `<db>_ingest`, because
 * every integration test drops and recreates `politics` and vitest runs files in parallel
 * (see server/testing/migrations.ts):
 *
 *   docker run -d --name glas-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
 *   npx vitest run server/news/ingest.integration.test.ts
 */
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';
import type { PageMeta } from './content';
import type { RawItem } from './normalize';

const url = testDatabaseUrl('ingest');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
  process.env.LOG_LEVEL = 'silent';
}

const HOUR = 3_600_000;
const EMPTY_PAGE: PageMeta = { title: null, summary: null, imageUrl: null, imageWidth: null, publishedAt: null, body: '' };

const state = vi.hoisted(() => ({
  feeds: new Map<string, RawItem[]>(),
  feedCalls: 0,
  page: null as PageMeta | null,
  /** Answers each news.events call from its prompt; an Error makes the call throw. */
  events: null as ((prompt: string) => object) | Error | null,
  eventPrompts: [] as string[],
}));

vi.mock('./rss', () => ({
  fetchFeed: vi.fn(async (slug: string) => {
    state.feedCalls++;
    return state.feeds.get(slug) ?? [];
  }),
}));
vi.mock('./content', () => ({ fetchPage: vi.fn(async () => state.page) }));
vi.mock('./images', async (importOriginal) => ({ ...(await importOriginal<typeof import('./images')>()), firstLoading: vi.fn(async () => null) }));
vi.mock('../auth', () => ({ requireJob: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('../services/aiService', () => ({
  isLLMConfigured: () => true,
  callChatCompletion: vi.fn(async (params: { messages: Array<{ content: string }> }, options: { operation: string }) => {
    const prompt = params.messages[1].content;
    let reply: object;
    if (options.operation === 'news.relevance') {
      // One line per item: [i] (source) "title" — standfirst
      reply = { items: prompt.split('\n').map((line, i) => ({ i, relevance: 90, category: 'oireachtas', summary: `Summary of ${/"(.*)"/.exec(line)![1]}.` })) };
    } else if (options.operation === 'news.events') {
      state.eventPrompts.push(prompt);
      if (state.events instanceof Error) throw state.events;
      reply = state.events ? state.events(prompt) : { items: [] };
    } else {
      throw new Error(`unexpected LLM operation ${options.operation}`);
    }
    return { choices: [{ message: { content: JSON.stringify(reply) } }] };
  }),
}));

const item = (sourceSlug: string, link: string, title: string, published: Date): RawItem => ({
  sourceSlug,
  link,
  title,
  published: published.toISOString(),
  snippet: 'A standfirst long enough to keep.',
  bodyHtml: undefined,
  images: [],
});

/** The id of the first candidate in a news.events prompt. */
const firstCandidate = (prompt: string) => Number(/\[#(\d+)\]/.exec(prompt)![1]);

run('ingest against Postgres', () => {
  let dbmod: typeof import('../db');
  let ingest: typeof import('./ingest');
  let repo: typeof import('./repository');
  let server: Server;
  let base: string;

  const rows = async () =>
    (await dbmod.pool.query('select id, url, status, duplicate_of from politics.news_articles order by id')).rows as Array<{
      id: number;
      url: string;
      status: string;
      duplicate_of: number | null;
    }>;

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    ingest = await import('./ingest');
    repo = await import('./repository');

    const app = express();
    app.use(express.json());
    app.use('/api/admin/news', (await import('../routes/admin/news')).default);
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/admin/news`;
  }, 60_000);

  afterAll(async () => {
    await new Promise((resolve) => server?.close(resolve));
    if (dbmod) await dbmod.shutdown();
  });

  beforeEach(async () => {
    await dbmod.pool.query('truncate politics.news_articles, politics.article_tds restart identity cascade');
    state.feeds.clear();
    state.feedCalls = 0;
    state.page = EMPTY_PAGE;
    state.events = null;
    state.eventPrompts = [];
  });

  it('a report from another outlet 47h after the first is stored as its duplicate, never shown or claimed', async () => {
    const now = new Date();
    const earlier = new Date(now.getTime() - 47 * HOUR);
    const rte = item('rte', 'https://www.rte.ie/news/budget-vote', 'Dáil passes Budget 2027 after late-night vote', new Date(earlier.getTime() - HOUR / 3));
    state.feeds.set('rte', [rte]);
    const first = await ingest.ingest(earlier);
    expect(first).toMatchObject({ inserted: 1, duplicates: 0, eventMatchFailed: 0 });
    // One item and nothing stored to compare it with: no call.
    expect(state.eventPrompts).toEqual([]);

    state.feeds.set('the-journal', [item('the-journal', 'https://www.thejournal.ie/budget-division', 'TDs back budget package in overnight division', new Date(now.getTime() - HOUR / 3))]);
    state.events = (prompt) => ({ items: [{ i: 0, event: firstCandidate(prompt), same_as: null }] });
    const second = await ingest.ingest(now);
    expect(second).toMatchObject({ knownUrls: 1, inserted: 1, duplicates: 1, eventMatchFailed: 0 });
    // The candidate is sent with its AI summary.
    expect(state.eventPrompts[0]).toContain('"Dáil passes Budget 2027 after late-night vote" — Summary of Dáil passes Budget 2027 after late-night vote.');

    const [canonical, copy] = await rows();
    expect(canonical).toMatchObject({ url: 'https://www.rte.ie/news/budget-vote', status: 'pending', duplicate_of: null });
    expect(copy).toMatchObject({ url: 'https://www.thejournal.ie/budget-division', status: 'duplicate', duplicate_of: canonical.id });

    const feed = await repo.feedPage({ sort: 'recent', limit: 10, offset: 0 }, { since: new Date(0), fallbackDays: 30 });
    expect(feed.rows.map((r) => ({ id: r.id, alsoReportedBy: r.alsoReportedBy }))).toEqual([
      { id: canonical.id, alsoReportedBy: [{ source: 'The Journal', url: 'https://www.thejournal.ie/budget-division' }] },
    ]);
    expect((await repo.claimForPipeline(10)).map((a) => a.id)).toEqual([canonical.id]);

    // A near-copy of the DUPLICATE's headline links to the root, without an event call.
    state.feeds.set('irish-examiner', [item('irish-examiner', 'https://www.irishexaminer.com/budget', 'TDs back budget package in an overnight division', now)]);
    state.eventPrompts = [];
    await ingest.ingest(now);
    expect((await rows())[2]).toMatchObject({ url: 'https://www.irishexaminer.com/budget', status: 'duplicate', duplicate_of: canonical.id });
    expect(state.eventPrompts).toEqual([]);
  });

  it('two outlets in one run: the earlier published is the canonical, even when its feed comes second', async () => {
    const now = new Date();
    // `rte` is fetched before `the-journal`, so the later report is first in the run.
    state.feeds.set('rte', [item('rte', 'https://www.rte.ie/news/later', 'Minister confirms hospital funding', new Date(now.getTime() - HOUR))]);
    state.feeds.set('the-journal', [item('the-journal', 'https://www.thejournal.ie/earlier', 'Cabinet signs off new hospital money', new Date(now.getTime() - 2 * HOUR))]);
    state.events = () => ({ items: [{ i: 0, event: null, same_as: null }, { i: 1, event: null, same_as: 0 }] });
    expect(await ingest.ingest(now)).toMatchObject({ inserted: 2, duplicates: 1 });
    // New items reach the model oldest first.
    expect(state.eventPrompts[0]).toMatch(/\[0\] "Cabinet signs off new hospital money"[\s\S]*\[1\] "Minister confirms hospital funding"/);
    const all = await rows();
    const earlier = all.find((r) => r.url === 'https://www.thejournal.ie/earlier')!;
    expect(earlier).toMatchObject({ status: 'pending', duplicate_of: null });
    expect(all.find((r) => r.url === 'https://www.rte.ie/news/later')).toMatchObject({ status: 'duplicate', duplicate_of: earlier.id });
  });

  it('fails open: when the event call throws, every item is its own canonical', async () => {
    const now = new Date();
    state.feeds.set('rte', [item('rte', 'https://www.rte.ie/news/a', 'Minister confirms hospital funding', new Date(now.getTime() - HOUR))]);
    state.feeds.set('the-journal', [item('the-journal', 'https://www.thejournal.ie/b', 'Cabinet signs off new hospital money', new Date(now.getTime() - 2 * HOUR))]);
    state.events = new Error('provider down');
    expect(await ingest.ingest(now)).toMatchObject({ inserted: 2, duplicates: 0, eventMatchFailed: 1 });
    expect((await rows()).map((r) => [r.status, r.duplicate_of])).toEqual([
      ['pending', null],
      ['pending', null],
    ]);
  });

  it('runs one ingest at a time: a second call joins the run in flight', async () => {
    const [a, b] = await Promise.all([ingest.ingest(), ingest.ingest()]);
    expect(a).toBe(b);
    const { NEWS_SOURCES } = await import('./sources');
    expect(state.feedCalls).toBe(NEWS_SOURCES.filter((s) => s.feedUrl).length);
  });

  it('a manual add of an event already shown is a 409 naming it; with force it is stored as a canonical', async () => {
    const { NEWS_SOURCES } = await import('./sources');
    const sourceIds = await repo.syncSources(NEWS_SOURCES);
    const [{ id: shown }] = await repo.insertArticles([
      { sourceId: sourceIds.get('rte')!, url: 'https://www.rte.ie/news/budget', title: 'Dáil passes budget', publishedAt: new Date(Date.now() - HOUR) },
    ]);
    state.page = { ...EMPTY_PAGE, title: 'TDs back the budget', body: 'Body text.' };
    state.events = (prompt) => ({ items: [{ i: 0, event: firstCandidate(prompt) }] });
    const post = (body: object) => fetch(`${base}/articles`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

    const refused = await post({ url: 'https://www.thejournal.ie/budget' });
    expect(refused.status).toBe(409);
    expect((await refused.json()).error.message).toBe(`Same event as article #${shown}`);
    expect(await rows()).toHaveLength(1);

    const forced = await post({ url: 'https://www.thejournal.ie/budget', force: true });
    expect(forced.status).toBe(201);
    const { id } = (await forced.json()).data;
    expect((await rows()).find((r) => r.id === id)).toMatchObject({ status: 'pending', duplicate_of: null });
  });
});
