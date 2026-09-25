/**
 * The news repository's SQL, against a real Postgres. Applies EVERY migration in order.
 *
 * Skipped unless TEST_DATABASE_URL is set. Uses its OWN database, `<db>_news`, because
 * every integration test drops and recreates `politics` and vitest runs files in
 * parallel (see server/testing/migrations.ts):
 *
 *   docker run -d --name glas-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
 *   npx vitest run server/news/repository.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const url = testDatabaseUrl('news');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

const HOUR = 3_600_000;

run('news repository against Postgres', () => {
  let repo: typeof import('./repository');
  let dbmod: typeof import('../db');
  let sources: typeof import('./sources');
  let sourceIds: Map<string, number>;

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    const applied = await applyAllMigrations(dbmod.pool);
    expect(applied.length).toBeGreaterThanOrEqual(3);
    repo = await import('./repository');
    sources = await import('./sources');
  }, 60_000);

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  beforeEach(async () => {
    await dbmod.pool.query('truncate politics.news_articles, politics.article_td_scores restart identity cascade');
    sourceIds = await repo.syncSources(sources.NEWS_SOURCES);
  });

  const row = (url: string, hoursAgo: number, title = url) => ({
    sourceId: sourceIds.get('rte')!,
    url,
    title,
    summary: null,
    content: 'body',
    imageUrl: null,
    publishedAt: new Date(Date.now() - hoursAgo * HOUR),
  });

  it('syncSources is idempotent and disables a source dropped from the code', async () => {
    const again = await repo.syncSources(sources.NEWS_SOURCES);
    expect([...again.entries()]).toEqual([...sourceIds.entries()]);
    await repo.syncSources(sources.NEWS_SOURCES.filter((s) => s.slug !== 'gript'));
    const { rows } = await dbmod.pool.query(`select slug, enabled from politics.news_sources where slug in ('gript','rte') order by slug`);
    expect(rows).toEqual([
      { slug: 'gript', enabled: false },
      { slug: 'rte', enabled: true },
    ]);
  });

  it('re-inserting a URL leaves the stored row exactly as it was (#23: /save reset scoring state)', async () => {
    const [id] = await repo.insertArticles([row('https://rte.ie/a', 1)]);
    await repo.markOutcome(id, { status: 'scored', importanceScore: 70, importanceReasoning: 'r', skipReason: null, errorMessage: null });
    expect(await repo.insertArticles([{ ...row('https://rte.ie/a', 1), title: 'changed' }])).toEqual([]);
    const { rows } = await dbmod.pool.query('select status, title, importance_score from politics.news_articles');
    expect(rows).toEqual([{ status: 'scored', title: 'https://rte.ie/a', importance_score: 70 }]);
  });

  it('a claim made while another run still holds its rows gets the OTHER rows, without waiting (#38)', async () => {
    await repo.insertArticles(Array.from({ length: 30 }, (_, i) => row(`https://rte.ie/${i}`, i / 10)));
    const timeout = <T>(p: Promise<T>) =>
      Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('second claim blocked on the first')), 3000))]);

    let first: Awaited<ReturnType<typeof repo.claimForScoring>> = [];
    let second: typeof first = [];
    // Run 1 claims inside an open transaction, so its row locks are still held while run 2 claims.
    await dbmod.db.transaction(async (tx) => {
      first = await repo.claimForScoring(20, tx as unknown as typeof dbmod.db);
      second = await timeout(repo.claimForScoring(20));
    });

    expect(first).toHaveLength(20);
    expect(second).toHaveLength(10);
    const ids = [...first, ...second].map((x) => x.id);
    expect(new Set(ids).size).toBe(30);
    expect(await repo.claimForScoring(20)).toEqual([]);
    expect((await repo.statusCounts()).claimed).toBe(30);
  });

  it('claims newest first and carries source name and credibility', async () => {
    await repo.insertArticles([row('https://rte.ie/old', 5), row('https://rte.ie/new', 1)]);
    const [first] = await repo.claimForScoring(1);
    expect(first).toMatchObject({ url: 'https://rte.ie/new', sourceName: 'RTÉ News', credibility: expect.closeTo(0.95, 5) });
  });

  it('skips articles older than the scoring window instead of claiming them', async () => {
    await repo.insertArticles([row('https://rte.ie/stale', 24 * 8), row('https://rte.ie/fresh', 1)]);
    const claimed = await repo.claimForScoring(10);
    expect(claimed.map((c) => c.url)).toEqual(['https://rte.ie/fresh']);
    const { rows } = await dbmod.pool.query(`select status from politics.news_articles where url = 'https://rte.ie/stale'`);
    expect(rows[0].status).toBe('skipped');
  });

  it('re-claims an expired lease, and fails a row whose lease expired MAX_ATTEMPTS times', async () => {
    const [id] = await repo.insertArticles([row('https://rte.ie/poison', 1)]);
    for (let attempt = 1; attempt <= repo.MAX_ATTEMPTS; attempt++) {
      expect((await repo.claimForScoring(1)).map((c) => c.id)).toEqual([id]);
      // A live lease is never taken twice.
      expect(await repo.claimForScoring(1)).toEqual([]);
      await dbmod.pool.query(`update politics.news_articles set claimed_at = now() - interval '${repo.CLAIM_LEASE_HOURS + 1} hours'`);
    }
    expect(await repo.claimForScoring(1)).toEqual([]);
    const { rows } = await dbmod.pool.query('select status, attempts from politics.news_articles');
    expect(rows).toEqual([{ status: 'failed', attempts: repo.MAX_ATTEMPTS }]);
  });

  it('feed pages by offset, reports the real total, and ranks scored articles first', async () => {
    const ids = await repo.insertArticles(Array.from({ length: 12 }, (_, i) => row(`https://rte.ie/${i}`, i)));
    const { rows: [td] } = await dbmod.pool.query(`insert into politics.tds (name, party) values ('Mary Lou McDonald', 'Sinn Féin') returning id`);
    // The OLDEST article carries the strongest verdict.
    await dbmod.pool.query('insert into politics.article_td_scores (article_id, td_id, impact, story_type, sentiment) values ($1, $2, -7, $3, $4)', [ids[11], td.id, 'scandal', 'negative']);

    const window = { since: new Date(0), fallbackDays: 30 };
    const p1 = await repo.feedPage({ sort: 'score', limit: 5, offset: 0 }, window);
    const p2 = await repo.feedPage({ sort: 'score', limit: 5, offset: 5 }, window);
    expect(p1.total).toBe(12);
    expect(p1.rows[0]).toMatchObject({ id: ids[11], impact: -7, storyType: 'scandal', affectedTds: [{ name: 'Mary Lou McDonald', impactScore: -7 }] });
    expect(p1.rows.map((r) => r.id).filter((id) => p2.rows.some((r) => r.id === id))).toEqual([]);

    const recent = await repo.feedPage({ sort: 'recent', limit: 3, offset: 0 }, window);
    expect(recent.rows.map((r) => r.id)).toEqual([ids[0], ids[1], ids[2]]);

    expect((await repo.feedForTd('mary lou mcdonald', 10)).map((r) => r.id)).toEqual([ids[11]]);
    expect((await repo.searchRecent('rte.ie/3', 10)).map((r) => r.id)).toEqual([ids[3]]);
  });

  it('today falls back to the recent window when nothing was published today', async () => {
    await repo.insertArticles([row('https://rte.ie/yesterday', 30)]);
    const future = { since: new Date(Date.now() + HOUR), fallbackDays: 30 };
    const page = await repo.feedPage({ sort: 'today', limit: 5, offset: 0 }, future);
    expect(page.rows.map((r) => r.url)).toEqual(['https://rte.ie/yesterday']);
  });

  it('rows below the relevance floor are stored but never shown; unranked rows are shown', async () => {
    const { RELEVANCE_FLOOR } = await import('./relevance');
    await repo.insertArticles([
      { ...row('https://rte.ie/politics', 1), relevanceScore: 90, category: 'oireachtas', aiSummary: 'The Dáil passed it.' },
      { ...row('https://rte.ie/sport', 2), relevanceScore: RELEVANCE_FLOOR - 1, category: 'other', status: 'skipped', skipReason: 'below floor' },
      { ...row('https://rte.ie/unranked', 3), relevanceScore: null },
    ]);
    const window = { since: new Date(0), fallbackDays: 30 };
    const feed = await repo.feedPage({ sort: 'recent', limit: 10, offset: 0 }, window);
    expect(feed.rows.map((r) => r.url)).toEqual(['https://rte.ie/politics', 'https://rte.ie/unranked']);
    expect(feed.total).toBe(2);
    expect(feed.rows[0]).toMatchObject({ category: 'oireachtas', aiSummary: 'The Dáil passed it.' });
    expect((await repo.searchRecent('sport', 10)).map((r) => r.url)).toEqual([]);
    // The hidden row still blocks a re-insert, so its URL is never ranked (paid for) twice.
    expect(await repo.existingUrls(['https://rte.ie/sport'])).toEqual(new Set(['https://rte.ie/sport']));
  });

  it('a same-event duplicate is hidden from the feed; its canonical article stays', async () => {
    const [canonical, duplicate] = await repo.insertArticles([row('https://rte.ie/budget', 1), row('https://irishtimes.com/budget', 2)]);
    await repo.markOutcome(duplicate, { status: 'duplicate', importanceScore: 80, importanceReasoning: 'r', skipReason: `Duplicate of article ${canonical}`, errorMessage: null });
    const feed = await repo.feedPage({ sort: 'recent', limit: 10, offset: 0 }, { since: new Date(0), fallbackDays: 30 });
    expect(feed.rows.map((r) => r.id)).toEqual([canonical]);
    expect(feed.total).toBe(1);
    expect((await repo.statusCounts()).duplicate).toBe(1);
  });

  it('missingImages lists visible picture-less rows; setImageIfMissing never overwrites', async () => {
    const [bare, pictured, hidden] = await repo.insertArticles([
      row('https://rte.ie/bare', 1),
      { ...row('https://rte.ie/pictured', 1), imageUrl: 'https://img/1.jpg' },
      { ...row('https://rte.ie/hidden', 1), relevanceScore: 10 },
    ]);
    expect((await repo.missingImages(48, 10)).map((r) => r.id)).toEqual([bare]);
    await repo.setImageIfMissing(bare, 'https://img/new.jpg');
    await repo.setImageIfMissing(pictured, 'https://img/other.jpg');
    const { rows } = await dbmod.pool.query('select id, image_url from politics.news_articles where id = any($1) order by id', [[bare, pictured, hidden]]);
    expect(rows.map((r: { image_url: string | null }) => r.image_url)).toEqual(['https://img/new.jpg', 'https://img/1.jpg', null]);
    expect(await repo.missingImages(48, 10)).toEqual([]);
  });
});
