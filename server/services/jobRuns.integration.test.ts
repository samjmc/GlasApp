/**
 * politics.job_runs against a real Postgres: what runJob records for a run that works, one that
 * reports part of its work failed, and one that throws; and what the admin view reads back.
 *
 * Skipped unless TEST_DATABASE_URL is set. Uses its OWN database, `<db>_jobruns`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const url = testDatabaseUrl('jobruns');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.LOG_LEVEL = 'silent';
}

run('job runs against Postgres', () => {
  let dbmod: typeof import('../db');
  let jobRuns: typeof import('./jobRuns');
  const rows = async () =>
    (await dbmod.pool.query('select job, ok, summary, error, finished_at is not null as finished from politics.job_runs order by id')).rows;

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    jobRuns = await import('./jobRuns');
  }, 60_000);

  beforeEach(async () => {
    await dbmod.pool.query('truncate politics.job_runs restart identity');
  });

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('records the start before the job runs, and the outcome when it ends', async () => {
    let seenWhileRunning: unknown[] = [];
    await jobRuns.runJob('news-ingest', async () => {
      seenWhileRunning = await rows();
      return { ok: true, summary: { inserted: 12 } };
    });
    expect(seenWhileRunning).toEqual([{ job: 'news-ingest', ok: null, summary: null, error: null, finished: false }]);
    expect(await rows()).toEqual([{ job: 'news-ingest', ok: true, summary: { inserted: 12 }, error: null, finished: true }]);
  });

  it('a job that reports part of its work failed is not ok; one that throws is recorded and never rethrown', async () => {
    await jobRuns.runJob('parliament-sync', async () => ({ ok: false, summary: { failedDays: ['2026-10-01'] } }));
    await expect(
      jobRuns.runJob('debate-items', async () => {
        throw new Error('402 Insufficient Balance');
      }),
    ).resolves.toBeUndefined();
    expect(await rows()).toEqual([
      { job: 'parliament-sync', ok: false, summary: { failedDays: ['2026-10-01'] }, error: null, finished: true },
      { job: 'debate-items', ok: false, summary: {}, error: '402 Insufficient Balance', finished: true },
    ]);
  });

  it('the admin view gives the latest runs of each job, newest first', async () => {
    for (let i = 1; i <= 3; i++) await jobRuns.runJob('news-tds', async () => ({ ok: true, summary: { run: i } }));
    await jobRuns.runJob('leave-watch', async () => ({ ok: true, summary: {} }));
    const recent = await jobRuns.recentJobRuns(2);
    expect(Object.keys(recent).sort()).toEqual(['leave-watch', 'news-tds']);
    expect(recent['news-tds']!.map((r) => r.summary)).toEqual([{ run: 3 }, { run: 2 }]);
    expect(recent['leave-watch']).toHaveLength(1);
  });

  it('a job still runs when its record cannot be written', async () => {
    const job = vi.fn(async () => ({ ok: true, summary: {} }));
    const broken = { insert: () => ({ values: () => ({ returning: async () => Promise.reject(new Error('db down')) }) }) } as unknown as typeof dbmod.db;
    await jobRuns.runJob('news-ingest', job, broken);
    expect(job).toHaveBeenCalledTimes(1);
  });
});
