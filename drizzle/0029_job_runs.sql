-- One row per scheduled-job run (sweep P23), written by server/services/jobRuns.ts and read by
-- GET /api/admin/jobs. A new, empty table: nothing existing is changed or deleted.
CREATE TABLE "politics"."job_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job" varchar(60) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"summary" jsonb,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "politics"."job_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "job_runs_job_started_idx" ON "politics"."job_runs" USING btree ("job","started_at" desc);
