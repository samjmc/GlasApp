/**
 * Prepares the throwaway e2e database, then exits. The webServer command in
 * playwright.config.ts runs it between the build and the server start, with the server's own
 * environment, so DATABASE_URL is right from process start.
 *
 * Every run drops and re-applies the politics schema, so it is idempotent. It refuses to touch
 * anything but a local `<db>_e2e` database.
 *
 * server/* is imported dynamically, after the guards: server/db connects on import.
 */
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../../server/testing/migrations';
import { BLANKED_ENV, E2E_TDS } from './harness';

function fail(message: string): never {
  console.error(`prepare-db: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  const expected = testDatabaseUrl('e2e');
  if (!url || !expected || url !== expected) fail("refusing to run: DATABASE_URL is not testDatabaseUrl('e2e')");
  const parsed = new URL(url);
  if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') fail(`refusing to run: host ${parsed.hostname} is not local`);
  if (!parsed.pathname.endsWith('_e2e')) fail('refusing to run: the database name does not end in _e2e');
  // A variable dropped on the way here would let a local dotenv file fill it in.
  const leaked = BLANKED_ENV.filter((key) => process.env[key] !== '');
  if (leaked.length > 0) fail(`refusing to run: not blanked: ${leaked.join(', ')}`);

  await ensureDatabase(url);
  const { pool, shutdown } = await import('../../server/db');
  const { rows } = await pool.query<{ name: string }>('select current_database() as name');
  if (!rows[0]?.name.endsWith('_e2e')) fail(`refusing to run: connected to ${rows[0]?.name}, not an _e2e database`);

  const tags = await applyAllMigrations(pool);
  for (const td of E2E_TDS) {
    await pool.query('insert into politics.tds (name, party, constituency) values ($1, $2, $3)', [td.name, td.party, td.constituency]);
  }

  const { recalculateAll } = await import('../../server/ideology');
  const summary = await recalculateAll();
  if (summary.parties !== E2E_TDS.length) fail(`expected ${E2E_TDS.length} party profiles, got ${summary.parties}`);

  console.log(`prepare-db: ${rows[0].name}: ${tags.length} migrations, ${summary.tds} TDs, ${summary.parties} parties`);
  await shutdown();
  process.exit(0);
}

main().catch((error) => {
  console.error('prepare-db failed:', error);
  process.exit(1);
});
