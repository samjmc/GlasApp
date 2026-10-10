/**
 * Consent to store political opinions, against a real Postgres: granting, the version rule,
 * the gate, and withdrawal deleting the political data while keeping the account.
 *
 * Skipped unless TEST_DATABASE_URL is set; uses its own database `<db>_consent`.
 */
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { POLITICAL_CONSENT_VERSION } from '@shared/consent';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const url = testDatabaseUrl('consent');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
}

const VECTOR = 'economic, social, cultural, authority, environmental, welfare, globalism, technocratic';
const ZEROS = '0, 0, 0, 0, 0, 0, 0, 0';

run('political-data consent against Postgres', () => {
  let dbmod: typeof import('../db');
  let consent: typeof import('./index');
  const q = (sql: string, params: unknown[] = []) => dbmod.pool.query(sql, params);
  const count = async (table: string, where: string, userId: string) =>
    (await q(`select count(*)::int as n from politics.${table} where ${where}`, [userId])).rows[0].n as number;

  async function seedOpinions(userId: string) {
    await q("insert into politics.daily_sessions (user_id, session_date) values ($1, '2026-10-10')", [userId]);
    await q("insert into politics.pledge_category_priorities (user_id, category, rank) values ($1, 'housing', 1)", [userId]);
    await q(`insert into politics.quiz_results (user_id, answers, ${VECTOR}, ideology, description) values ($1, '[]', ${ZEROS}, 'Centrist', 'x')`, [userId]);
    await q(`insert into politics.ideology_profiles (subject_kind, subject_id, ${VECTOR}, total_weight, evidence_count) values ('user', $1, ${ZEROS}, 1, 1)`, [userId]);
    await q("insert into politics.users (id, first_name) values ($1, 'Test')", [userId]);
  }

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    consent = await import('./index');
  }, 60_000);

  beforeEach(async () => {
    await q(
      `truncate politics.political_data_consents, politics.daily_sessions, politics.pledge_category_priorities,
        politics.quiz_results, politics.ideology_profiles, politics.users restart identity cascade`,
    );
  });

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('records consent to the current text only, and re-granting refreshes it', async () => {
    expect(await consent.consentStatus('u1')).toEqual({ granted: false, version: POLITICAL_CONSENT_VERSION, grantedAt: null });
    await expect(consent.grantConsent('u1', '1999-01-01')).rejects.toBeInstanceOf(consent.ConsentVersionError);
    expect(await consent.hasPoliticalConsent('u1')).toBe(false);

    const granted = await consent.grantConsent('u1', POLITICAL_CONSENT_VERSION);
    expect(granted.granted).toBe(true);
    expect(granted.grantedAt).not.toBeNull();
    await consent.grantConsent('u1', POLITICAL_CONSENT_VERSION);
    expect(await count('political_data_consents', 'user_id = $1', 'u1')).toBe(1);
    expect(await consent.hasPoliticalConsent('u2')).toBe(false);
  });

  it('a consent to an older text no longer counts', async () => {
    await q("insert into politics.political_data_consents (user_id, policy_version) values ('u1', '2020-01-01')");
    expect(await consent.consentStatus('u1')).toMatchObject({ granted: false, grantedAt: null });
  });

  it("withdrawing deletes the user's political data and consent, keeps the account, and touches no one else", async () => {
    await seedOpinions('u1');
    await seedOpinions('u2');
    await consent.grantConsent('u1', POLITICAL_CONSENT_VERSION);
    await consent.grantConsent('u2', POLITICAL_CONSENT_VERSION);

    const deleted = await consent.withdrawConsent('u1');

    expect(deleted).toEqual({ policyVotes: 0, dailySessions: 1, pledgeCategoryPriorities: 1, quizResults: 1, ideologyProfile: 1 });
    expect(await consent.hasPoliticalConsent('u1')).toBe(false);
    for (const [table, where] of [
      ['daily_sessions', 'user_id = $1'],
      ['pledge_category_priorities', 'user_id = $1'],
      ['quiz_results', 'user_id = $1'],
      ['ideology_profiles', "subject_kind = 'user' and subject_id = $1"],
    ]) {
      expect(await count(table!, where!, 'u1'), table).toBe(0);
      expect(await count(table!, where!, 'u2'), table).toBe(1);
    }
    expect(await count('users', 'id = $1', 'u1')).toBe(1);
    expect(await consent.hasPoliticalConsent('u2')).toBe(true);
  });

  it('the gate passes a consenting user and refuses anyone else with 403 CONSENT_REQUIRED', async () => {
    await consent.grantConsent('yes', POLITICAL_CONSENT_VERSION);
    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { user: unknown }).user = { id: req.header('x-user') };
      next();
    });
    app.post('/store', consent.requirePoliticalConsent, (_req, res) => res.json({ stored: true }));
    const server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    try {
      const address = server.address();
      const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
      const post = (user: string) => fetch(`${base}/store`, { method: 'POST', headers: { 'x-user': user, connection: 'close' } });
      expect(await (await post('yes')).json()).toEqual({ stored: true });
      const refused = await post('no');
      expect(refused.status).toBe(403);
      expect((await refused.json()).error.code).toBe('CONSENT_REQUIRED');
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
