CREATE TABLE "politics"."pledge_category_priorities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"category" varchar(30) NOT NULL,
	"rank" smallint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pledge_category_priorities_rank_chk" CHECK ("politics"."pledge_category_priorities"."rank" >= 1),
	CONSTRAINT "pledge_category_priorities_category_chk" CHECK ("politics"."pledge_category_priorities"."category" in ('housing', 'health', 'cost_of_living', 'economy', 'infrastructure', 'climate', 'justice', 'immigration', 'education', 'social_welfare', 'foreign_policy', 'other'))
);
--> statement-breakpoint
CREATE TABLE "politics"."pledge_evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"pledge_id" integer NOT NULL,
	"kind" varchar(30) NOT NULL,
	"summary" text NOT NULL,
	"occurred_on" date NOT NULL,
	"source_url" text NOT NULL,
	"division_id" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pledge_evidence_kind_chk" CHECK ("politics"."pledge_evidence"."kind" in ('legislation_passed', 'bill_introduced', 'budget_allocated', 'policy_implemented', 'division_vote', 'ministerial_statement', 'parliamentary_question', 'private_members_bill', 'motion_tabled', 'reversal', 'other'))
);
--> statement-breakpoint
CREATE TABLE "politics"."pledges" (
	"id" serial PRIMARY KEY NOT NULL,
	"party" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" varchar(30) NOT NULL,
	"election_year" smallint NOT NULL,
	"target_date" date,
	"status" varchar(20) DEFAULT 'unassessed' NOT NULL,
	"status_note" text,
	"source_url" text NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pledges_status_chk" CHECK ("politics"."pledges"."status" in ('unassessed', 'not_started', 'in_progress', 'delivered', 'broken', 'superseded')),
	CONSTRAINT "pledges_category_chk" CHECK ("politics"."pledges"."category" in ('housing', 'health', 'cost_of_living', 'economy', 'infrastructure', 'climate', 'justice', 'immigration', 'education', 'social_welfare', 'foreign_policy', 'other'))
);
--> statement-breakpoint
ALTER TABLE "politics"."pledge_evidence" ADD CONSTRAINT "pledge_evidence_pledge_id_pledges_id_fk" FOREIGN KEY ("pledge_id") REFERENCES "politics"."pledges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pledge_category_priorities_user_category_idx" ON "politics"."pledge_category_priorities" USING btree ("user_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "pledge_category_priorities_user_rank_idx" ON "politics"."pledge_category_priorities" USING btree ("user_id","rank");--> statement-breakpoint
CREATE INDEX "pledge_evidence_pledge_idx" ON "politics"."pledge_evidence" USING btree ("pledge_id","occurred_on");--> statement-breakpoint
CREATE UNIQUE INDEX "pledges_party_title_year_idx" ON "politics"."pledges" USING btree (lower("party"),lower("title"),"election_year");--> statement-breakpoint
CREATE INDEX "pledges_party_idx" ON "politics"."pledges" USING btree (lower("party"));