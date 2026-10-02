CREATE TYPE "politics"."absence_origin" AS ENUM('code', 'admin');--> statement-breakpoint
CREATE TYPE "politics"."leave_alert_status" AS ENUM('open', 'confirmed', 'dismissed', 'closed');--> statement-breakpoint
CREATE TABLE "politics"."td_leave_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_code" varchar(120) NOT NULL,
	"td_id" integer,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"sitting_days" integer NOT NULL,
	"status" "politics"."leave_alert_status" DEFAULT 'open' NOT NULL,
	"hints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"resolution_note" text,
	"days_when_resolved" integer
);
--> statement-breakpoint
ALTER TABLE "politics"."td_absences" ADD COLUMN "origin" "politics"."absence_origin" DEFAULT 'code' NOT NULL;--> statement-breakpoint
ALTER TABLE "politics"."td_leave_alerts" ADD CONSTRAINT "td_leave_alerts_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "td_leave_alerts_run_idx" ON "politics"."td_leave_alerts" USING btree ("member_code","start_date");--> statement-breakpoint
CREATE INDEX "td_leave_alerts_status_idx" ON "politics"."td_leave_alerts" USING btree ("status");