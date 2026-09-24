CREATE TABLE "politics"."ideology_profiles" (
	"subject_kind" varchar(10) NOT NULL,
	"subject_id" text NOT NULL,
	"economic" real NOT NULL,
	"social" real NOT NULL,
	"cultural" real NOT NULL,
	"authority" real NOT NULL,
	"environmental" real NOT NULL,
	"welfare" real NOT NULL,
	"globalism" real NOT NULL,
	"technocratic" real NOT NULL,
	"total_weight" real NOT NULL,
	"evidence_count" integer NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ideology_profiles_subject_kind_subject_id_pk" PRIMARY KEY("subject_kind","subject_id"),
	CONSTRAINT "ideology_profiles_subject_chk" CHECK ("politics"."ideology_profiles"."subject_kind" in ('user', 'td', 'party'))
);
--> statement-breakpoint
CREATE TABLE "politics"."quiz_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"answers" jsonb NOT NULL,
	"economic" real NOT NULL,
	"social" real NOT NULL,
	"cultural" real NOT NULL,
	"authority" real NOT NULL,
	"environmental" real NOT NULL,
	"welfare" real NOT NULL,
	"globalism" real NOT NULL,
	"technocratic" real NOT NULL,
	"ideology" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politics"."td_ideology_evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"td_id" integer NOT NULL,
	"source" varchar(20) NOT NULL,
	"source_ref" text NOT NULL,
	"policy_topic" text,
	"economic" real,
	"social" real,
	"cultural" real,
	"authority" real,
	"environmental" real,
	"welfare" real,
	"globalism" real,
	"technocratic" real,
	"weight" real NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "td_ideology_evidence_source_chk" CHECK ("politics"."td_ideology_evidence"."source" in ('article', 'debate')),
	CONSTRAINT "td_ideology_evidence_weight_chk" CHECK ("politics"."td_ideology_evidence"."weight" > 0)
);
--> statement-breakpoint
ALTER TABLE "politics"."td_ideology_evidence" ADD CONSTRAINT "td_ideology_evidence_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quiz_results_user_created_idx" ON "politics"."quiz_results" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "td_ideology_evidence_source_idx" ON "politics"."td_ideology_evidence" USING btree ("td_id","source","source_ref");--> statement-breakpoint
CREATE INDEX "td_ideology_evidence_td_idx" ON "politics"."td_ideology_evidence" USING btree ("td_id","observed_at");