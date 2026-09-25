/**
 * Account erasure against a real Postgres. Two users each get a row in every user-keyed
 * table; deleting one must remove all of theirs and none of the other's. A second test
 * reads the live schema so a NEW user-keyed table fails here until deleteUserData covers it.
 *
 * Skipped unless TEST_DATABASE_URL is set; uses its own database `<db>_account`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const url = testDatabaseUrl('account');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
}

const VECTOR = 'economic, social, cultural, authority, environmental, welfare, globalism, technocratic';
const ZEROS = '0, 0, 0, 0, 0, 0, 0, 0';

/** Every user-keyed table and how to find one user's rows in it. */
const OWNED: Array<{ table: string; where: string }> = [
  { table: 'policy_votes', where: 'user_id = $1' },
  { table: 'daily_sessions', where: 'user_id = $1' },
  { table: 'daily_session_items', where: 'session_id in (select id from politics.daily_sessions where user_id = $1)' },
  { table: 'pledge_category_priorities', where: 'user_id = $1' },
  { table: 'quiz_results', where: 'user_id = $1' },
  { table: 'ideology_profiles', where: "subject_kind = 'user' and subject_id = $1" },
  { table: 'users', where: 'id = $1' },
];

run('deleteUserData against Postgres', () => {
  let dbmod: typeof import('../db');
  let mod: typeof import('./deleteUserData');
  let questionId: number;

  const q = (sql: string, params: unknown[] = []) => dbmod.pool.query(sql, params);

  async function seedUser(userId: string) {
    const session = await q(
      "insert into politics.daily_sessions (user_id, session_date) values ($1, '2026-09-25') returning id",
      [userId],
    );
    const item = await q(
      'insert into politics.daily_session_items (session_id, question_id, position) values ($1, $2, 0) returning id',
      [session.rows[0].id, questionId],
    );
    await q(
      "insert into politics.policy_votes (user_id, question_id, option_key, source, session_item_id) values ($1, $2, 'option_a', 'daily_session', $3)",
      [userId, questionId, item.rows[0].id],
    );
    await q("insert into politics.pledge_category_priorities (user_id, category, rank) values ($1, 'housing', 1)", [userId]);
    await q(
      `insert into politics.quiz_results (user_id, answers, ${VECTOR}, ideology, description) values ($1, '[]', ${ZEROS}, 'Centrist', 'x')`,
      [userId],
    );
    await q(
      `insert into politics.ideology_profiles (subject_kind, subject_id, ${VECTOR}, total_weight, evidence_count) values ('user', $1, ${ZEROS}, 1, 1)`,
      [userId],
    );
    await q("insert into politics.users (id, first_name, phone_number) values ($1, 'Test', $2)", [userId, `+35387${userId.length}${userId.charCodeAt(5)}`]);
  }

  async function countsFor(userId: string) {
    const out: Record<string, number> = {};
    for (const { table, where } of OWNED) {
      out[table] = (await q(`select count(*)::int as n from politics.${table} where ${where}`, [userId])).rows[0].n;
    }
    return out;
  }

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    mod = await import('./deleteUserData');
  }, 60_000);

  beforeEach(async () => {
    await q(
      `truncate politics.policy_votes, politics.daily_session_items, politics.daily_sessions,
        politics.policy_question_options, politics.policy_questions, politics.pledge_category_priorities,
        politics.quiz_results, politics.ideology_profiles, politics.users restart identity cascade`,
    );
    const question = await q(
      "insert into politics.policy_questions (article_id, question, policy_domain, policy_topic, headline) values (1, 'Q?', 'economy', 'cost_of_living', 'H') returning id",
    );
    questionId = question.rows[0].id;
    await q(
      `insert into politics.policy_question_options (question_id, option_key, label, position, ${VECTOR}) values ($1, 'option_a', 'A', 0, ${ZEROS})`,
      [questionId],
    );
    // A TD profile under the same id proves only the 'user' kind is touched.
    await q(`insert into politics.ideology_profiles (subject_kind, subject_id, ${VECTOR}, total_weight, evidence_count) values ('td', 'user-a', ${ZEROS}, 1, 1)`);
  });

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it("deletes every row the user owns and none of anyone else's", async () => {
    await seedUser('user-a');
    await seedUser('user-b');
    const before = await countsFor('user-a');
    // Guard against a vacuous pass: the seed must have given user-a a row in EVERY table.
    expect(Object.values(before).every((n) => n === 1)).toBe(true);
    expect(Object.keys(before)).toHaveLength(OWNED.length);

    const deleted = await mod.deleteUserData('user-a');

    expect(deleted).toEqual({ policyVotes: 1, dailySessions: 1, pledgeCategoryPriorities: 1, quizResults: 1, ideologyProfile: 1, profile: 1 });
    expect(Object.values(await countsFor('user-a')).every((n) => n === 0)).toBe(true);
    expect(await countsFor('user-b')).toEqual(before);
    const td = await q("select count(*)::int as n from politics.ideology_profiles where subject_kind = 'td' and subject_id = 'user-a'");
    expect(td.rows[0].n).toBe(1);
  });

  it('is a no-op for a user with no data, and refuses an empty id', async () => {
    await seedUser('user-b');
    expect(await mod.deleteUserData('nobody')).toEqual({
      policyVotes: 0, dailySessions: 0, pledgeCategoryPriorities: 0, quizResults: 0, ideologyProfile: 0, profile: 0,
    });
    await expect(mod.deleteUserData('')).rejects.toThrow();
    expect((await countsFor('user-b')).policy_votes).toBe(1);
  });

  it('covers every user-keyed table in the politics schema', async () => {
    const { rows } = await q(`
      select distinct table_name from information_schema.columns
      where table_schema = 'politics' and (column_name = 'user_id' or column_name = 'subject_kind')
      union select 'users' where to_regclass('politics.users') is not null
      order by 1`);
    const found = rows.map((r: { table_name: string }) => r.table_name);
    expect(found.length).toBeGreaterThan(0);
    const covered = OWNED.map((o) => o.table);
    expect(found.filter((t: string) => !covered.includes(t))).toEqual([]);
  });
});
