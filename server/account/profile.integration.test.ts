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
  let phone: typeof import('./phone');

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    profiles = await import('./profile');
    phone = await import('./phone');
  }, 60_000);

  beforeEach(async () => {
    await dbmod.pool.query('truncate politics.users');
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
    await profiles.startPhoneVerification('user-a', '+353871234567', phone.issueCode('user-a', NOW));
    const view = profiles.publicProfile((await profiles.getProfile('user-a'))!);
    expect(view).not.toHaveProperty('phoneCodeHash');
    expect(view).not.toHaveProperty('phoneCodeAttempts');
    expect(view).toMatchObject({ phoneNumber: '+353871234567', phoneVerified: false });
  });

  it('an unverified claim does not lock the number; a verified one does', async () => {
    const num = '+353871234567';
    expect(await profiles.startPhoneVerification('user-a', num, phone.issueCode('user-a', NOW), NOW)).toBe('started');
    const b = phone.issueCode('user-b', NOW);
    expect(await profiles.startPhoneVerification('user-b', num, b, NOW)).toBe('started');
    expect(await profiles.getProfile('user-a')).toMatchObject({ phoneNumber: null, phoneCodeHash: null });
    expect(await profiles.verifyPhone('user-b', b.code, NOW)).toBe('verified');
    const later = new Date(NOW.getTime() + 5 * 60_000);
    expect(await profiles.startPhoneVerification('user-a', num, phone.issueCode('user-a', later), later)).toBe('taken');
    expect(await profiles.getProfile('user-b')).toMatchObject({ phoneNumber: num, phoneVerified: true });
  });

  it('refuses a second code inside the resend window', async () => {
    const num = '+353871234567';
    expect(await profiles.startPhoneVerification('user-a', num, phone.issueCode('user-a', NOW), NOW)).toBe('started');
    const soon = new Date(NOW.getTime() + (phone.PHONE_RESEND_SECONDS - 1) * 1000);
    expect(await profiles.startPhoneVerification('user-a', num, phone.issueCode('user-a', soon), soon)).toBe('too_soon');
    const after = new Date(NOW.getTime() + phone.PHONE_RESEND_SECONDS * 1000);
    expect(await profiles.startPhoneVerification('user-a', num, phone.issueCode('user-a', after), after)).toBe('started');
  });

  it('verifies the right code once, then the code is gone', async () => {
    const issued = phone.issueCode('user-a', NOW);
    await profiles.startPhoneVerification('user-a', '+353871234567', issued);
    expect(await profiles.verifyPhone('user-a', issued.code, NOW)).toBe('verified');
    expect((await profiles.getProfile('user-a'))!.phoneVerified).toBe(true);
    expect(await profiles.verifyPhone('user-a', issued.code, NOW)).toBe('no_code');
  });

  it('counts wrong guesses and burns the code at the limit, even under parallel guesses', async () => {
    const issued = phone.issueCode('user-a', NOW);
    await profiles.startPhoneVerification('user-a', '+353871234567', issued);
    const wrong = issued.code === '000000' ? '111111' : '000000';
    const results = await Promise.all(Array.from({ length: phone.PHONE_CODE_MAX_ATTEMPTS + 3 }, () => profiles.verifyPhone('user-a', wrong, NOW)));
    expect(results.filter((r) => r === 'wrong')).toHaveLength(phone.PHONE_CODE_MAX_ATTEMPTS);
    expect(results.filter((r) => r === 'too_many_attempts')).toHaveLength(3);
    // The right code no longer works either.
    expect(await profiles.verifyPhone('user-a', issued.code, NOW)).toBe('too_many_attempts');
    expect((await profiles.getProfile('user-a'))!.phoneVerified).toBe(false);
  });

  it('a new number resets verification and the attempt count', async () => {
    const first = phone.issueCode('user-a', NOW);
    await profiles.startPhoneVerification('user-a', '+353871234567', first);
    await profiles.verifyPhone('user-a', first.code, NOW);
    await profiles.startPhoneVerification('user-a', '+353879999999', phone.issueCode('user-a', NOW));
    expect(await profiles.getProfile('user-a')).toMatchObject({ phoneNumber: '+353879999999', phoneVerified: false, phoneCodeAttempts: 0 });
  });
});
