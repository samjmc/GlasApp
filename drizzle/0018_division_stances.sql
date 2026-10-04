CREATE TABLE "politics"."division_readings" (
	"division_id" varchar(80) PRIMARY KEY NOT NULL,
	"status" varchar(16) NOT NULL,
	"reject_reason" varchar(20),
	"division_kind" varchar(16),
	"ta_means" text,
	"quote_block" varchar(8),
	"quote" text,
	"policy_domain" varchar(40),
	"second_domain" varchar(40),
	"meaning_confidence" real,
	"match_confidence" real,
	"candidate_ids" integer[],
	"question_id" integer,
	"ta_option_key" varchar(12),
	"nil_option_key" varchar(12),
	"match_reason" text,
	"model" varchar(60),
	"meaning_prompt_version" smallint,
	"match_prompt_version" smallint,
	"input_hash" varchar(16) NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_checked_at" timestamp with time zone,
	CONSTRAINT "division_readings_status_chk" CHECK ("politics"."division_readings"."status" in ('matched', 'no_match', 'no_candidates', 'procedural', 'rejected', 'no_context', 'failed')),
	CONSTRAINT "division_readings_reject_reason_chk" CHECK ("politics"."division_readings"."reject_reason" in ('invalid', 'quote_not_found', 'unsure', 'ambiguous') and ("politics"."division_readings"."status" = 'rejected') = ("politics"."division_readings"."reject_reason" is not null)),
	CONSTRAINT "division_readings_kind_chk" CHECK ("politics"."division_readings"."division_kind" in ('amendment', 'words_stand', 'as_amended', 'motion', 'bill_stage', 'confidence', 'procedural', 'other', 'unclear')),
	CONSTRAINT "division_readings_domain_chk" CHECK ("politics"."division_readings"."policy_domain" in ('foreign_policy', 'humanitarian_aid', 'housing', 'health', 'economy', 'taxation', 'climate', 'immigration', 'justice', 'education', 'infrastructure', 'agriculture', 'technology', 'other')),
	CONSTRAINT "division_readings_second_domain_chk" CHECK ("politics"."division_readings"."second_domain" in ('foreign_policy', 'humanitarian_aid', 'housing', 'health', 'economy', 'taxation', 'climate', 'immigration', 'justice', 'education', 'infrastructure', 'agriculture', 'technology', 'other')),
	CONSTRAINT "division_readings_confidence_chk" CHECK ("politics"."division_readings"."meaning_confidence" between 0 and 1 and "politics"."division_readings"."match_confidence" between 0 and 1),
	CONSTRAINT "division_readings_matched_chk" CHECK (("politics"."division_readings"."status" = 'matched') = ("politics"."division_readings"."question_id" is not null)),
	CONSTRAINT "division_readings_answer_chk" CHECK (("politics"."division_readings"."question_id" is null) = ("politics"."division_readings"."ta_option_key" is null)),
	CONSTRAINT "division_readings_nil_chk" CHECK ("politics"."division_readings"."nil_option_key" is null or "politics"."division_readings"."nil_option_key" <> "politics"."division_readings"."ta_option_key"),
	CONSTRAINT "division_readings_quoted_chk" CHECK ("politics"."division_readings"."status" <> 'matched' or ("politics"."division_readings"."quote" is not null and "politics"."division_readings"."ta_means" is not null))
);
--> statement-breakpoint
ALTER TABLE "politics"."td_stances" DROP CONSTRAINT "td_stances_quote_kind_chk";--> statement-breakpoint
ALTER TABLE "politics"."td_stances" ALTER COLUMN "article_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "politics"."divisions" ADD COLUMN "section_position" integer;--> statement-breakpoint
ALTER TABLE "politics"."td_stances" ADD COLUMN "division_id" varchar(80);--> statement-breakpoint
ALTER TABLE "politics"."td_stances" ADD COLUMN "division_vote" varchar(3);--> statement-breakpoint
ALTER TABLE "politics"."td_stances" ADD COLUMN "discipline" varchar(8);--> statement-breakpoint
ALTER TABLE "politics"."division_readings" ADD CONSTRAINT "division_readings_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "politics"."divisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."division_readings" ADD CONSTRAINT "division_readings_ta_option_fk" FOREIGN KEY ("question_id","ta_option_key") REFERENCES "politics"."policy_question_options"("question_id","option_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."division_readings" ADD CONSTRAINT "division_readings_nil_option_fk" FOREIGN KEY ("question_id","nil_option_key") REFERENCES "politics"."policy_question_options"("question_id","option_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."td_stances" ADD CONSTRAINT "td_stances_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "politics"."divisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "td_stances_td_division_idx" ON "politics"."td_stances" USING btree ("td_id","division_id");--> statement-breakpoint
ALTER TABLE "politics"."td_stances" ADD CONSTRAINT "td_stances_source_chk" CHECK (("politics"."td_stances"."article_id" is null) <> ("politics"."td_stances"."division_id" is null));--> statement-breakpoint
ALTER TABLE "politics"."td_stances" ADD CONSTRAINT "td_stances_division_kind_chk" CHECK (("politics"."td_stances"."quote_kind" = 'division') = ("politics"."td_stances"."division_id" is not null));--> statement-breakpoint
ALTER TABLE "politics"."td_stances" ADD CONSTRAINT "td_stances_division_vote_chk" CHECK ("politics"."td_stances"."division_vote" in ('ta', 'nil') and ("politics"."td_stances"."division_vote" is null) = ("politics"."td_stances"."division_id" is null));--> statement-breakpoint
ALTER TABLE "politics"."td_stances" ADD CONSTRAINT "td_stances_discipline_chk" CHECK ("politics"."td_stances"."discipline" in ('free', 'rebel', 'whip') and ("politics"."td_stances"."discipline" is null) = ("politics"."td_stances"."division_id" is null));--> statement-breakpoint
ALTER TABLE "politics"."td_stances" ADD CONSTRAINT "td_stances_quote_kind_chk" CHECK ("politics"."td_stances"."quote_kind" in ('direct', 'paraphrase', 'division'));