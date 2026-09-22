/**
 * Test-only helpers for integration tests that own a throwaway Postgres (TEST_DATABASE_URL).
 */
import fs from 'node:fs';
import path from 'node:path';
import pg, { type Pool } from 'pg';

const DRIZZLE_DIR = path.resolve(__dirname, '..', '..', 'drizzle');

/**
 * A database of its own for one test file, created on first use. Vitest runs files in
 * parallel, and two files resetting the same `politics` schema would race.
 */
export async function isolatedDatabaseUrl(baseUrl: string, name: string): Promise<string> {
  if (!/^[a-z_]+$/.test(name)) throw new Error(`Invalid test database name: ${name}`);
  const database = `glas_test_${name}`;
  const client = new pg.Client({ connectionString: baseUrl });
  await client.connect();
  try {
    await client.query(`create database ${database}`);
  } catch (error) {
    // 42P04: already exists, from an earlier run.
    if ((error as { code?: string }).code !== '42P04') throw error;
  } finally {
    await client.end();
  }
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

/** Rebuild the `politics` schema from every migration, in journal order. */
export async function resetPoliticsSchema(pool: Pool): Promise<void> {
  const journal = JSON.parse(fs.readFileSync(path.join(DRIZZLE_DIR, 'meta', '_journal.json'), 'utf8')) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  if (journal.entries.length === 0) throw new Error('drizzle/meta/_journal.json lists no migrations');
  await pool.query('drop schema if exists politics cascade');
  for (const { tag } of [...journal.entries].sort((a, b) => a.idx - b.idx)) {
    const migration = fs.readFileSync(path.join(DRIZZLE_DIR, `${tag}.sql`), 'utf8');
    // drizzle-kit separates statements with a marker; Postgres wants them one at a time.
    for (const statement of migration.split('--> statement-breakpoint')) {
      const sql = statement.trim();
      if (sql) await pool.query(sql);
    }
  }
}
