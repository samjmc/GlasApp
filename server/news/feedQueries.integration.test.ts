/**
 * The feed's cheaper queries (capped total, TD tab driven from article_tds) return exactly what
 * the old queries returned. The old queries are kept below, verbatim, as the reference.
 *
 * Skipped unless TEST_DATABASE_URL is set. Uses its OWN database, `<db>_newsfeed`
 * (see server/testing/migrations.ts):
 *
 *   docker run -d --name glas-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
 *   npx vitest run server/news/feedQueries.integration.test.ts
 */
import { sql, type SQL } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hasMore, type FeedQuery } from './feed';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const url = testDatabaseUrl('newsfeed');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

const ARTICLES = 1500;
const TD_NAMES = ['Mary Lou McDonald', 'Micheál Martin', 'Simon Harris', 'Holly Cairns', 'Ivana Bacik', 'Paul Murphy', 'Peadar Tóibín', 'Michael Healy-Rae'];

run('feed queries: new vs old, on a realistic fixture', () => {
  let repo: typeof import('./repository');
  let dbmod: typeof import('../db');
  let floor: number;

  // ---- The OLD queries, as they were before the capped count and the article_tds-driven TD tab. ----
  function oldFeedSelect(where: SQL, orderBy: SQL, limit: number, offset: number): SQL {
    return sql`
      select a.id, a.title, a.summary, a.ai_summary, a.category, a.url, a.image_url, a.published_at,
             s.name as source, s.logo_url as source_logo_url,
             aff.affected, rep.also_reported_by
        from politics.news_articles a
        join politics.news_sources s on s.id = a.source_id
        left join lateral (
          select json_agg(json_build_object('name', t.name) order by v.created_at, t.name) as affected
            from politics.article_tds v
            join politics.tds t on t.id = v.td_id
           where v.article_id = a.id) aff on true
        left join lateral (
          select json_agg(json_build_object('source', o.name, 'url', o.url) order by o.published_at, o.url) as also_reported_by
            from (
              select distinct on (ds.name) ds.name, d.url, d.published_at
                from politics.news_articles d
                join politics.news_sources ds on ds.id = d.source_id
               where d.duplicate_of = a.id and ds.name <> s.name
               order by ds.name, d.published_at, d.url) o) rep on true
       where ${where}
       order by ${orderBy}
       limit ${limit} offset ${offset}`;
  }
  const BY_IMPORTANCE = sql`(a.importance_score is null), a.importance_score desc, a.published_at desc, a.id desc`;
  const BY_DATE = sql`a.published_at desc, a.id desc`;
  const oldVisible = () => sql`coalesce(a.relevance_score, 100) >= ${floor} and a.status <> 'duplicate'`;

  type Raw = { id: number; affected: Array<{ name: string }> | null; also_reported_by: Array<{ source: string; url: string }> | null };
  const shape = (rows: Raw[]) =>
    rows.map((r) => ({ id: Number(r.id), affectedTds: r.affected ?? [], alsoReportedBy: r.also_reported_by ?? [] }));

  async function oldPage(filter: SQL, orderBy: SQL, limit: number, offset: number) {
    const where = sql`${oldVisible()} and ${filter}`;
    const [rows, count] = await Promise.all([
      dbmod.db.execute<Raw>(oldFeedSelect(where, orderBy, limit, offset)),
      dbmod.db.execute<{ n: number }>(sql`select count(*)::int as n from politics.news_articles a where ${where}`),
    ]);
    return { rows: shape(rows.rows), total: Number(count.rows[0]?.n ?? 0) };
  }

  async function oldFeedPage(query: FeedQuery, window: { since: Date; fallbackDays: number }) {
    const everything = sql`true`;
    if (query.sort === 'recent') return oldPage(everything, BY_DATE, query.limit, query.offset);
    if (query.sort === 'top') return oldPage(everything, BY_IMPORTANCE, query.limit, query.offset);
    const today = await oldPage(sql`a.published_at >= ${window.since}`, BY_IMPORTANCE, query.limit, query.offset);
    if (today.total > 0) return today;
    return oldPage(sql`a.published_at >= now() - make_interval(days => ${window.fallbackDays})`, BY_IMPORTANCE, query.limit, query.offset);
  }

  async function oldFeedForTd(name: string, limit: number) {
    const where = sql`exists (
      select 1 from politics.article_tds v join politics.tds t on t.id = v.td_id
       where v.article_id = a.id and lower(t.name) = lower(${name.trim()}))`;
    return (await oldPage(where, BY_DATE, limit, 0)).rows;
  }
  // ---- end of the old queries ----

  const newShape = (rows: Awaited<ReturnType<typeof repo.feedForTd>>) =>
    rows.map((r) => ({ id: r.id, affectedTds: r.affectedTds, alsoReportedBy: r.alsoReportedBy }));

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    repo = await import('./repository');
    floor = (await import('./relevance')).RELEVANCE_FLOOR;
    const sourceIds = [...(await repo.syncSources((await import('./sources')).NEWS_SOURCES)).values()];

    const q = (text: string, params: unknown[] = []) => dbmod.pool.query(text, params);
    await q('truncate politics.news_articles, politics.article_tds, politics.tds restart identity cascade');
    // Ties on published_at (i and i+900) and on importance; null importance every 5th; null
    // relevance every 11th (shown); below the floor every 7th (hidden); exactly at the floor every 40th.
    await q(
      `insert into politics.news_articles (source_id, url, title, published_at, status, importance_score, relevance_score, created_at)
       select ($1::int[])[1 + i % 5], 'https://example.ie/' || i, 'Article ' || i,
              now() - ((i * 37) % 900) * interval '1 hour', 'scored',
              case when i % 5 = 0 then null else (i * 13) % 101 end,
              case when i % 11 = 0 then null when i % 7 = 0 then $2::int - 1 when i % 40 = 0 then $2::int else $2::int + i % 40 end,
              now() - i * interval '1 second'
         from generate_series(1, $3::int) i`,
      [sourceIds, floor, ARTICLES],
    );
    // Every 9th article is a same-event duplicate of the one before it (hidden; feeds "also reported by").
    await q(`update politics.news_articles set status = 'duplicate', duplicate_of = id - 1 where id % 9 = 0`);
    for (const name of [...TD_NAMES, 'Nobody Linked']) await q('insert into politics.tds (name) values ($1)', [name]);
    // Links reach visible, duplicate and below-floor articles alike; some articles name two TDs.
    await q(
      `insert into politics.article_tds (article_id, td_id, created_at)
       select i, 1 + (i * k) % $1::int, now() - (i * k) * interval '1 second'
         from generate_series(1, $2::int) i, (values (1), (5)) as m(k)
        where (k = 1 and i % 3 = 0) or (k = 5 and i % 4 = 0) or (k = 1 and i % 97 = 1)
       on conflict do nothing`,
      [TD_NAMES.length, ARTICLES],
    );
    await q('analyze politics.news_articles; analyze politics.article_tds');
  }, 120_000);

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('the fixture has more visible articles than the count cap, and every kind of row', async () => {
    const { rows: [f] } = await dbmod.pool.query(
      `select count(*) filter (where coalesce(relevance_score, 100) >= $1 and status <> 'duplicate')::int as visible,
              count(*) filter (where status = 'duplicate')::int as duplicates,
              count(*) filter (where relevance_score < $1)::int as below,
              count(*) filter (where importance_score is null)::int as unranked
         from politics.news_articles`,
      [floor],
    );
    expect(f.visible).toBeGreaterThan(repo.FEED_COUNT_CAP);
    expect(f.duplicates).toBeGreaterThan(100);
    expect(f.below).toBeGreaterThan(100);
    expect(f.unranked).toBeGreaterThan(100);
  });

  const windows = {
    recent: { since: new Date(Date.now() - 48 * 3_600_000), fallbackDays: 30 },
    // Nothing since then, so `today` takes the fallback branch.
    empty: { since: new Date(Date.now() + 3_600_000), fallbackDays: 30 },
  };
  const cases: Array<[FeedQuery, keyof typeof windows]> = [];
  for (const sort of ['top', 'recent', 'today'] as const) {
    for (const [limit, offset] of [[10, 0], [10, 10], [50, 40], [10, 990], [10, 995], [50, 1000], [10, 1130], [50, 1150], [10, 10_000]]) {
      cases.push([{ sort, limit, offset }, 'recent']);
    }
    cases.push([{ sort, limit: 10, offset: 0 }, 'empty']);
  }

  it.each(cases)('feedPage %o (%s window): same rows, capped total, same hasMore', async (query, w) => {
    const [before, after] = await Promise.all([oldFeedPage(query, windows[w]), repo.feedPage(query, windows[w])]);
    expect(newShape(after.rows)).toEqual(before.rows);
    expect(after.total).toBe(Math.min(before.total, Math.max(repo.FEED_COUNT_CAP, query.offset + query.limit + 1)));
    expect(hasMore(query, after.total)).toBe(hasMore(query, before.total));
  });

  it('feedPage totals are exact below the cap and capped above it', async () => {
    const top = await repo.feedPage({ sort: 'top', limit: 10, offset: 0 }, windows.recent);
    expect(top.total).toBe(repo.FEED_COUNT_CAP);
    const today = await repo.feedPage({ sort: 'today', limit: 10, offset: 0 }, windows.recent);
    const exact = await oldFeedPage({ sort: 'today', limit: 10, offset: 0 }, windows.recent);
    expect(exact.total).toBeGreaterThan(0);
    expect(exact.total).toBeLessThan(repo.FEED_COUNT_CAP);
    expect(today.total).toBe(exact.total);
  });

  const tdCases: Array<[string, number]> = [
    ...TD_NAMES.flatMap((n): Array<[string, number]> => [[n, 20], [n, 500]]),
    ['  mary lou mcdonald  ', 20],
    ['HOLLY CAIRNS', 20],
    ['Nobody Linked', 20],
    ['Not A TD', 20],
  ];

  it.each(tdCases)('feedForTd(%j, %d): same rows, same order', async (name, limit) => {
    const [before, after] = await Promise.all([oldFeedForTd(name, limit), repo.feedForTd(name, limit)]);
    expect(newShape(after)).toEqual(before);
    if (TD_NAMES.includes(name)) expect(after.length).toBeGreaterThan(0);
  });
});
