/**
 * Every scheduled job runs through runJob: one politics.job_runs row per run (started, finished,
 * ok, the job's own counts), and one structured log line with `job` and `ok`. A job that throws is
 * recorded and logged, never rethrown: a cron callback has no one to throw to.
 *
 * "ok" is the job's own verdict, not just "did not throw": a sync with a failed day, an ingest
 * that held items back, a run stopped by an empty model account all report ok: false.
 */
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { jobRuns, type JobRunRow } from '@shared/schema/jobs';
import { db, type Db } from '../db';
import { logger } from '../utils/logger';

export interface JobOutcome {
  ok: boolean;
  summary: Record<string, unknown>;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Run one job and record it. A failure to write the record is logged; the job still runs. */
export async function runJob(job: string, run: () => Promise<JobOutcome>, database: Db = db): Promise<void> {
  let id: number | null = null;
  try {
    [{ id }] = await database.insert(jobRuns).values({ job }).returning({ id: jobRuns.id });
  } catch (error) {
    logger.error({ job, err: error }, 'job run: could not record the start');
  }
  let outcome: JobOutcome & { error?: string };
  try {
    outcome = await run();
  } catch (error) {
    outcome = { ok: false, summary: {}, error: message(error) };
  }
  if (outcome.ok) logger.info({ job, ok: true, ...outcome.summary }, `job ${job} finished`);
  else logger.error({ job, ok: false, error: outcome.error, ...outcome.summary }, `job ${job} failed`);
  if (id === null) return;
  try {
    await database
      .update(jobRuns)
      .set({ finishedAt: sql`now()`, ok: outcome.ok, summary: outcome.summary, error: outcome.error ?? null })
      .where(eq(jobRuns.id, id));
  } catch (error) {
    logger.error({ job, err: error }, 'job run: could not record the end');
  }
}

/** Runs kept per job in the admin view. */
export const RECENT_RUNS = 10;

/** The latest runs of each job, newest first. */
export async function recentJobRuns(perJob = RECENT_RUNS, database: Db = db): Promise<Record<string, JobRunRow[]>> {
  const rows = await database.execute<{ id: number }>(sql`
    select id from (
      select id, row_number() over (partition by job order by started_at desc, id desc) as n from ${jobRuns}
    ) ranked where n <= ${perJob}`);
  const ids = rows.rows.map((r) => Number(r.id));
  if (ids.length === 0) return {};
  const runs = await database
    .select()
    .from(jobRuns)
    .where(inArray(jobRuns.id, ids))
    .orderBy(jobRuns.job, desc(jobRuns.startedAt), desc(jobRuns.id));
  const byJob: Record<string, JobRunRow[]> = {};
  for (const run of runs) (byJob[run.job] ??= []).push(run);
  return byJob;
}
