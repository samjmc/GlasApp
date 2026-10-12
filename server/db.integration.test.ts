/**
 * Database-level protection of the politics schema (migration 0026), against a real Postgres:
 * every table has row level security, so a new table without `.enableRLS()` fails here, and
 * Supabase's public API roles (anon, authenticated) end with no access to the schema.
 *
 * Skipped unless TEST_DATABASE_URL is set; uses its own database `<db>_rls`. The app and these tests
 * connect as the tables' owner, which RLS without FORCE does not restrict.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyAllMigrations, applyMigration, ensureDatabase, testDatabaseUrl } from './testing/migrations';

const url = testDatabaseUrl('rls');
const run = describe.skipIf(!url);

if (url) process.env.DATABASE_URL = url;

const API_ROLES = ['anon', 'authenticated'] as const;

run('politics schema protection against Postgres', () => {
  let dbmod: typeof import('./db');
  const q = (sql: string, params: unknown[] = []) => dbmod.pool.query(sql, params);

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('./db');
    await applyAllMigrations(dbmod.pool);
  }, 60_000);

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('every table in politics has row level security enabled', async () => {
    const { rows } = await q(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'politics' and c.relkind in ('r', 'p') order by 1`,
    );
    // Guard against a vacuous pass: the schema has dozens of tables.
    expect(rows.length).toBeGreaterThan(40);
    expect(rows.filter((r: { relrowsecurity: boolean }) => !r.relrowsecurity).map((r: { relname: string }) => r.relname)).toEqual([]);
  });

  it("takes every grant on the schema and its tables away from Supabase's API roles", async () => {
    // Supabase's roles, as they exist there; CI's Postgres does not have them. NOLOGIN, cluster-wide,
    // and left in place: another suite may be applying 0026 at this moment and must find them whole.
    for (const role of API_ROLES) {
      await q(`do $$ begin if not exists (select 1 from pg_roles where rolname = '${role}') then create role ${role} nologin; end if; end $$`);
    }
    await q('grant usage on schema politics to anon, authenticated');
    await q('grant select, insert on all tables in schema politics to anon, authenticated');
    // The grants took, so the check below can fail.
    expect((await q("select has_schema_privilege('anon', 'politics', 'usage') as ok")).rows[0].ok).toBe(true);

    await applyMigration(dbmod.pool, '0026_politics_rls');

    for (const role of API_ROLES) {
      const { rows } = await q(
        `select has_schema_privilege($1, 'politics', 'usage') as usage,
                has_table_privilege($1, 'politics.policy_votes', 'select') as reads,
                has_table_privilege($1, 'politics.users', 'insert') as writes`,
        [role],
      );
      expect(rows[0]).toEqual({ usage: false, reads: false, writes: false });
    }
  });
});
