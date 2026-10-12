/**
 * Migration 0030's indexes against a real Postgres: each hot lookup the sweep measured can use
 * its new index (checked with sequential scans switched off, so a tiny fixture still shows it),
 * one disclosure file per period is enforced, and hasQuestionCounts answers exactly as the
 * count it replaced. Skipped unless TEST_DATABASE_URL is set; uses its own database, `<db>_indexes`.
 *
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55471/postgres"
 *   npx vitest run server/parliament/repo/indexes.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../../testing/migrations';

const url = testDatabaseUrl('indexes');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

run('0030 indexes (real Postgres)', () => {
  let dbmod: typeof import('../../db');
  let repo: typeof import('../repository');
  const q = (text: string, params: unknown[] = []) => dbmod.pool.query(text, params);

  /** The plan of `text` with sequential scans off, as one string. */
  async function plan(text: string): Promise<string> {
    const client = await dbmod.pool.connect();
    try {
      await client.query('begin');
      await client.query('set local enable_seqscan = off');
      const { rows } = await client.query(`explain ${text}`);
      return rows.map((r: { 'QUERY PLAN': string }) => r['QUERY PLAN']).join('\n');
    } finally {
      await client.query('rollback');
      client.release();
    }
  }

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../../db');
    await applyAllMigrations(dbmod.pool);
    repo = await import('../repository');
    await q(`insert into politics.debate_sections (id, date, title, parent_id, speech_count)
             values ('dail-2026-09-23-dbsect_1', '2026-09-23', 'Health: Motion', null, 2),
                    ('dail-2026-09-23-dbsect_2', '2026-09-23', 'Ceisteanna', 'dail-2026-09-23-dbsect_1', 2)`);
    await q(`insert into politics.divisions (id, uri, house_no, date, debate_section_id, ta_count, nil_count, staon_count)
             values ('dail-34-2026-09-23-vote_1', 'u1', 34, '2026-09-23', 'dail-2026-09-23-dbsect_1', 1, 1, 0)`);
    await q('analyze');
  }, 60_000);

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it.each([
    ['divisions by section', `select id from politics.divisions where debate_section_id = 'dail-2026-09-23-dbsect_1'`, 'divisions_debate_section_idx'],
    ['divisions of a day', `select id from politics.divisions where debate_section_id like 'dail-2026-09-23-%'`, 'divisions_debate_section_idx'],
    ['child sections', `select id from politics.debate_sections where parent_id = 'dail-2026-09-23-dbsect_1'`, 'debate_sections_parent_idx'],
    ['fallback section by title', `select id from politics.debate_sections where title = 'Health: Motion' and date <= '2026-09-23'`, 'debate_sections_title_idx'],
    ['a question month', `delete from politics.question_counts where month = '2026-09-01'`, 'question_counts_month_idx'],
    ['votes of a session item', `update politics.policy_votes set session_item_id = null where session_item_id = 1`, 'policy_votes_session_item_idx'],
    ['session items of a question', `delete from politics.daily_session_items where question_id = 1`, 'daily_session_items_question_id_idx'],
    ['stances of a division', `delete from politics.td_stances where division_id = 'x'`, 'td_stances_division_idx'],
    ['readings of a question', `delete from politics.division_readings where question_id = 1`, 'division_readings_question_idx'],
    ['speech (member, td) pairs', `select distinct member_code, td_id from politics.debate_speeches where member_code is not null`, 'debate_speeches_member_idx'],
    ['vote (member, td) pairs', `select distinct member_code, td_id from politics.division_votes`, 'division_votes_member_idx'],
  ])('%s can use its index', async (_name, text, index) => {
    expect(await plan(text)).toContain(index);
  });

  it('keeps one disclosure file per period', async () => {
    await q(`insert into politics.disclosure_files (source_url, kind, period) values ('https://x/a.pdf', 'allowances', '2026-08-01')`);
    await expect(q(`insert into politics.disclosure_files (source_url, kind, period) values ('https://x/b.pdf', 'allowances', '2026-08-01')`)).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('hasQuestionCounts says what the old count(*) said, empty and not', async () => {
    const old = async () => Number((await q('select count(*)::int n from politics.question_counts limit 1')).rows[0].n) > 0;
    await q('delete from politics.question_counts');
    expect([await repo.hasQuestionCounts(), await old()]).toEqual([false, false]);
    await q(`insert into politics.question_counts (member_code, month, department, question_type, n) values ('A.D.2020', '2026-09-01', 'Health', 'oral', 3)`);
    expect([await repo.hasQuestionCounts(), await old()]).toEqual([true, true]);
  });
});
