CREATE TABLE "politics"."division_ideology" (
	"division_id" varchar(80) PRIMARY KEY NOT NULL,
	"status" varchar(12) NOT NULL,
	"ta_lean" jsonb,
	"nil_lean" jsonb,
	"nil_weight" real,
	"confidence" real,
	"salience" real,
	"division_kind" varchar(20),
	"procedural" boolean,
	"free_vote" boolean,
	"policy_topic" text,
	"ta_means" text,
	"reasoning" text,
	"model" varchar(60),
	"prompt_version" smallint NOT NULL,
	"input_hash" varchar(16) NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"classified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "division_ideology_status_chk" CHECK ("politics"."division_ideology"."status" in ('classified', 'no_signal', 'no_context', 'failed')),
	CONSTRAINT "division_ideology_kind_chk" CHECK ("politics"."division_ideology"."division_kind" in ('amendment', 'bill_stage', 'motion', 'countermotion', 'procedural', 'confidence', 'other')),
	CONSTRAINT "division_ideology_nil_weight_chk" CHECK ("politics"."division_ideology"."nil_weight" between 0 and 1),
	CONSTRAINT "division_ideology_confidence_chk" CHECK ("politics"."division_ideology"."confidence" between 0 and 1),
	CONSTRAINT "division_ideology_salience_chk" CHECK ("politics"."division_ideology"."salience" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "politics"."td_ideology_evidence" DROP CONSTRAINT "td_ideology_evidence_source_chk";--> statement-breakpoint
ALTER TABLE "politics"."divisions" ADD COLUMN "section_position" integer;--> statement-breakpoint
ALTER TABLE "politics"."division_ideology" ADD CONSTRAINT "division_ideology_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "politics"."divisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."td_ideology_evidence" ADD CONSTRAINT "td_ideology_evidence_source_chk" CHECK ("politics"."td_ideology_evidence"."source" in ('article', 'debate', 'stance', 'division'));