CREATE TABLE "politics"."daily_session_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"position" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politics"."daily_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"session_date" date NOT NULL,
	"status" varchar(12) DEFAULT 'pending' NOT NULL,
	"county" varchar(60),
	"constituency" varchar(100),
	"profile_before" jsonb,
	"streak_count" integer,
	"completion" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_sessions_status_chk" CHECK ("politics"."daily_sessions"."status" in ('pending', 'completed'))
);
--> statement-breakpoint
CREATE TABLE "politics"."policy_question_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"option_key" varchar(12) NOT NULL,
	"label" text NOT NULL,
	"position" smallint NOT NULL,
	"economic" real DEFAULT 0 NOT NULL,
	"social" real DEFAULT 0 NOT NULL,
	"cultural" real DEFAULT 0 NOT NULL,
	"authority" real DEFAULT 0 NOT NULL,
	"environmental" real DEFAULT 0 NOT NULL,
	"welfare" real DEFAULT 0 NOT NULL,
	"globalism" real DEFAULT 0 NOT NULL,
	"technocratic" real DEFAULT 0 NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"confidence" real,
	CONSTRAINT "policy_question_options_key_uniq" UNIQUE("question_id","option_key"),
	CONSTRAINT "policy_question_options_range_chk" CHECK ("politics"."policy_question_options"."economic" between -2 and 2 and "politics"."policy_question_options"."social" between -2 and 2
        and "politics"."policy_question_options"."cultural" between -2 and 2 and "politics"."policy_question_options"."authority" between -2 and 2
        and "politics"."policy_question_options"."environmental" between -2 and 2 and "politics"."policy_question_options"."welfare" between -2 and 2
        and "politics"."policy_question_options"."globalism" between -2 and 2 and "politics"."policy_question_options"."technocratic" between -2 and 2
        and "politics"."policy_question_options"."weight" between 0.1 and 3)
);
--> statement-breakpoint
CREATE TABLE "politics"."policy_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"question" text NOT NULL,
	"policy_domain" varchar(40) NOT NULL,
	"policy_topic" varchar(80) NOT NULL,
	"primary_dimension" varchar(20),
	"confidence" real,
	"rationale" text,
	"headline" text NOT NULL,
	"summary" text,
	"article_url" text,
	"image_url" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politics"."policy_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"question_id" integer NOT NULL,
	"option_key" varchar(12) NOT NULL,
	"source" varchar(20) NOT NULL,
	"session_item_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "policy_votes_source_chk" CHECK ("politics"."policy_votes"."source" in ('daily_session', 'article'))
);
--> statement-breakpoint
ALTER TABLE "politics"."daily_session_items" ADD CONSTRAINT "daily_session_items_session_id_daily_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "politics"."daily_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."daily_session_items" ADD CONSTRAINT "daily_session_items_question_id_policy_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "politics"."policy_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."policy_question_options" ADD CONSTRAINT "policy_question_options_question_id_policy_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "politics"."policy_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."policy_votes" ADD CONSTRAINT "policy_votes_session_item_id_daily_session_items_id_fk" FOREIGN KEY ("session_item_id") REFERENCES "politics"."daily_session_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."policy_votes" ADD CONSTRAINT "policy_votes_option_fk" FOREIGN KEY ("question_id","option_key") REFERENCES "politics"."policy_question_options"("question_id","option_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_session_items_question_idx" ON "politics"."daily_session_items" USING btree ("session_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_session_items_position_idx" ON "politics"."daily_session_items" USING btree ("session_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_sessions_user_date_idx" ON "politics"."daily_sessions" USING btree ("user_id","session_date");--> statement-breakpoint
CREATE INDEX "daily_sessions_date_county_idx" ON "politics"."daily_sessions" USING btree ("session_date","county");--> statement-breakpoint
CREATE INDEX "daily_sessions_date_constituency_idx" ON "politics"."daily_sessions" USING btree ("session_date","constituency");--> statement-breakpoint
CREATE UNIQUE INDEX "policy_questions_article_idx" ON "politics"."policy_questions" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "policy_questions_created_idx" ON "politics"."policy_questions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "policy_votes_user_question_idx" ON "politics"."policy_votes" USING btree ("user_id","question_id");--> statement-breakpoint
CREATE INDEX "policy_votes_question_idx" ON "politics"."policy_votes" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "policy_votes_user_created_idx" ON "politics"."policy_votes" USING btree ("user_id","created_at");