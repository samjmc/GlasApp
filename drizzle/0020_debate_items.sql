CREATE TYPE "politics"."debate_claim_type" AS ENUM('figure', 'named_source', 'cost', 'date');--> statement-breakpoint
CREATE TYPE "politics"."debate_extraction_status" AS ENUM('done', 'failed');--> statement-breakpoint
CREATE TYPE "politics"."debate_item_kind" AS ENUM('specific_claim', 'response', 'concession', 'question', 'commitment');--> statement-breakpoint
CREATE TABLE "politics"."debate_extraction_runs" (
	"debate_id" varchar(80) NOT NULL,
	"extractor_version" varchar(20) NOT NULL,
	"input_hash" varchar(16) NOT NULL,
	"status" "politics"."debate_extraction_status" NOT NULL,
	"speeches" integer NOT NULL,
	"words" integer NOT NULL,
	"irish_speeches" integer NOT NULL,
	"calls" integer NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"accepted" integer NOT NULL,
	"rejected" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"model" varchar(60),
	"error" text,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "debate_extraction_runs_debate_id_extractor_version_pk" PRIMARY KEY("debate_id","extractor_version")
);
--> statement-breakpoint
CREATE TABLE "politics"."debate_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"speech_id" varchar(120) NOT NULL,
	"member_code" varchar(120) NOT NULL,
	"kind" "politics"."debate_item_kind" NOT NULL,
	"claim_type" "politics"."debate_claim_type",
	"quote" text NOT NULL,
	"quote_start" integer NOT NULL,
	"quote_end" integer NOT NULL,
	"target_speech_id" varchar(120),
	"target_quote" text,
	"addressee" text,
	"due" text,
	"extractor_version" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "debate_items_speech_idx" ON "politics"."debate_items" USING btree ("speech_id");--> statement-breakpoint
CREATE INDEX "debate_items_member_idx" ON "politics"."debate_items" USING btree ("member_code","kind");