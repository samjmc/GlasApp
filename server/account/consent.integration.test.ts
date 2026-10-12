/**
 * Consent to political opinions against a real Postgres: what granting stores, which wording
 * counts, what the route guard lets through, and that withdrawing erases the political data
 * of that user only, keeping the account.
 *
 * Skipped unless TEST_DATABASE_URL is set; uses its own database `<db>_consent`.
 */
import type { NextFunction, Request, Response } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { POLITICAL_CONSENT_VERSION } from '@shared/consent';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const url = testDatabaseUrl('consent');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.LOG_LEVEL = 'silent';
}

const VECTOR = 'economic, social, cultural, authority, environmental, welfare, globalism, technocratic';
const ZEROS = '0, 0, 0, 0, 0, 0, 0, 0';

run('political consent against Postgres', () => {
  let dbmod: typeof import('../db');
  let mod: typeof import('./consent');
  let questionId: number;

  const q = (sql: string, params: unknown[] = []) => dbmod.pool.query(sql, params);

  /** One row of every kind of political data, plus a profile with a name. */
  async function seedPoliticalData(userId: string) {
    const session = await q("insert into politics.daily_sessions (user_id, session_date) values ($1, '2026-09-25') returning id", [userId]);
    const item = await q('insert into politics.daily_session_items (session_id, question_id, position) values ($1, $2, 0) returning id', [
      session.rows[0].id,
      questionId,
    ]);
    await q(
      "insert into politics.policy_votes (user_id, question_id, option_key, source, session_item_id) values ($1, $2, 'option_a', 'daily_session', $3)",
      [userId, questionId, item.rows[0].id],
    );
    await q("insert into politics.pledge_category_priorities (user_id, category, rank) values ($1, 'housing', 1)", [userId]);
    await q(`insert into politics.quiz_results (user_id, answers, ${VECTOR}, ideology, description) values ($1, '[]', ${ZEROS}, 'Centrist', 'x')`, [userId]);
    await q(`insert into politics.ideology_profiles (subject_kind, subject_id, ${VECTOR}, total_weight, evidence_count) values ('user', $1, ${ZEROS}, 1, 1)`, [userId]);
    await q("insert into politics.users (id, first_name) values ($1, 'Test') on conflict (id) do nothing", [userId]);
  }

  async function politicalRowsOf(userId: string): Promise<number> {
    const tables = [
      ['policy_votes', 'user_id'],
      ['daily_sessions', 'user_id'],
      ['pledge_category_priorities', 'user_id'],
      ['quiz_results', 'user_id'],
    ] as const;
    let total = 0;
    for (const [table, column] of tables) {
      total += (await q(`select count(*)::int as n from politics.${table} where ${column} = $1`, [userId])).rows[0].n;
    }
    total += (await q("select count(*)::int as n from politics.ideology_profiles where subject_kind = 'user' and subject_id = $1", [userId])).rows[0].n;
    return total;
  }

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    mod = await import('./consent');
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
    await q(`insert into politics.policy_question_options (question_id, option_key, label, position, ${VECTOR}) values ($1, 'option_a', 'A', 0, ${ZEROS})`, [questionId]);
  });

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('has no consent for someone who never gave it, with or without a profile row', async () => {
    expect(await mod.hasPoliticalConsent('nobody')).toBe(false);
    await q("insert into politics.users (id) values ('no-consent')");
    expect(await mod.hasPoliticalConsent('no-consent')).toBe(false);
  });

  it('records when and which wording, creating the profile row if it is the first sight', async () => {
    await mod.grantPoliticalConsent('new-user');
    expect(await mod.hasPoliticalConsent('new-user')).toBe(true);
    const { rows } = await q("select political_consent_at, political_consent_version from politics.users where id = 'new-user'");
    expect(rows[0].political_consent_version).toBe(POLITICAL_CONSENT_VERSION);
    expect(Math.abs(Date.now() - new Date(rows[0].political_consent_at).getTime())).toBeLessThan(60_000);
  });

  it('agreeing again to the same wording keeps the original date; agreeing to new wording replaces it', async () => {
    await mod.grantPoliticalConsent('keeper');
    await q("update politics.users set political_consent_at = '2026-01-01T00:00:00Z' where id = 'keeper'");
    await mod.grantPoliticalConsent('keeper');
    const kept = await q("select political_consent_at from politics.users where id = 'keeper'");
    expect(new Date(kept.rows[0].political_consent_at).toISOString()).toBe('2026-01-01T00:00:00.000Z');

    await q("update politics.users set political_consent_version = $1 where id = 'keeper'", [POLITICAL_CONSENT_VERSION - 1]);
    await mod.grantPoliticalConsent('keeper');
    const replaced = await q("select political_consent_at, political_consent_version from politics.users where id = 'keeper'");
    expect(replaced.rows[0].political_consent_version).toBe(POLITICAL_CONSENT_VERSION);
    expect(new Date(replaced.rows[0].political_consent_at).getTime()).toBeGreaterThan(Date.parse('2026-06-01T00:00:00Z'));
  });

  it('does not count a consent given to an older wording', async () => {
    await mod.grantPoliticalConsent('old-wording');
    await q("update politics.users set political_consent_version = $1 where id = 'old-wording'", [POLITICAL_CONSENT_VERSION - 1]);
    expect(await mod.hasPoliticalConsent('old-wording')).toBe(false);
    await mod.grantPoliticalConsent('old-wording');
    expect(await mod.hasPoliticalConsent('old-wording')).toBe(true);
  });

  it('withdrawing erases that user’s political data and consent, and nobody else’s, keeping the account', async () => {
    await seedPoliticalData('user-a');
    await seedPoliticalData('user-b');
    await mod.grantPoliticalConsent('user-a');
    await mod.grantPoliticalConsent('user-b');
    // Guard against a vacuous pass: both users hold a row in all five kinds of data.
    expect(await politicalRowsOf('user-a')).toBe(5);

    const erased = await mod.withdrawPoliticalConsent('user-a');

    expect(erased).toEqual({ policyVotes: 1, dailySessions: 1, pledgeCategoryPriorities: 1, quizResults: 1, ideologyProfile: 1 });
    expect(await politicalRowsOf('user-a')).toBe(0);
    expect(await mod.hasPoliticalConsent('user-a')).toBe(false);
    const profile = await q("select first_name, political_consent_at from politics.users where id = 'user-a'");
    expect(profile.rows).toHaveLength(1);
    expect(profile.rows[0]).toMatchObject({ first_name: 'Test', political_consent_at: null });
    expect(await politicalRowsOf('user-b')).toBe(5);
    expect(await mod.hasPoliticalConsent('user-b')).toBe(true);
  });

  it('can be withdrawn by someone with nothing to erase, and re-granted afterwards', async () => {
    expect(await mod.withdrawPoliticalConsent('empty')).toEqual({ policyVotes: 0, dailySessions: 0, pledgeCategoryPriorities: 0, quizResults: 0, ideologyProfile: 0 });
    await mod.grantPoliticalConsent('empty');
    expect(await mod.hasPoliticalConsent('empty')).toBe(true);
  });

  describe('every political write re-checks consent as it writes', () => {
    const vote = (userId: string) =>
      import('../voting/repository').then((voting) =>
        voting.upsertVote({ userId, questionId, optionKey: 'option_a', source: 'article', sessionItemId: null }),
      );

    it('refuses each write, storing nothing, for a user who withdrew after the route guard let them through', async () => {
      const voting = await import('../voting/repository');
      const ideologyRepo = await import('../ideology/repository');
      const pledges = await import('../pledges/repository');
      const quiz = await import('../quiz');
      const ideology = await import('../ideology');

      // Control: with consent the same writes store rows, so the zero below is not vacuous.
      await mod.grantPoliticalConsent('late');
      await vote('late');
      await pledges.saveRanking('late', ['housing']);
      expect(await politicalRowsOf('late')).toBe(2);

      await mod.withdrawPoliticalConsent('late');
      await expect(vote('late')).rejects.toBeInstanceOf(mod.ConsentRequiredError);
      await expect(
        voting.createSession({ userId: 'late', sessionDate: '2026-09-25', county: 'Cork', constituency: null, profileBefore: null, questionIds: [questionId] }),
      ).rejects.toBeInstanceOf(mod.ConsentRequiredError);
      await expect(voting.completeSession('late', 1, 1, {} as never)).rejects.toBeInstanceOf(mod.ConsentRequiredError);
      await expect(
        ideologyRepo.insertQuizResult({ userId: 'late', answers: [], plan: null, vector: {} as never, ideology: 'x', description: 'x' }),
      ).rejects.toBeInstanceOf(mod.ConsentRequiredError);
      await expect(pledges.saveRanking('late', ['housing'])).rejects.toBeInstanceOf(mod.ConsentRequiredError);
      // The quiz still answers, like an anonymous one, and the profile recompute writes nothing.
      expect((await quiz.submitQuiz('late', [{ questionId: 1, answerIndex: 0 }])).id).toBeNull();
      await ideology.recomputeProfile('late');

      expect(await politicalRowsOf('late')).toBe(0);
    });

    it('a withdrawal waits for a write already in progress, then erases what it wrote', async () => {
      await mod.grantPoliticalConsent('racer');
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      let locked!: () => void;
      const inside = new Promise<void>((resolve) => (locked = resolve));

      const writing = mod.withPoliticalConsent('racer', async (tx) => {
        await tx.execute(
          sql`insert into politics.policy_votes (user_id, question_id, option_key, source) values ('racer', ${questionId}, 'option_a', 'article')`,
        );
        locked();
        await gate;
      });
      await inside;

      const withdrawing = mod.withdrawPoliticalConsent('racer');
      const early = await Promise.race([withdrawing.then(() => 'finished'), new Promise((r) => setTimeout(() => r('waiting'), 300))]);
      expect(early).toBe('waiting');

      release();
      await writing;
      const erased = await withdrawing;
      expect(erased.policyVotes).toBe(1);
      expect(await politicalRowsOf('racer')).toBe(0);
    });

    it('a write that waits on a withdrawal in progress sees it and is refused', async () => {
      await mod.grantPoliticalConsent('waiter');
      const client = await dbmod.pool.connect();
      try {
        await client.query('begin');
        await client.query("select id from politics.users where id = 'waiter' for update");
        await client.query("update politics.users set political_consent_at = null, political_consent_version = null where id = 'waiter'");

        const writing = vote('waiter');
        const settled = writing.then(
          () => 'stored',
          (error: unknown) => (error instanceof mod.ConsentRequiredError ? 'refused' : String(error)),
        );
        const early = await Promise.race([settled, new Promise((r) => setTimeout(() => r('waiting'), 300))]);
        expect(early).toBe('waiting');

        await client.query('commit');
        expect(await settled).toBe('refused');
      } finally {
        client.release();
      }
      expect(await politicalRowsOf('waiter')).toBe(0);
    });
  });

  describe('requirePoliticalConsent', () => {
    function call(userId: string) {
      const res = { statusCode: 0, body: undefined as unknown, status(code: number) { this.statusCode = code; return this; }, json(b: unknown) { this.body = b; return this; } };
      const next = vi.fn() as unknown as NextFunction;
      return mod.requirePoliticalConsent({ user: { id: userId } } as Request, res as unknown as Response, next).then(() => ({ res, next }));
    }

    it('stops a user without consent with 403 CONSENT_REQUIRED', async () => {
      const { res, next } = await call('stranger');
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body).toMatchObject({ success: false, error: { code: mod.CONSENT_REQUIRED } });
    });

    it('lets a user with consent through', async () => {
      await mod.grantPoliticalConsent('agreed');
      const { res, next } = await call('agreed');
      expect(next).toHaveBeenCalledWith();
      expect(res.statusCode).toBe(0);
    });
  });
});
