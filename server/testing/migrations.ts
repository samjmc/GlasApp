/**
 * Test support for the real-Postgres integration tests.
 *
 * Each domain's test gets its OWN database, `<db>_<suffix>`, because every one of them
 * drops and recreates the `politics` schema, and vitest runs test files in parallel.
 * Migrations are applied in drizzle's journal order, so a new migration is picked up
 * without editing any test.
 */
import fs from 'node:fs';
import path from 'node:path';
import pkg from 'pg';

const DRIZZLE_DIR = path.resolve(__dirname, '..', '..', 'drizzle');

/** `TEST_DATABASE_URL` with its database name suffixed, or undefined when unset. */
export function testDatabaseUrl(suffix: string): string | undefined {
  const base = process.env.TEST_DATABASE_URL;
  if (!base) return undefined;
  const url = new URL(base);
  url.pathname = `/${url.pathname.replace(/^\//, '') || 'postgres'}_${suffix}`;
  return url.toString();
}

/** Create the per-test database if it does not exist yet. */
export async function ensureDatabase(url: string): Promise<void> {
  const name = new URL(url).pathname.slice(1);
  const admin = new pkg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await admin.connect();
  try {
    const exists = await admin.query('select 1 from pg_database where datname = $1', [name]);
    if (exists.rowCount === 0) await admin.query(`create database "${name.replace(/"/g, '""')}"`);
  } finally {
    await admin.end();
  }
}

/** Drop the politics schema and apply every migration in journal order. */
export async function applyAllMigrations(pool: { query: (sql: string) => Promise<unknown> }): Promise<string[]> {
  const journal = JSON.parse(fs.readFileSync(path.join(DRIZZLE_DIR, 'meta', '_journal.json'), 'utf8')) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  const tags = [...journal.entries].sort((a, b) => a.idx - b.idx).map((e) => e.tag);
  await pool.query('drop schema if exists politics cascade');
  for (const tag of tags) {
    const migration = fs.readFileSync(path.join(DRIZZLE_DIR, `${tag}.sql`), 'utf8');
    // drizzle-kit separates statements with a marker; Postgres wants them one at a time.
    for (const statement of migration.split('--> statement-breakpoint')) {
      const sql = statement.trim();
      if (sql) await pool.query(sql);
    }
  }
  return tags;
}
