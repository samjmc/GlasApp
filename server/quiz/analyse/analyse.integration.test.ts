/**
 * The item-analysis loader against a real Postgres: the latest row per user, answers and plan
 * only, inside a READ ONLY transaction.
 *
 * Skipped unless TEST_DATABASE_URL is set. Uses its OWN database, `<db>_quizanalyse`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../../testing/migrations';

const url = testDatabaseUrl('quizanalyse');
const run = describe.skipIf(!url);

if (url) process.env.DATABASE_URL = url;

run('the item-analysis loader against Postgres', () => {
  let dbmod: typeof import('../../db');
  let loader: typeof import('./loader');

  async function insert(userId: string, answers: unknown, plan: unknown, createdAt: string): Promise<void> {
    await dbmod.pool.query(
      `insert into politics.quiz_results (user_id, answers, plan, economic, social, cultural, authority, environmental, welfare,
         globalism, technocratic, ideology, description, created_at)
       values ($1, $2, $3, 0, 0, 0, 0, 0, 0, 0, 0, 'Centrist', 'test', $4)`,
      [userId, JSON.stringify(answers), plan === null ? null : JSON.stringify(plan), createdAt],
    );
  }

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../../db');
    await applyAllMigrations(dbmod.pool);
    loader = await import('./loader');
  }, 60_000);

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it("returns each user's latest quiz, with only its answers and plan", async () => {
    const older = [{ questionId: 1, answerIndex: 0 }];
    const newer = [{ questionId: 1, answerIndex: 3 }];
    const planned = [{ questionId: 2, answerIndex: 1 }];
    const plan = { v: 1, seed: 42, base: [2], followUps: [] };
    await insert('user-a', older, null, '2026-09-01T10:00:00Z');
    await insert('user-a', newer, null, '2026-09-02T10:00:00Z');
    await insert('user-b', planned, plan, '2026-09-01T12:00:00Z');
    await insert('user-c', [], null, '2026-09-03T10:00:00Z');

    const rows = await loader.loadLatestQuizzes(dbmod.pool);
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(['answers', 'plan']);
    expect(rows).toEqual(
      expect.arrayContaining([
        { answers: newer, plan: null },
        { answers: planned, plan },
        { answers: [], plan: null },
      ]),
    );
    expect(rows).not.toContainEqual({ answers: older, plan: null });
  });

  it('runs read-only: an insert inside withReadOnly is rejected and nothing is written', async () => {
    const count = async () => (await dbmod.pool.query('select count(*)::int as n from politics.quiz_results')).rows[0].n as number;
    const before = await count();
    await expect(
      loader.withReadOnly(dbmod.pool, (c) =>
        c.query(
          `insert into politics.quiz_results (user_id, answers, economic, social, cultural, authority, environmental, welfare,
             globalism, technocratic, ideology, description)
           values ('user-d', '[]', 0, 0, 0, 0, 0, 0, 0, 0, 'Centrist', 'test')`,
        ),
      ),
    ).rejects.toThrow(/read-only transaction/);
    expect(await count()).toBe(before);
  });
});
