CREATE TYPE "politics"."division_vote" AS ENUM('ta', 'nil', 'staon');--> statement-breakpoint
CREATE TABLE "politics"."debate_sections" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"parent_id" varchar(80),
	"speech_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politics"."debate_speeches" (
	"id" varchar(120) PRIMARY KEY NOT NULL,
	"section_id" varchar(80) NOT NULL,
	"date" date NOT NULL,
	"position" integer NOT NULL,
	"member_code" varchar(120),
	"td_id" integer,
	"role" text,
	"is_presiding" boolean DEFAULT false NOT NULL,
	"text" text NOT NULL,
	"word_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politics"."division_votes" (
	"division_id" varchar(80) NOT NULL,
	"member_code" varchar(120) NOT NULL,
	"td_id" integer,
	"vote" "politics"."division_vote" NOT NULL,
	CONSTRAINT "division_votes_division_id_member_code_pk" PRIMARY KEY("division_id","member_code")
);
--> statement-breakpoint
CREATE TABLE "politics"."divisions" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"uri" text NOT NULL,
	"house_no" smallint NOT NULL,
	"date" date NOT NULL,
	"held_at" timestamp with time zone,
	"subject" text,
	"outcome" varchar(40),
	"debate_title" text,
	"debate_section_id" varchar(80),
	"is_bill" boolean DEFAULT false NOT NULL,
	"ta_count" integer NOT NULL,
	"nil_count" integer NOT NULL,
	"staon_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "divisions_uri_unique" UNIQUE("uri")
);
--> statement-breakpoint
CREATE TABLE "politics"."parliament_sync_state" (
	"feed" varchar(20) PRIMARY KEY NOT NULL,
	"through_date" date,
	"last_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_result" text
);
--> statement-breakpoint
CREATE TABLE "politics"."td_parliament_stats" (
	"td_id" integer PRIMARY KEY NOT NULL,
	"member_since" date NOT NULL,
	"is_presiding" boolean DEFAULT false NOT NULL,
	"divisions_eligible" integer NOT NULL,
	"votes_cast" integer NOT NULL,
	"sitting_days" integer NOT NULL,
	"sections_spoken" integer NOT NULL,
	"speeches" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "politics"."debate_speeches" ADD CONSTRAINT "debate_speeches_section_id_debate_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "politics"."debate_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."debate_speeches" ADD CONSTRAINT "debate_speeches_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."division_votes" ADD CONSTRAINT "division_votes_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "politics"."divisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."division_votes" ADD CONSTRAINT "division_votes_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."td_parliament_stats" ADD CONSTRAINT "td_parliament_stats_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debate_sections_date_idx" ON "politics"."debate_sections" USING btree ("date");--> statement-breakpoint
CREATE INDEX "debate_speeches_section_idx" ON "politics"."debate_speeches" USING btree ("section_id","position");--> statement-breakpoint
CREATE INDEX "debate_speeches_td_idx" ON "politics"."debate_speeches" USING btree ("td_id","date");--> statement-breakpoint
CREATE INDEX "debate_speeches_member_idx" ON "politics"."debate_speeches" USING btree ("member_code");--> statement-breakpoint
CREATE INDEX "division_votes_td_idx" ON "politics"."division_votes" USING btree ("td_id");--> statement-breakpoint
CREATE INDEX "division_votes_member_idx" ON "politics"."division_votes" USING btree ("member_code");--> statement-breakpoint
CREATE INDEX "divisions_date_idx" ON "politics"."divisions" USING btree ("date");