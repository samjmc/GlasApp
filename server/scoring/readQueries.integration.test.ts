/**
 * The TD read queries that stopped reading whole tables (findById / findByName join the TD's
 * parliament record; /api/scores/tds reads only the researched ids) return exactly what the old
 * code returned. The old code is kept below as the reference.
 *
 * Skipped unless TEST_DATABASE_URL is set. Uses its OWN database, `<db>_scoringreads`
 * (see server/testing/migrations.ts):
 *
 *   docker run -d --name glas-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
 *   npx vitest run server/scoring/readQueries.integration.test.ts
 */
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tdHistoricalBaselines, tdScores, tds } from '@shared/schema/politics';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const url = testDatabaseUrl('scoringreads');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

const TDS = 40;

run('TD read queries: new vs old', () => {
  let repo: typeof import('./repository');
  let dbmod: typeof import('../db');
  let parliament: typeof import('../parliament/repository');

  // ---- The OLD reads, as they were before this change. ----
  const oldWithScore = () => dbmod.db.select({ td: tds, score: tdScores }).from(tds).leftJoin(tdScores, eq(tdScores.tdId, tds.id));
  async function oldWithStats<R extends { td: { id: number } }>(rows: R[]) {
    if (rows.length === 0) return [];
    const stats = new Map((await parliament.allStats()).map((s) => [s.tdId, s]));
    return rows.map((r) => ({ ...r, stats: stats.get(r.td.id) ?? null }));
  }
  async function oldFindByName(name: string) {
    const rows = await oldWithScore()
      .where(sql`lower(${tds.name}) = lower(${name.trim()})`)
      .limit(1);
    return (await oldWithStats(rows))[0] ?? null;
  }
  async function oldFindById(id: number) {
    const rows = await oldWithScore().where(eq(tds.id, id)).limit(1);
    return (await oldWithStats(rows))[0] ?? null;
  }
  /** GET /api/scores/tds: `new Set(baselines.filter((b) => b.summary).map((b) => b.tdId))` over every column. */
  async function oldResearched() {
    const baselines = await dbmod.db.select().from(tdHistoricalBaselines);
    return new Set(baselines.filter((b) => b.summary).map((b) => b.tdId));
  }
  // ---- end of the old reads ----

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    repo = await import('./repository');
    parliament = await import('../parliament/repository');

    const q = (text: string, params: unknown[] = []) => dbmod.pool.query(text, params);
    await q('truncate politics.tds restart identity cascade');
    // Some inactive, some with no score row, some with no parliament record, some with the
    // record's nullable columns empty; backgrounds for half, a third of those with no summary.
    await q(
      `insert into politics.tds (name, party, constituency, is_active, offices, committees, question_count_oral, attendance_pct)
       select 'Deputy ' || i || case when i % 9 = 0 then ' Ó Súilleabháin' else '' end,
              case when i % 5 = 0 then null else 'Party ' || (i % 4) end, 'Constituency ' || (i % 6),
              i % 7 <> 0, case when i % 3 = 0 then '[{"title":"Minister"}]'::jsonb end,
              case when i % 2 = 0 then '["Health"]'::jsonb end,
              case when i % 4 = 0 then null else i * 3 end, case when i % 8 = 0 then null else 50 + i end
         from generate_series(1, $1::int) i`,
      [TDS],
    );
    await q(
      `insert into politics.td_scores (td_id, overall_score, parliamentary_score, national_rank, computed_at)
       select i, case when i % 10 = 0 then null else 40 + i end, 30 + i, i, now() - i * interval '1 hour'
         from generate_series(1, $1::int) i where i % 3 <> 0`,
      [TDS],
    );
    await q(
      `insert into politics.td_parliament_stats
         (td_id, member_since, is_presiding, divisions_eligible, votes_cast, sitting_days, sections_spoken, speeches,
          committee_sittings_eligible, committee_sittings_attended, divisions_chaired, questions_expected, attendance_benchmark)
       select i, date '2024-11-29' + i, i = 13, 500, 400 + i, 90, 100 + i, 200 + i,
              case when i % 5 = 0 then null else 50 end, case when i % 5 = 0 then null else 30 + i % 20 end,
              case when i % 5 = 0 then null else 0 end, case when i % 5 = 0 then null else 120.5 end, 85.25
         from generate_series(1, $1::int) i where i % 4 <> 0`,
      [TDS],
    );
    await q(
      `insert into politics.td_historical_baselines (td_id, summary, passages, source_url, source_title, source_revision, retrieved_at)
       select i, case when i % 6 = 0 then '' else 'Deputy ' || i || ' is a TD.' end, jsonb_build_array('Passage ' || i),
              'https://en.wikipedia.org/w/index.php?oldid=' || i, 'Deputy ' || i, i, now()
         from generate_series(1, $1::int) i where i % 2 = 0`,
      [TDS],
    );
  }, 60_000);

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('the fixture has every kind of row', async () => {
    const { rows: [f] } = await dbmod.pool.query(
      `select (select count(*)::int from politics.tds where not is_active) as inactive,
              (select count(*)::int from politics.tds t where not exists (select 1 from politics.td_scores s where s.td_id = t.id)) as unscored,
              (select count(*)::int from politics.tds t where not exists (select 1 from politics.td_parliament_stats s where s.td_id = t.id)) as no_stats,
              (select count(*)::int from politics.td_historical_baselines where summary = '') as empty_summaries,
              (select count(*)::int from politics.td_historical_baselines where summary <> '') as summaries`,
    );
    expect(f).toEqual({ inactive: 5, unscored: 13, no_stats: 10, empty_summaries: 6, summaries: 14 });
  });

  it('findById: the same row as before for every TD, and null for an unknown id', async () => {
    for (let id = 1; id <= TDS + 1; id++) {
      const [before, after] = await Promise.all([oldFindById(id), repo.findById(id)]);
      expect(after, `td ${id}`).toEqual(before);
    }
    expect(await repo.findById(TDS + 1)).toBeNull();
    expect((await repo.findById(13))?.stats?.isPresiding).toBe(true);
    expect((await repo.findById(4))?.stats).toBeNull();
  });

  it('findByName: the same row as before, in any case and with stray spaces', async () => {
    const { rows } = await dbmod.pool.query<{ name: string }>('select name from politics.tds order by id');
    expect(rows).toHaveLength(TDS);
    const names = [...rows.map((r) => r.name), ...rows.map((r) => `  ${r.name.toUpperCase()} `), 'Nobody At All', ''];
    for (const name of names) {
      const [before, after] = await Promise.all([oldFindByName(name), repo.findByName(name)]);
      expect(after, name).toEqual(before);
    }
  });

  it('researchedTdIds: the same TDs the old full-row read counted as researched', async () => {
    const [before, after] = await Promise.all([oldResearched(), repo.researchedTdIds()]);
    expect(before.size).toBe(14);
    expect(after).toHaveLength(before.size);
    expect(new Set(after)).toEqual(before);
  });
});
