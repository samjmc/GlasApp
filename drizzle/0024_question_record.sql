CREATE TYPE "politics"."commitment_type" AS ENUM('action', 'follow_up', 'general');--> statement-breakpoint
CREATE TYPE "politics"."question_format" AS ENUM('oral_pq', 'topical_issue', 'leaders_questions', 'rapid');--> statement-breakpoint
CREATE TABLE "politics"."question_askers" (
	"section_id" varchar(80) NOT NULL,
	"question_number" integer NOT NULL,
	"member_code" varchar(120) NOT NULL,
	"date" date NOT NULL,
	CONSTRAINT "question_askers_section_id_question_number_pk" PRIMARY KEY("section_id","question_number")
);
--> statement-breakpoint
CREATE TABLE "politics"."question_exchanges" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"section_id" varchar(80) NOT NULL,
	"format" "politics"."question_format" NOT NULL,
	"date" date NOT NULL,
	"askers" jsonb NOT NULL,
	"from_position" integer NOT NULL,
	"to_position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politics"."question_participation" (
	"exchange_id" varchar(100) NOT NULL,
	"member_code" varchar(120) NOT NULL,
	"td_id" integer,
	"format" "politics"."question_format" NOT NULL,
	"role" "politics"."debate_role" NOT NULL,
	"asked" boolean NOT NULL,
	"secured" integer NOT NULL,
	"follow_ups" integer NOT NULL,
	"answered" boolean NOT NULL,
	"answer_claims" integer NOT NULL,
	"answer_commitments" integer NOT NULL,
	"points" integer NOT NULL,
	"rules_version" varchar(20) NOT NULL,
	CONSTRAINT "question_participation_exchange_id_member_code_pk" PRIMARY KEY("exchange_id","member_code")
);
--> statement-breakpoint
ALTER TABLE "politics"."debate_items" ADD COLUMN "commitment_type" "politics"."commitment_type";--> statement-breakpoint
ALTER TABLE "politics"."question_participation" ADD CONSTRAINT "question_participation_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_askers_member_idx" ON "politics"."question_askers" USING btree ("member_code");--> statement-breakpoint
CREATE INDEX "question_askers_date_idx" ON "politics"."question_askers" USING btree ("date");--> statement-breakpoint
CREATE INDEX "question_exchanges_section_idx" ON "politics"."question_exchanges" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "question_participation_member_idx" ON "politics"."question_participation" USING btree ("member_code");--> statement-breakpoint
CREATE INDEX "question_participation_td_idx" ON "politics"."question_participation" USING btree ("td_id");