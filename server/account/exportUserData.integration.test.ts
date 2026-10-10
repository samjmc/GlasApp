/**
 * The data export against a real Postgres. Two users each get a row in every user-keyed table;
 * exporting one must return all of theirs, none of the other's, and no secret. A second test reads
 * the live schema so a NEW user-keyed table fails here until the export covers it.
 *
 * Skipped unless TEST_DATABASE_URL is set; uses its own database `<db>_export`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const url = testDatabaseUrl('export');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
}

const VECTOR = 'economic, social, cultural, authority, environmental, welfare, globalism, technocratic';
const NOW = new Date('2026-10-10T12:00:00Z');

run('exportUserData against Postgres', () => {
  let dbmod: typeof import('../db');
  let mod: typeof import('./exportUserData');
  let questionId: number;

  const q = (sql: string, params: unknown[] = []) => dbmod.pool.query(sql, params);

  async function seedUser(userId: string, vote: 'option_a' | 'option_b') {
    const session = await q("insert into politics.daily_sessions (user_id, session_date, status, county) values ($1, '2026-09-25', 'completed', 'Cork') returning id", [userId]);
    const item = await q('insert into politics.daily_session_items (session_id, question_id, position) values ($1, $2, 0) returning id', [session.rows[0].id, questionId]);
    await q("insert into politics.policy_votes (user_id, question_id, option_key, source, session_item_id) values ($1, $2, $3, 'daily_session', $4)", [userId, questionId, vote, item.rows[0].id]);
    await q("insert into politics.pledge_category_priorities (user_id, category, rank) values ($1, 'housing', 1), ($1, 'health', 2)", [userId]);
    await q(`insert into politics.quiz_results (user_id, answers, ${VECTOR}, ideology, description) values ($1, '[{"questionId":1,"answerIndex":0}]', 1, 2, 3, 4, 5, 6, 7, 8, 'Centrist', $2)`, [userId, `desc of ${userId}`]);
    await q(`insert into politics.ideology_profiles (subject_kind, subject_id, ${VECTOR}, total_weight, evidence_count) values ('user', $1, 1, 2, 3, 4, 5, 6, 7, 8, 1, 1)`, [userId]);
    await q(
      `insert into politics.users (id, first_name, last_name, county, bio, phone_number, phone_verified, phone_code_hash, phone_code_attempts, political_consent_at, political_consent_version)
       values ($1, $2, 'Tester', 'Cork', 'about me', $3, true, 'secret-hash', 2, '2026-10-01T10:00:00Z', 1)`,
      [userId, `First ${userId}`, `+35387${userId.length}${userId.charCodeAt(5)}`],
    );
  }

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    mod = await import('./exportUserData');
  }, 60_000);

  beforeEach(async () => {
    await q(
      `truncate politics.policy_votes, politics.daily_session_items, politics.daily_sessions,
        politics.policy_question_options, politics.policy_questions, politics.pledge_category_priorities,
        politics.quiz_results, politics.ideology_profiles, politics.users restart identity cascade`,
    );
    const question = await q(
      "insert into politics.policy_questions (article_id, question, policy_domain, policy_topic, headline) values (1, 'Should the State build homes?', 'housing', 'supply', 'H') returning id",
    );
    questionId = question.rows[0].id;
    for (const [i, [key, label]] of [['option_a', 'Build them'], ['option_b', 'Leave it to the market']].entries()) {
      await q(`insert into politics.policy_question_options (question_id, option_key, label, position, ${VECTOR}) values ($1, $2, $3, $4, 0, 0, 0, 0, 0, 0, 0, 0)`, [questionId, key, label, i]);
    }
  });

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it("returns every section for the user, in words where it can, and none of anyone else's", async () => {
    await seedUser('user-a', 'option_a');
    await seedUser('user-b', 'option_b');

    const out = await mod.exportUserData('user-a', { email: 'a@example.ie' }, NOW);

    expect(out).toMatchObject({ format: mod.EXPORT_FORMAT_VERSION, exportedAt: '2026-10-10T12:00:00.000Z' });
    expect(out.account).toMatchObject({ id: 'user-a', email: 'a@example.ie', firstName: 'First user-a', county: 'Cork', bio: 'about me', phoneVerified: true, politicalConsentVersion: 1 });
    expect(out.quizResults).toHaveLength(1);
    expect(out.quizResults[0]).toMatchObject({ ideology: 'Centrist', description: 'desc of user-a', economic: 1, technocratic: 8, answers: [{ questionId: 1, answerIndex: 0 }] });
    expect(out.ideologyProfile).toMatchObject({ economic: 1, welfare: 6, evidenceCount: 1 });
    expect(out.votes).toEqual([
      expect.objectContaining({ questionId, question: 'Should the State build homes?', optionKey: 'option_a', answer: 'Build them', source: 'daily_session' }),
    ]);
    expect(out.dailySessions).toEqual([expect.objectContaining({ sessionDate: '2026-09-25', status: 'completed', county: 'Cork', questionIds: [questionId] })]);
    expect(out.pledgePriorities.map((p) => [p.category, p.rank])).toEqual([['housing', 1], ['health', 2]]);
    expect(out.notes.length).toBeGreaterThan(0);

    // Nothing of user-b's: not their answer, their name, their email, or their description.
    const text = JSON.stringify(out);
    for (const theirs of ['user-b', 'Leave it to the market', 'desc of user-b']) expect(text).not.toContain(theirs);
  });

  it('never carries the phone code hash or its bookkeeping, or the owner id on a row', async () => {
    await seedUser('user-a', 'option_a');
    const out = await mod.exportUserData('user-a', { email: null }, NOW);
    const text = JSON.stringify(out);
    expect(text).not.toContain('secret-hash');
    expect(out.account).not.toHaveProperty('phoneCodeHash');
    expect(out.account).not.toHaveProperty('phoneCodeExpiresAt');
    expect(out.account).not.toHaveProperty('phoneCodeAttempts');
    expect(out.account!.email).toBeNull();
    expect(out.quizResults[0]).not.toHaveProperty('userId');
    expect(out.dailySessions[0]).not.toHaveProperty('userId');
    expect(out.ideologyProfile).not.toHaveProperty('subjectId');
  });

  it('is empty, not an error, for a user with no data, and refuses an empty id', async () => {
    const out = await mod.exportUserData('nobody', { email: 'n@example.ie' }, NOW);
    expect(out).toMatchObject({ account: null, quizResults: [], ideologyProfile: null, votes: [], dailySessions: [], pledgePriorities: [] });
    await expect(mod.exportUserData('', { email: null })).rejects.toThrow();
  });

  it('covers every user-keyed table in the politics schema', async () => {
    const { rows } = await q(`
      select distinct table_name from information_schema.columns
      where table_schema = 'politics' and (column_name = 'user_id' or column_name = 'subject_kind')
      union select 'users' where to_regclass('politics.users') is not null
      union select 'daily_session_items' where to_regclass('politics.daily_session_items') is not null
      order by 1`);
    const found = rows.map((r: { table_name: string }) => r.table_name);
    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((t: string) => !(mod.EXPORTED_USER_TABLES as readonly string[]).includes(t))).toEqual([]);
  });
});
