/**
 * The item analysis's ONE database read: each signed-in user's latest quiz, its answers and
 * plan only. This is the one reader of quiz_results outside server/ideology/repository.ts: it
 * is analytic and read-only, and it keeps to server/quiz/analyse/. user_id and created_at
 * never leave Postgres, and the query runs in a READ ONLY transaction, so a bug cannot write.
 */
import type { Pool, PoolClient } from 'pg';
import type { QuizRow } from './exposures';

/** Run `fn` on one pooled client inside BEGIN READ ONLY … COMMIT (ROLLBACK on error). */
export async function withReadOnly<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    try {
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    client.release();
  }
}

const LATEST_QUIZZES = `
  SELECT answers, plan FROM (
    SELECT DISTINCT ON (user_id) answers, plan
    FROM politics.quiz_results
    ORDER BY user_id, created_at DESC, id DESC
  ) latest`;

export async function loadLatestQuizzes(pool: Pool): Promise<QuizRow[]> {
  return (await withReadOnly(pool, (client) => client.query<QuizRow>(LATEST_QUIZZES))).rows;
}
