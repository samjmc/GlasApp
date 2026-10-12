/**
 * politics.users against a real Postgres. Skipped unless TEST_DATABASE_URL is set; uses its
 * own database `<db>_profile`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const url = testDatabaseUrl('profile');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
}

const NOW = new Date('2026-09-25T12:00:00Z');

run('profile store against Postgres', () => {
  let dbmod: typeof import('../db');
  let profiles: typeof import('./profile');

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    profiles = await import('./profile');
  }, 60_000);

  beforeEach(async () => {
    // cascade: the political tables reference politics.users (migration 0027).
    await dbmod.pool.query('truncate politics.users cascade');
  });

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('creates the row on first sight, once', async () => {
    const [a, b] = await Promise.all([profiles.ensureProfile('user-a'), profiles.ensureProfile('user-a')]);
    expect(a.id).toBe('user-a');
    expect(b.id).toBe('user-a');
    expect((await dbmod.pool.query('select count(*)::int n from politics.users')).rows[0].n).toBe(1);
  });

  it('edits only the fields given, and never exposes the code hash', async () => {
    await profiles.updateProfile('user-a', { firstName: 'Máire', county: 'Galway' });
    const row = await profiles.updateProfile('user-a', { bio: 'Hi' });
    expect(row).toMatchObject({ firstName: 'Máire', county: 'Galway', bio: 'Hi' });
    // Phone verification is gone but the columns remain: a row that still holds a code stays hidden.
    await dbmod.pool.query(
      "update politics.users set phone_code_hash = 'h', phone_code_expires_at = $1, phone_code_attempts = 3 where id = 'user-a'",
      [NOW],
    );
    const stored = (await profiles.getProfile('user-a'))!;
    expect(stored).toMatchObject({ phoneCodeHash: 'h', phoneCodeAttempts: 3 });
    const view = profiles.publicProfile(stored);
    expect(view).not.toHaveProperty('phoneCodeHash');
    expect(view).not.toHaveProperty('phoneCodeExpiresAt');
    expect(view).not.toHaveProperty('phoneCodeAttempts');
    expect(view).toMatchObject({ firstName: 'Máire', county: 'Galway', bio: 'Hi' });
  });
});
