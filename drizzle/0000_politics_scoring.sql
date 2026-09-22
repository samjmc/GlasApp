CREATE SCHEMA "politics";
--> statement-breakpoint
CREATE TABLE "politics"."article_td_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"td_id" integer NOT NULL,
	"impact" real NOT NULL,
	"dimension_scores" jsonb,
	"story_type" varchar(50),
	"sentiment" varchar(20),
	"needs_review" boolean DEFAULT false NOT NULL,
	"reasoning" text,
	"analyzed_by" varchar(50),
	"is_ideological_policy" boolean DEFAULT false NOT NULL,
	"policy_direction" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politics"."party_scores" (
	"party" varchar(100) PRIMARY KEY NOT NULL,
	"member_count" integer NOT NULL,
	"avg_elo" integer NOT NULL,
	"overall_score" smallint NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politics"."td_historical_baselines" (
	"id" serial PRIMARY KEY NOT NULL,
	"td_id" integer NOT NULL,
	"baseline_score" smallint,
	"confidence" real,
	"category" varchar(50),
	"historical_summary" text,
	"key_findings" jsonb,
	"reasoning" text,
	"controversies_noted" jsonb,
	"research_date" timestamp with time zone,
	"analyzed_by" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politics"."td_policy_stances" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"td_id" integer NOT NULL,
	"stance" varchar(20) NOT NULL,
	"stance_strength" smallint,
	"evidence" text,
	"policy_topic" text,
	"policy_dimension" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politics"."td_score_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"td_id" integer NOT NULL,
	"article_id" integer,
	"dimension" varchar(32) NOT NULL,
	"old_elo" integer NOT NULL,
	"new_elo" integer NOT NULL,
	"delta" integer NOT NULL,
	"impact" real,
	"credibility" real,
	"confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politics"."td_scores" (
	"td_id" integer PRIMARY KEY NOT NULL,
	"overall_elo" integer DEFAULT 1500 NOT NULL,
	"transparency_elo" integer DEFAULT 1500 NOT NULL,
	"effectiveness_elo" integer DEFAULT 1500 NOT NULL,
	"integrity_elo" integer DEFAULT 1500 NOT NULL,
	"consistency_elo" integer DEFAULT 1500 NOT NULL,
	"overall_score" smallint,
	"news_score" smallint,
	"parliamentary_score" smallint,
	"debate_score" smallint,
	"national_rank" integer,
	"party_rank" integer,
	"constituency_rank" integer,
	"elo_change_7d" integer DEFAULT 0 NOT NULL,
	"elo_change_30d" integer DEFAULT 0 NOT NULL,
	"total_stories" integer DEFAULT 0 NOT NULL,
	"last_scored_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politics"."tds" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"party" varchar(100),
	"constituency" varchar(100),
	"image_url" text,
	"member_code" varchar(120),
	"member_uri" text,
	"gender" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"offices" jsonb,
	"committees" jsonb,
	"question_count_oral" integer,
	"question_count_written" integer,
	"attendance_pct" real,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "politics"."article_td_scores" ADD CONSTRAINT "article_td_scores_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."td_historical_baselines" ADD CONSTRAINT "td_historical_baselines_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."td_policy_stances" ADD CONSTRAINT "td_policy_stances_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."td_score_history" ADD CONSTRAINT "td_score_history_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."td_scores" ADD CONSTRAINT "td_scores_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_td_scores_article_td_idx" ON "politics"."article_td_scores" USING btree ("article_id","td_id");--> statement-breakpoint
CREATE INDEX "article_td_scores_td_created_idx" ON "politics"."article_td_scores" USING btree ("td_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "td_historical_baselines_td_idx" ON "politics"."td_historical_baselines" USING btree ("td_id");--> statement-breakpoint
CREATE UNIQUE INDEX "td_policy_stances_article_td_idx" ON "politics"."td_policy_stances" USING btree ("article_id","td_id");--> statement-breakpoint
CREATE INDEX "td_policy_stances_td_idx" ON "politics"."td_policy_stances" USING btree ("td_id");--> statement-breakpoint
CREATE INDEX "td_score_history_td_created_idx" ON "politics"."td_score_history" USING btree ("td_id","created_at");--> statement-breakpoint
CREATE INDEX "td_score_history_article_idx" ON "politics"."td_score_history" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "td_scores_overall_elo_idx" ON "politics"."td_scores" USING btree ("overall_elo");--> statement-breakpoint
CREATE INDEX "td_scores_overall_score_idx" ON "politics"."td_scores" USING btree ("overall_score");--> statement-breakpoint
CREATE UNIQUE INDEX "tds_name_lower_idx" ON "politics"."tds" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "tds_member_code_idx" ON "politics"."tds" USING btree ("member_code");--> statement-breakpoint
CREATE INDEX "tds_party_idx" ON "politics"."tds" USING btree ("party");--> statement-breakpoint
CREATE INDEX "tds_constituency_idx" ON "politics"."tds" USING btree ("constituency");