CREATE TYPE "politics"."debate_kind" AS ENUM('bill_stage', 'motion', 'statements', 'leaders_questions', 'questions', 'topical_issue', 'procedural', 'other');--> statement-breakpoint
CREATE TYPE "politics"."debate_mover_source" AS ENUM('bill_sponsor', 'office_holder', 'first_speaker');--> statement-breakpoint
CREATE TABLE "politics"."debates" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"kind" "politics"."debate_kind" NOT NULL,
	"title" text NOT NULL,
	"bill_id" varchar(20),
	"first_date" date NOT NULL,
	"last_date" date NOT NULL,
	"section_count" integer NOT NULL,
	"mover_member_code" varchar(120),
	"mover_source" "politics"."debate_mover_source"
);
--> statement-breakpoint
ALTER TABLE "politics"."debate_sections" ADD COLUMN "parent_title" text;--> statement-breakpoint
ALTER TABLE "politics"."debate_sections" ADD COLUMN "debate_id" varchar(80);--> statement-breakpoint
CREATE INDEX "debates_kind_date_idx" ON "politics"."debates" USING btree ("kind","first_date");--> statement-breakpoint
CREATE INDEX "debate_sections_debate_idx" ON "politics"."debate_sections" USING btree ("debate_id");