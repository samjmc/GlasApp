/**
 * The app's own login, `glasapp_app` (migration 0036, sweep D15), against a real Postgres: what it
 * can do is exactly what the app does (read and write rows in politics, sequences, advisory locks),
 * and it cannot change the schema, empty a table, read drizzle's journal or touch `public`.
 *
 * Every politics table has RLS (0026), so a table without the `glasapp_app_all` policy reads as EMPTY
 * to the app, with no error. The first test fails on any such table: a migration that creates a
 * table must add the policy too (docs/deploy.md, "A new table").
 *
 * Migrations run through drizzle's own migrator, as `npm run db:migrate` does on GlasCore, so
 * drizzle.__drizzle_migrations is real. The role is NOLOGIN here: the tests SET ROLE to it. It is
 * cluster-wide and left in place, so other suites applying 0036 at the same moment find it whole.
 * Skipped unless TEST_DATABASE_URL is set; uses its own database `<db>_dbrole`.
 */
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pkg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureDatabase, testDatabaseUrl } from './testing/migrations';

const url = testDatabaseUrl('dbrole');
const run = describe.skipIf(!url);
const ROLE = 'glasapp_app';
const POLICY = 'glasapp_app_all';

/** politics tables with no glasapp_app_all policy: the app would read each as empty. */
const MISSING_POLICY = `
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'politics' and c.relkind in ('r', 'p')
    and not exists (select 1 from pg_policies p where p.schemaname = 'politics' and p.tablename = c.relname and p.policyname = '${POLICY}')
  order by 1`;

run('the glasapp_app login (real Postgres)', () => {
  let owner: pkg.Pool;
  let app: pkg.Client;
  const q = (text: string, params: unknown[] = []) => owner.query(text, params);
  const asApp = (text: string, params: unknown[] = []) => app.query(text, params);

  beforeAll(async () => {
    await ensureDatabase(url!);
    owner = new pkg.Pool({ connectionString: url });
    await q(`do $$ begin if not exists (select 1 from pg_roles where rolname = '${ROLE}') then create role ${ROLE} nologin; end if; end $$`);
    await q('drop schema if exists politics cascade');
    await q('drop schema if exists drizzle cascade');
    await migrate(drizzle(owner), { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
    // Another app's table, as GlasIntelligence has in `public` on GlasCore.
    await q('drop table if exists public.other_app_rows');
    await q("create table public.other_app_rows (id int); insert into public.other_app_rows values (1)");
    // Reference rows the role must be able to SEE (without the policy it would get none, silently).
    await q("insert into politics.tds (name) values ('Role Test TD')");
    await q("insert into politics.policy_questions (id, article_id, question, policy_domain, policy_topic, headline) values (900001, 900001, 'q', 'other', 't', 'h')");
    await q("insert into politics.policy_question_options (question_id, option_key, label, position) values (900001, 'a', 'A', 1)");
    app = new pkg.Client({ connectionString: url });
    await app.connect();
    await asApp(`set role ${ROLE}`);
  }, 120_000);

  afterAll(async () => {
    await app?.end();
    await owner?.end();
  });

  it('every politics table has the glasapp_app_all policy, for every command, on every row', async () => {
    const { rows: tables } = await q("select count(*)::int as n from pg_tables where schemaname = 'politics'");
    // Guard against a vacuous pass: the schema has dozens of tables.
    expect(tables[0].n).toBeGreaterThan(40);
    expect((await q(MISSING_POLICY)).rows.map((r) => r.relname)).toEqual([]);
    const { rows: shapes } = await q(
      `select distinct cmd, roles::text as roles, qual, with_check from pg_policies where schemaname = 'politics' and policyname = $1`,
      [POLICY],
    );
    expect(shapes).toEqual([{ cmd: 'ALL', roles: `{${ROLE}}`, qual: 'true', with_check: 'true' }]);
  });

  it('has row rights on every politics table and sequence, and no more', async () => {
    const { rows } = await q(
      `select c.relname,
              has_table_privilege($1, c.oid, 'select, insert, update, delete') as dml,
              has_table_privilege($1, c.oid, 'truncate') or has_table_privilege($1, c.oid, 'references')
                or has_table_privilege($1, c.oid, 'trigger') as extra
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'politics' and c.relkind in ('r', 'p')`,
      [ROLE],
    );
    expect(rows.length).toBeGreaterThan(40);
    expect(rows.filter((r) => !r.dml || r.extra).map((r) => r.relname)).toEqual([]);
    const { rows: seqs } = await q(
      `select c.relname, has_sequence_privilege($1, c.oid, 'usage') as ok from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'politics' and c.relkind = 'S'`,
      [ROLE],
    );
    expect(seqs.length).toBeGreaterThan(10);
    expect(seqs.filter((s) => !s.ok).map((s) => s.relname)).toEqual([]);
    const { rows: role } = await q('select rolsuper, rolbypassrls from pg_roles where rolname = $1', [ROLE]);
    expect(role[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('reads, writes and deletes what the app does', async () => {
    expect((await asApp('select current_user as u')).rows[0].u).toBe(ROLE);
    // Reads see the owner's rows.
    expect((await asApp("select count(*)::int as n from politics.tds where name = 'Role Test TD'")).rows[0].n).toBe(1);
    expect((await asApp('select count(*)::int as n from politics.policy_question_options where question_id = 900001')).rows[0].n).toBe(1);
    expect((await asApp('select count(*)::int as n from politics.news_articles')).rows[0].n).toBe(0);

    // A user and their vote: insert, upsert, update, and a delete that cascades.
    await asApp("insert into politics.users (id, county) values ('role-user', 'Cork')");
    await asApp("insert into politics.users (id, county) values ('role-user', 'Kerry') on conflict (id) do update set county = excluded.county");
    await asApp("insert into politics.policy_votes (user_id, question_id, option_key, source) values ('role-user', 900001, 'a', 'article')");
    await asApp("update politics.policy_votes set updated_at = now() where user_id = 'role-user'");
    expect((await asApp("select county from politics.users where id = 'role-user'")).rows).toEqual([{ county: 'Kerry' }]);
    expect((await asApp("delete from politics.users where id = 'role-user' returning id")).rowCount).toBe(1);
    expect((await q("select count(*)::int as n from politics.policy_votes where user_id = 'role-user'")).rows[0].n).toBe(0);

    // job_runs takes its id from a serial, so this needs the sequence grant.
    const { rows: started } = await asApp("insert into politics.job_runs (job) values ('role-test') returning id");
    expect(started[0].id).toBeGreaterThan(0);
    await asApp('update politics.job_runs set finished_at = now(), ok = true where id = $1', [started[0].id]);
    expect((await asApp('delete from politics.job_runs where id = $1', [started[0].id])).rowCount).toBe(1);

    // The job lock (server/services/jobLock.ts) and the transaction locks the repositories take.
    expect((await asApp("select pg_try_advisory_lock(hashtext('glasapp:job:role-test')::bigint) as ok")).rows[0].ok).toBe(true);
    expect((await asApp("select pg_advisory_unlock(hashtext('glasapp:job:role-test')::bigint) as ok")).rows[0].ok).toBe(true);
    await asApp('begin');
    await asApp("select pg_advisory_xact_lock(hashtext('role-test'))");
    await asApp('commit');
  });

  it('cannot change the schema, empty a table, read the migration journal or touch public', async () => {
    const refused: Array<[string, RegExp]> = [
      ['create table politics.role_made (id int)', /permission denied for schema politics/],
      ['drop table politics.tds', /must be owner of table tds/],
      ['alter table politics.tds add column role_col int', /must be owner of table tds/],
      ['truncate politics.job_runs', /permission denied for table job_runs/],
      ['create policy role_made on politics.tds using (true)', /must be owner of table tds/],
      ['select * from drizzle.__drizzle_migrations', /permission denied for schema drizzle/],
      ['select * from public.other_app_rows', /permission denied for table other_app_rows/],
      ['create table public.role_made (id int)', /permission denied for schema public/],
    ];
    for (const [statement, error] of refused) await expect(asApp(statement), statement).rejects.toThrow(error);
    // The refusals are not just missing objects: the owner sees the journal 0036 wrote into.
    expect((await q('select count(*)::int as n from drizzle.__drizzle_migrations')).rows[0].n).toBeGreaterThan(30);
  });

  it('a table made by a later migration gets the grants but reads as empty until it has the policy', async () => {
    try {
      // What a future migration does, as the owner: the default privileges from 0036 grant the rest.
      await q('create table politics.later_rows (id serial primary key, note text)');
      await q('alter table politics.later_rows enable row level security');
      await q("insert into politics.later_rows (note) values ('owner')");
      expect((await asApp('select count(*)::int as n from politics.later_rows')).rows[0].n).toBe(0);
      expect((await q(MISSING_POLICY)).rows.map((r) => r.relname)).toEqual(['later_rows']);

      // The line docs/deploy.md tells that migration to add.
      await q(`do $$ begin if exists (select 1 from pg_roles where rolname = 'glasapp_app') then
                 create policy glasapp_app_all on politics.later_rows for all to glasapp_app using (true) with check (true);
               end if; end $$`);
      await asApp("insert into politics.later_rows (note) values ('app')");
      expect((await asApp('select note from politics.later_rows order by id')).rows).toEqual([{ note: 'owner' }, { note: 'app' }]);
      expect((await q(MISSING_POLICY)).rows).toEqual([]);
    } finally {
      await q('drop table if exists politics.later_rows');
    }
  });
});
