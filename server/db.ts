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

/**
 * Connections this process may hold. A robot run (npm run robots) showed 10 saturating: up to 25
 * requests waiting at 20 users at once. GlasCore allows 60 connections, about 10 of them Supabase's
 * own, and GlasIntelligence shares the rest; through the session pooler this must also stay within
 * the pooler's Pool Size (Supabase → Database → Connection pooling). Raise both together.
 */
export const DB_POOL_MAX = poolMax(process.env.DB_POOL_MAX);

export function poolMax(value: string | undefined): number {
  if (value === undefined || value === '') return 15;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 50) throw new Error(`DB_POOL_MAX must be a whole number from 1 to 50, not "${value}"`);
  return n;
}

export const pool = new Pool({
  connectionString,
  max: DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Supabase requires TLS; the pooler presents a certificate node-postgres will not chain.
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

// A pooled client that is idle when the server drops it (a pooler restart, a network blip) emits
// 'error' on the POOL. With no listener node-postgres rethrows it as an uncaught exception and the
// process dies. Log it instead: the pool discards the broken client and opens a new one on demand.
pool.on('error', (error) => {
  console.error('Database pool: an idle connection failed and was discarded:', error.message);
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
