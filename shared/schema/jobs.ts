/**
 * One row per run of a scheduled job (server/services/jobRuns.ts), so a person can see when each
 * job last ran and whether it worked without reading container logs. Read by GET /api/admin/jobs.
 */
import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { politics } from './politics';

export const jobRuns = politics.table(
  'job_runs',
  {
    id: serial('id').primaryKey(),
    /** news-ingest, news-tds, parliament-sync, division-stances, debate-items, question-items, leave-watch. */
    job: varchar('job', { length: 60 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    /** NULL while running, or when the process died mid-run. */
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** NULL while running. False when it threw, or finished with part of its work failed. */
    ok: boolean('ok'),
    /** The job's own counts: inserted, failed feeds, days failed, stopped early, and so on. */
    summary: jsonb('summary').$type<Record<string, unknown>>(),
    error: text('error'),
  },
  (t) => [index('job_runs_job_started_idx').on(t.job, sql`${t.startedAt} desc`)],
).enableRLS();

export type JobRunRow = typeof jobRuns.$inferSelect;
