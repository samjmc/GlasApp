CREATE TABLE "politics"."td_stances" (
	"id" serial PRIMARY KEY NOT NULL,
	"td_id" integer NOT NULL,
	"article_id" integer NOT NULL,
	"question_id" integer,
	"option_key" varchar(12),
	"quote" text NOT NULL,
	"quote_kind" varchar(12) NOT NULL,
	"policy_domain" varchar(40) NOT NULL,
	"option_text" text,
	"stated_at" timestamp with time zone NOT NULL,
	"article_url" text NOT NULL,
	"source_name" varchar(100) NOT NULL,
	"headline" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "td_stances_answer_chk" CHECK (("politics"."td_stances"."question_id" is null) = ("politics"."td_stances"."option_key" is null)),
	CONSTRAINT "td_stances_quote_kind_chk" CHECK ("politics"."td_stances"."quote_kind" in ('direct', 'paraphrase')),
	CONSTRAINT "td_stances_policy_domain_chk" CHECK ("politics"."td_stances"."policy_domain" in ('foreign_policy', 'humanitarian_aid', 'housing', 'health', 'economy', 'taxation', 'climate', 'immigration', 'justice', 'education', 'infrastructure', 'agriculture', 'technology', 'other'))
);
--> statement-breakpoint
ALTER TABLE "politics"."td_ideology_evidence" DROP CONSTRAINT "td_ideology_evidence_source_chk";--> statement-breakpoint
ALTER TABLE "politics"."td_stances" ADD CONSTRAINT "td_stances_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."td_stances" ADD CONSTRAINT "td_stances_article_id_news_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "politics"."news_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."td_stances" ADD CONSTRAINT "td_stances_option_fk" FOREIGN KEY ("question_id","option_key") REFERENCES "politics"."policy_question_options"("question_id","option_key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "td_stances_td_article_idx" ON "politics"."td_stances" USING btree ("td_id","article_id");--> statement-breakpoint
CREATE INDEX "td_stances_td_stated_idx" ON "politics"."td_stances" USING btree ("td_id","stated_at");--> statement-breakpoint
CREATE INDEX "td_stances_question_idx" ON "politics"."td_stances" USING btree ("question_id");--> statement-breakpoint
ALTER TABLE "politics"."td_ideology_evidence" ADD CONSTRAINT "td_ideology_evidence_source_chk" CHECK ("politics"."td_ideology_evidence"."source" in ('article', 'debate', 'stance'));--> statement-breakpoint
DROP TABLE "politics"."td_policy_stances" CASCADE;