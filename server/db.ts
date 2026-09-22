/**
 * Database access.
 *
 * `db` (Drizzle over node-postgres) is THE data layer for everything the rebuild has
 * reached; it talks to the GlasCore Postgres directly and is not subject to RLS.
 *
 * `supabaseDb` (service-role PostgREST client) remains only for modules the rebuild has
 * not reached yet. New code must not use it. It goes when the last caller does.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import { createClient } from '@supabase/supabase-js';
import * as politics from '@shared/schema/politics';

const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Point it at the GlasCore Postgres (Supabase → Project Settings → Database → connection string).',
  );
}

const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Supabase requires TLS; the pooler presents a certificate node-postgres will not chain.
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema: politics });
export type Db = typeof db;

/**
 * Legacy service-role client. Bypasses RLS. Only for not-yet-rebuilt modules.
 * @deprecated use `db`
 */
export const supabaseDb =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: 'public' },
      })
    : null;

let shuttingDown = false;

/** Close the pool once; safe to call from more than one signal handler. */
export async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await pool.end();
}

/** True when a trivial query round-trips. Used by the startup health log. */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query('select 1');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error instanceof Error ? error.message : error);
    return false;
  }
}
