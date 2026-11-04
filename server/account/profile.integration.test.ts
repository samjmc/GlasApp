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

  it('edits only the fields given', async () => {
    await profiles.updateProfile('user-a', { firstName: 'Máire', county: 'Galway' });
    const row = await profiles.updateProfile('user-a', { bio: 'Hi' });
    expect(row).toMatchObject({ firstName: 'Máire', county: 'Galway', bio: 'Hi' });
    expect(await profiles.getProfile('user-a')).toMatchObject({ firstName: 'Máire', county: 'Galway', bio: 'Hi' });
  });

  it('has no phone columns any more (migration 0034)', async () => {
    const cols = await dbmod.pool.query("select column_name from information_schema.columns where table_schema = 'politics' and table_name = 'users' and column_name like 'phone%'");
    expect(cols.rows).toEqual([]);
  });
});
