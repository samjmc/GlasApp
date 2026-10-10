/**
 * The robot run's reference data: public rows copied READ-ONLY from GlasCore into the `_robots`
 * database. No user table is read. Each table is moved as JSON through json_populate_recordset,
 * so the copy follows the columns of the shared migrations without listing them.
 *
 * Not copied: news_articles. Voting keeps headline and URL on policy_questions and never joins
 * the news tables (shared/schema/voting.ts).
 */
import pkg from 'pg';
import { assertRobotDatabase } from './guards';

/** Parents before children (td_ideology_evidence → tds, options → questions). */
export const COPIED_TABLES = ['tds', 'td_ideology_evidence', 'policy_questions', 'policy_question_options'] as const;
type Queryable = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };

export interface SeedSummary {
  rows: Record<(typeof COPIED_TABLES)[number], number>;
}

/** Reads every copied table from `sourceUrl` inside one READ ONLY transaction. */
export async function readReference(sourceUrl: string): Promise<Record<string, unknown[]>> {
  const source = new pkg.Client({ connectionString: sourceUrl, ssl: { rejectUnauthorized: false } });
  await source.connect();
  try {
    await source.query('BEGIN READ ONLY');
    const out: Record<string, unknown[]> = {};
    for (const table of COPIED_TABLES) {
      out[table] = (await source.query(`select coalesce(json_agg(t), '[]'::json) as rows from politics.${table} t`)).rows[0].rows;
    }
    await source.query('COMMIT');
    return out;
  } finally {
    await source.end();
  }
}

/**
 * Writes the rows into the robots database (whose politics schema was just recreated), moves each
 * sequence past the copied ids, and dates every question `now` minus a minute or two each, so
 * they fall inside the daily session's 14-day window (server/voting/service.ts).
 */
export async function writeReference(target: Queryable, data: Record<string, unknown[]>, now: Date): Promise<SeedSummary> {
  assertRobotDatabase((await target.query('select current_database() as name')).rows[0]?.name);
  const rows = {} as SeedSummary['rows'];
  for (const table of COPIED_TABLES) {
    const list = data[table] ?? [];
    if (list.length) {
      await target.query(`insert into politics.${table} select * from json_populate_recordset(null::politics.${table}, $1::json)`, [JSON.stringify(list)]);
      await target.query(`select setval(pg_get_serial_sequence('politics.${table}', 'id'), (select max(id) from politics.${table}))`);
    }
    rows[table] = list.length;
  }
  await target.query(
    `update politics.policy_questions q set created_at = $1::timestamptz - make_interval(mins => r.n)
       from (select id, row_number() over (order by created_at desc, id desc)::int as n from politics.policy_questions) r
      where q.id = r.id`,
    [now.toISOString()],
  );
  return { rows };
}
