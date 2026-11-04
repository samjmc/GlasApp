/**
 * One run at a time ACROSS processes. The scheduler runs inside the server, and every job also
 * runs from the command line (`npm run …`) in a process of its own, so an in-process flag cannot
 * keep the two apart: two parliament syncs once deadlocked each other this way.
 *
 * A session-level Postgres advisory lock, held on one pooled connection for the whole run and
 * released when it ends (or by Postgres, if the process dies and the connection drops).
 */
import { pool } from '../db';

/** Thrown when another process (or this one) holds the job's lock. */
export class JobAlreadyRunning extends Error {
  constructor(readonly job: string) {
    super(`${job} is already running (in this process or another)`);
    this.name = 'JobAlreadyRunning';
  }
}

/** Run `fn` holding the advisory lock named `job`; throws JobAlreadyRunning if it is held. */
export async function withJobLock<T>(job: string, fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let broken = false;
  try {
    const key = `glasapp:job:${job}`;
    const { rows } = await client.query<{ locked: boolean }>('select pg_try_advisory_lock(hashtext($1)::bigint) as locked', [key]);
    if (!rows[0]?.locked) throw new JobAlreadyRunning(job);
    try {
      return await fn();
    } finally {
      // A dead connection has released the lock already; drop it rather than pool it.
      await client.query('select pg_advisory_unlock(hashtext($1)::bigint)', [key]).catch(() => (broken = true));
    }
  } finally {
    client.release(broken);
  }
}
