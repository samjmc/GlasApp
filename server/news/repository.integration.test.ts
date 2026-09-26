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
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyAllMigrations, applyMigration, ensureDatabase, journalTags, testDatabaseUrl } from '../testing/migrations';

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
    await dbmod.pool.query('truncate politics.news_articles, politics.article_tds restart identity cascade');
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
    const [{ id }] = await repo.insertArticles([row('https://rte.ie/a', 1)]);
    await repo.markOutcome(id, { status: 'scored', importanceScore: 70, importanceReasoning: 'r', skipReason: null, errorMessage: null });
    expect(await repo.insertArticles([{ ...row('https://rte.ie/a', 1), title: 'changed' }])).toEqual([]);
    const { rows } = await dbmod.pool.query('select status, title, importance_score from politics.news_articles');
    expect(rows).toEqual([{ status: 'scored', title: 'https://rte.ie/a', importance_score: 70 }]);
  });

  it('a claim made while another run still holds its rows gets the OTHER rows, without waiting (#38)', async () => {
    await repo.insertArticles(Array.from({ length: 30 }, (_, i) => row(`https://rte.ie/${i}`, i / 10)));
    const timeout = <T>(p: Promise<T>) =>
      Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('second claim blocked on the first')), 3000))]);

    let first: Awaited<ReturnType<typeof repo.claimForPipeline>> = [];
    let second: typeof first = [];
    // Run 1 claims inside an open transaction, so its row locks are still held while run 2 claims.
    await dbmod.db.transaction(async (tx) => {
      first = await repo.claimForPipeline(20, tx as unknown as typeof dbmod.db);
      second = await timeout(repo.claimForPipeline(20));
    });

    expect(first).toHaveLength(20);
    expect(second).toHaveLength(10);
    const ids = [...first, ...second].map((x) => x.id);
    expect(new Set(ids).size).toBe(30);
    expect(await repo.claimForPipeline(20)).toEqual([]);
    expect((await repo.statusCounts()).claimed).toBe(30);
  });

  it('claims newest first and carries the source name', async () => {
    await repo.insertArticles([row('https://rte.ie/old', 5), row('https://rte.ie/new', 1)]);
    const [first] = await repo.claimForPipeline(1);
    expect(first).toMatchObject({ url: 'https://rte.ie/new', sourceName: 'RTÉ News' });
    expect(first).not.toHaveProperty('credibility');
  });

  it('linkArticleTd is idempotent on (article, td), and feedForTd finds the article by it', async () => {
    const [{ id }] = await repo.insertArticles([row('https://rte.ie/linked', 1)]);
    const { rows: [td] } = await dbmod.pool.query(`insert into politics.tds (name) values ('Holly Cairns') returning id`);
    await repo.linkArticleTd(id, td.id);
    const { rows: [first] } = await dbmod.pool.query('select created_at from politics.article_tds');
    await repo.linkArticleTd(id, td.id);
    const { rows } = await dbmod.pool.query('select article_id, td_id, created_at from politics.article_tds');
    expect(rows).toEqual([{ article_id: id, td_id: td.id, created_at: first.created_at }]);
    expect((await repo.feedForTd('holly cairns', 10)).map((r) => r.id)).toEqual([id]);
  });

  it('skips articles older than the scoring window instead of claiming them', async () => {
    await repo.insertArticles([row('https://rte.ie/stale', 24 * 8), row('https://rte.ie/fresh', 1)]);
    const claimed = await repo.claimForPipeline(10);
    expect(claimed.map((c) => c.url)).toEqual(['https://rte.ie/fresh']);
    const { rows } = await dbmod.pool.query(`select status from politics.news_articles where url = 'https://rte.ie/stale'`);
    expect(rows[0].status).toBe('skipped');
  });

  it('re-claims an expired lease, and fails a row whose lease expired MAX_ATTEMPTS times', async () => {
    const [{ id }] = await repo.insertArticles([row('https://rte.ie/poison', 1)]);
    for (let attempt = 1; attempt <= repo.MAX_ATTEMPTS; attempt++) {
      expect((await repo.claimForPipeline(1)).map((c) => c.id)).toEqual([id]);
      // A live lease is never taken twice.
      expect(await repo.claimForPipeline(1)).toEqual([]);
      await dbmod.pool.query(`update politics.news_articles set claimed_at = now() - interval '${repo.CLAIM_LEASE_HOURS + 1} hours'`);
    }
    expect(await repo.claimForPipeline(1)).toEqual([]);
    const { rows } = await dbmod.pool.query('select status, attempts from politics.news_articles');
    expect(rows).toEqual([{ status: 'failed', attempts: repo.MAX_ATTEMPTS }]);
  });

  it('feed pages by offset, reports the real total, and ranks the most important articles first', async () => {
    const ids = (await repo.insertArticles(Array.from({ length: 12 }, (_, i) => row(`https://rte.ie/${i}`, i)))).map((r) => r.id);
    const { rows: [td] } = await dbmod.pool.query(`insert into politics.tds (name, party) values ('Mary Lou McDonald', 'Sinn Féin') returning id`);
    // The OLDEST article is the most important; the second oldest is next. Untriaged rows follow, newest first.
    await dbmod.pool.query('update politics.news_articles set importance_score = 90 where id = $1', [ids[11]]);
    await dbmod.pool.query('update politics.news_articles set importance_score = 60 where id = $1', [ids[10]]);
    await repo.linkArticleTd(ids[11], td.id);

    const window = { since: new Date(0), fallbackDays: 30 };
    const p1 = await repo.feedPage({ sort: 'top', limit: 5, offset: 0 }, window);
    const p2 = await repo.feedPage({ sort: 'top', limit: 5, offset: 5 }, window);
    expect(p1.total).toBe(12);
    expect(p1.rows.map((r) => r.id)).toEqual([ids[11], ids[10], ids[0], ids[1], ids[2]]);
    expect(p1.rows[0].affectedTds).toEqual([{ name: 'Mary Lou McDonald' }]);
    expect(p1.rows[1].affectedTds).toEqual([]);
    expect(p1.rows[0]).not.toHaveProperty('impact');
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

  const from = (slug: string) => ({ sourceId: sourceIds.get(slug)! });
  const dup = (of: number) => ({ status: 'duplicate' as const, duplicateOf: of });

  it('a same-event duplicate is hidden; its canonical lists the first copy from each OTHER outlet', async () => {
    const [{ id: canonical }] = await repo.insertArticles([row('https://rte.ie/budget', 5)]);
    await repo.insertArticles([
      { ...row('https://thejournal.ie/budget-2', 2), ...from('the-journal'), ...dup(canonical) },
      { ...row('https://thejournal.ie/budget-1', 3), ...from('the-journal'), ...dup(canonical) },
      // Another RTÉ feed: the same outlet, so not "also reported by".
      { ...row('https://rte.ie/politics/budget', 4), ...from('rte-politics'), ...dup(canonical) },
      { ...row('https://irishtimes.com/budget', 1), ...from('irish-times'), ...dup(canonical) },
    ]);
    const feed = await repo.feedPage({ sort: 'recent', limit: 10, offset: 0 }, { since: new Date(0), fallbackDays: 30 });
    expect(feed.rows.map((r) => r.id)).toEqual([canonical]);
    expect(feed.total).toBe(1);
    expect(feed.rows[0].alsoReportedBy).toEqual([
      { source: 'The Journal', url: 'https://thejournal.ie/budget-1' },
      { source: 'The Irish Times', url: 'https://irishtimes.com/budget' },
    ]);
    expect((await repo.statusCounts()).duplicate).toBe(4);
    expect(await repo.claimForPipeline(10)).toMatchObject([{ id: canonical }]);
  });

  it('an article with no duplicates has an empty alsoReportedBy', async () => {
    await repo.insertArticles([row('https://rte.ie/alone', 1)]);
    const feed = await repo.feedPage({ sort: 'recent', limit: 10, offset: 0 }, { since: new Date(0), fallbackDays: 30 });
    expect(feed.rows[0].alsoReportedBy).toEqual([]);
  });

  it('the check constraint ties status `duplicate` to a link, both ways', async () => {
    const [{ id }] = await repo.insertArticles([row('https://rte.ie/c', 1)]);
    await expect(repo.insertArticles([{ ...row('https://rte.ie/unlinked', 1), status: 'duplicate' }])).rejects.toThrow();
    await expect(repo.insertArticles([{ ...row('https://rte.ie/linked-pending', 1), duplicateOf: id }])).rejects.toThrow();
    await expect(
      dbmod.pool.query(`update politics.news_articles set status = 'duplicate' where id = $1`, [id]),
    ).rejects.toThrow(/news_articles_duplicate_link_chk/);
  });

  it('recentTitles gives each row its root canonical; findForPipeline resolves a duplicate to it', async () => {
    const [{ id: canonical }] = await repo.insertArticles([row('https://rte.ie/root', 2, 'Root story')]);
    const [{ id: copy }] = await repo.insertArticles([{ ...row('https://thejournal.ie/copy', 1, 'Copy story'), ...from('the-journal'), ...dup(canonical) }]);
    expect(await repo.recentTitles(48)).toEqual(
      expect.arrayContaining([
        { id: canonical, url: 'https://rte.ie/root', title: 'Root story' },
        { id: canonical, url: 'https://thejournal.ie/copy', title: 'Copy story' },
      ]),
    );
    expect((await repo.findForPipeline(copy))?.id).toBe(canonical);
    expect((await repo.findForPipeline(canonical))?.id).toBe(canonical);
    expect(await repo.findForPipeline(999_999)).toBeNull();
  });

  it('eventCandidates: visible canonicals inside the window before `now`, newest first, capped', async () => {
    const { RELEVANCE_FLOOR } = await import('./relevance');
    const [{ id: inside }, { id: newest }] = await repo.insertArticles([
      { ...row('https://rte.ie/47h', 47), aiSummary: 'The Dáil passed it.' },
      row('https://rte.ie/1h', 1),
      row('https://rte.ie/73h', 73),
      { ...row('https://rte.ie/below', 2), relevanceScore: RELEVANCE_FLOOR - 1, status: 'skipped' },
    ]);
    await repo.insertArticles([{ ...row('https://thejournal.ie/dup', 3), ...from('the-journal'), ...dup(inside) }]);
    const now = new Date();
    expect(await repo.eventCandidates(now, 72, 10)).toEqual([
      { id: newest, title: 'https://rte.ie/1h', summary: null },
      { id: inside, title: 'https://rte.ie/47h', summary: 'The Dáil passed it.' },
    ]);
    expect((await repo.eventCandidates(now, 72, 1)).map((c) => c.id)).toEqual([newest]);
  });

  it('linkableRows and linkDuplicate never touch a scored row or a row that is already a root', async () => {
    const rows = await repo.insertArticles([row('https://rte.ie/p', 3), row('https://rte.ie/scored', 2), row('https://rte.ie/root', 1), row('https://rte.ie/target', 4)]);
    const [p, scored, root, target] = rows.map((r) => r.id);
    const { rows: [td] } = await dbmod.pool.query(`insert into politics.tds (name) values ('Simon Harris') returning id`);
    await repo.linkArticleTd(scored, td.id);
    await repo.insertArticles([{ ...row('https://thejournal.ie/child', 1), ...from('the-journal'), ...dup(root) }]);

    expect((await repo.linkableRows(new Date(Date.now() - 24 * HOUR))).map((r) => r.id)).toEqual([target, p]);
    expect(await repo.linkDuplicate(scored, target)).toBe(false);
    expect(await repo.linkDuplicate(root, target)).toBe(false);
    expect(await repo.linkDuplicate(p, target)).toBe(true);
    const { rows: after } = await dbmod.pool.query('select id, status, duplicate_of from politics.news_articles where id = any($1) order by id', [[p, scored, root]]);
    expect(after).toEqual([
      { id: p, status: 'duplicate', duplicate_of: target },
      { id: scored, status: 'pending', duplicate_of: null },
      { id: root, status: 'pending', duplicate_of: null },
    ]);
  });

  it('missingImages lists visible picture-less canonicals; setImageIfMissing never overwrites', async () => {
    const [bare, pictured, hidden] = (
      await repo.insertArticles([
        row('https://rte.ie/bare', 1),
        { ...row('https://rte.ie/pictured', 1), imageUrl: 'https://img/1.jpg' },
        { ...row('https://rte.ie/hidden', 1), relevanceScore: 10 },
      ])
    ).map((r) => r.id);
    await repo.insertArticles([{ ...row('https://thejournal.ie/copy', 1), ...from('the-journal'), ...dup(bare) }]);
    expect((await repo.missingImages(48, 10)).map((r) => r.id)).toEqual([bare]);
    await repo.setImageIfMissing(bare, 'https://img/new.jpg');
    await repo.setImageIfMissing(pictured, 'https://img/other.jpg');
    const { rows } = await dbmod.pool.query('select id, image_url from politics.news_articles where id = any($1) order by id', [[bare, pictured, hidden]]);
    expect(rows.map((r: { image_url: string | null }) => r.image_url)).toEqual(['https://img/new.jpg', 'https://img/1.jpg', null]);
    expect(await repo.missingImages(48, 10)).toEqual([]);
  });

  // Near the end: it takes this table back to before 0010, then re-applies 0010.
  it('migration 0010 links each legacy duplicate it can, and makes the rest `skipped`', async () => {
    const ids = (await repo.insertArticles(['c', 'linked', 'unknown', 'chained', 'missing'].map((k, i) => row(`https://rte.ie/${k}`, i)))).map((r) => r.id);
    const [canonical, linked, unknown, chained, missing] = ids;
    await dbmod.pool.query('alter table politics.news_articles drop column duplicate_of');
    const legacy: Array<[number, string, string]> = [
      [canonical, 'scored', ''],
      [linked, 'duplicate', `Duplicate of article ${canonical} (same event: budget)`],
      [unknown, 'duplicate', 'Duplicate of article undefined (same event: unknown)'],
      [chained, 'duplicate', `Duplicate of article ${linked} (same event: budget)`],
      [missing, 'duplicate', 'Duplicate of article 999999 (same event: budget)'],
    ];
    for (const [id, status, reason] of legacy) {
      await dbmod.pool.query('update politics.news_articles set status = $2, skip_reason = $3 where id = $1', [id, status, reason || null]);
    }

    const migration = fs.readFileSync(path.resolve(__dirname, '../../drizzle/0010_news_event_duplicate_of.sql'), 'utf8');
    for (const statement of migration.split('--> statement-breakpoint')) if (statement.trim()) await dbmod.pool.query(statement);

    const { rows: after } = await dbmod.pool.query('select id, status, duplicate_of from politics.news_articles order by id');
    expect(after).toEqual([
      { id: canonical, status: 'scored', duplicate_of: null },
      { id: linked, status: 'duplicate', duplicate_of: canonical },
      { id: unknown, status: 'skipped', duplicate_of: null },
      { id: chained, status: 'skipped', duplicate_of: null },
      { id: missing, status: 'skipped', duplicate_of: null },
    ]);
  });

  // Last: it rebuilds the schema up to just before the facts-only migration, seeds the old
  // shape, then applies that migration and every one after it.
  it('the facts-only migration RENAMES article_td_scores to article_tds and keeps every link', async () => {
    const all = journalTags();
    const factsOnly = all.find((t) => t.endsWith('_facts_only_scoring'))!;
    expect(factsOnly).toBeDefined();
    await applyAllMigrations(dbmod.pool, factsOnly);

    const q = async (text: string, params: unknown[] = []) => (await dbmod.pool.query(text, params)).rows;
    const [src] = await q(`insert into politics.news_sources (slug, name, homepage_url, credibility) values ('rte', 'RTÉ News', 'https://rte.ie', 0.95) returning id`);
    const [a1, a2] = await q(
      `insert into politics.news_articles (source_id, url, title, published_at) values ($1, 'https://rte.ie/1', 'one', now()), ($1, 'https://rte.ie/2', 'two', now()) returning id`,
      [src.id],
    );
    const [mary, simon] = await q(`insert into politics.tds (name) values ('Mary Lou McDonald'), ('Simon Harris') returning id`);
    await q(
      `insert into politics.article_td_scores (article_id, td_id, impact, story_type, sentiment, reasoning, is_ideological_policy, created_at)
       values ($1, $3, -7, 'scandal', 'negative', 'x', true, '2026-09-01T10:00:00Z'), ($1, $4, 2, null, null, null, false, '2026-09-01T11:00:00Z'),
              ($2, $3, 5, 'policy', 'positive', 'y', false, '2026-09-02T10:00:00Z')`,
      [a1.id, a2.id, mary.id, simon.id],
    );
    await q(`insert into politics.td_scores (td_id, overall_elo, total_stories, overall_score) values ($1, 1600, 3, 70)`, [mary.id]);

    for (const tag of all.slice(all.indexOf(factsOnly))) await applyMigration(dbmod.pool, tag);

    // Every link survives, with its original created_at; every verdict column is gone.
    expect(await q('select * from politics.article_tds order by article_id, td_id')).toEqual([
      { article_id: a1.id, td_id: mary.id, created_at: new Date('2026-09-01T10:00:00Z') },
      { article_id: a1.id, td_id: simon.id, created_at: new Date('2026-09-01T11:00:00Z') },
      { article_id: a2.id, td_id: mary.id, created_at: new Date('2026-09-02T10:00:00Z') },
    ]);
    expect(await q(`select to_regclass('politics.article_td_scores') as t, to_regclass('politics.article_td_scores_id_seq') as s`)).toEqual([{ t: null, s: null }]);
    expect(await q(`select conname from pg_constraint where conrelid = 'politics.article_tds'::regclass order by conname`)).toEqual([
      { conname: 'article_tds_article_id_td_id_pk' },
      { conname: 'article_tds_td_id_tds_id_fk' },
    ]);
    expect(await q(`select indexname from pg_indexes where schemaname = 'politics' and tablename = 'article_tds' order by indexname`)).toEqual([
      { indexname: 'article_tds_article_id_td_id_pk' },
      { indexname: 'article_tds_td_created_idx' },
    ]);
    // The primary key is what linkArticleTd's ON CONFLICT targets.
    await repo.linkArticleTd(a1.id, mary.id);
    expect(await q('select count(*)::int as n from politics.article_tds')).toEqual([{ n: 3 }]);

    // The ELO state and news verdicts are dropped; the score row itself stays.
    expect(await q(`select to_regclass('politics.td_score_history') as h, to_regclass('politics.party_scores') as p`)).toEqual([{ h: null, p: null }]);
    expect(await q(`select * from politics.td_scores`)).toEqual([
      expect.objectContaining({ td_id: mary.id, overall_score: 70, computed_at: null }),
    ]);
    const [scoreRow] = await q('select * from politics.td_scores');
    expect(Object.keys(scoreRow).sort()).toEqual(
      ['computed_at', 'constituency_rank', 'debate_score', 'national_rank', 'overall_score', 'parliamentary_score', 'party_rank', 'td_id', 'updated_at'],
    );
    expect(await q(`select column_name from information_schema.columns where table_schema = 'politics' and table_name = 'news_sources' and column_name = 'credibility'`)).toEqual([]);
  });
});
