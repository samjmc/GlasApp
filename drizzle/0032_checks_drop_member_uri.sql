-- Sweep D19 and D21. CHECKs for rules the TypeScript already enforces on every write, each added
-- NOT VALID and then validated: a row that breaks one fails VALIDATE and the whole migration rolls
-- back, deleting and changing nothing. Run the read-only checks in the PR body on GlasCore first.
-- (drizzle runs this in one transaction, so NOT VALID saves no lock time here; it keeps the two steps
-- explicit and lets the failing constraint be named.) Every table here is small.
-- tds.member_uri is dropped: no code reads or writes it, and the URI is the member code's own
-- (https://data.oireachtas.ie/ie/oireachtas/member/id/<member_code>).
ALTER TABLE "politics"."tds" DROP COLUMN "member_uri";--> statement-breakpoint
ALTER TABLE "politics"."users" ADD CONSTRAINT "users_political_consent_chk" CHECK (("politics"."users"."political_consent_at" is null) = ("politics"."users"."political_consent_version" is null)) NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."users" VALIDATE CONSTRAINT "users_political_consent_chk";--> statement-breakpoint
ALTER TABLE "politics"."news_articles" ADD CONSTRAINT "news_articles_status_chk" CHECK ("politics"."news_articles"."status" in ('pending', 'claimed', 'scored', 'skipped', 'duplicate', 'failed')) NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."news_articles" VALIDATE CONSTRAINT "news_articles_status_chk";--> statement-breakpoint
ALTER TABLE "politics"."news_articles" ADD CONSTRAINT "news_articles_category_chk" CHECK ("politics"."news_articles"."category" in ('government', 'oireachtas', 'elections', 'economy', 'housing', 'health', 'justice', 'immigration', 'environment', 'education', 'foreign_affairs', 'northern_ireland', 'eu', 'local', 'other')) NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."news_articles" VALIDATE CONSTRAINT "news_articles_category_chk";--> statement-breakpoint
ALTER TABLE "politics"."news_articles" ADD CONSTRAINT "news_articles_score_range_chk" CHECK ("politics"."news_articles"."relevance_score" between 0 and 100 and "politics"."news_articles"."importance_score" between 0 and 100) NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."news_articles" VALIDATE CONSTRAINT "news_articles_score_range_chk";--> statement-breakpoint
ALTER TABLE "politics"."debate_items" ADD CONSTRAINT "debate_items_claim_type_chk" CHECK (("politics"."debate_items"."kind" = 'specific_claim') = ("politics"."debate_items"."claim_type" is not null)) NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."debate_items" VALIDATE CONSTRAINT "debate_items_claim_type_chk";--> statement-breakpoint
ALTER TABLE "politics"."debate_items" ADD CONSTRAINT "debate_items_commitment_type_chk" CHECK ("politics"."debate_items"."commitment_type" is null or "politics"."debate_items"."kind" = 'commitment') NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."debate_items" VALIDATE CONSTRAINT "debate_items_commitment_type_chk";--> statement-breakpoint
ALTER TABLE "politics"."debate_items" ADD CONSTRAINT "debate_items_quote_range_chk" CHECK ("politics"."debate_items"."quote_start" >= 0 and "politics"."debate_items"."quote_end" >= "politics"."debate_items"."quote_start") NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."debate_items" VALIDATE CONSTRAINT "debate_items_quote_range_chk";--> statement-breakpoint
ALTER TABLE "politics"."debates" ADD CONSTRAINT "debates_dates_chk" CHECK ("politics"."debates"."first_date" <= "politics"."debates"."last_date") NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."debates" VALIDATE CONSTRAINT "debates_dates_chk";--> statement-breakpoint
ALTER TABLE "politics"."td_absences" ADD CONSTRAINT "td_absences_dates_chk" CHECK ("politics"."td_absences"."end_date" >= "politics"."td_absences"."start_date") NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."td_absences" VALIDATE CONSTRAINT "td_absences_dates_chk";--> statement-breakpoint
ALTER TABLE "politics"."td_party_leaders" ADD CONSTRAINT "td_party_leaders_dates_chk" CHECK ("politics"."td_party_leaders"."end_date" >= "politics"."td_party_leaders"."start_date") NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."td_party_leaders" VALIDATE CONSTRAINT "td_party_leaders_dates_chk";--> statement-breakpoint
ALTER TABLE "politics"."td_scores" ADD CONSTRAINT "td_scores_range_chk" CHECK ("politics"."td_scores"."overall_score" between 0 and 100 and "politics"."td_scores"."parliamentary_score" between 0 and 100 and "politics"."td_scores"."debate_score" between 0 and 100) NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."td_scores" VALIDATE CONSTRAINT "td_scores_range_chk";--> statement-breakpoint
ALTER TABLE "politics"."tds" ADD CONSTRAINT "tds_pct_range_chk" CHECK ("politics"."tds"."attendance_pct" between 0 and 100 and "politics"."tds"."committee_attendance_pct" between 0 and 100) NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."tds" VALIDATE CONSTRAINT "tds_pct_range_chk";--> statement-breakpoint
ALTER TABLE "politics"."policy_questions" ADD CONSTRAINT "policy_questions_domain_chk" CHECK ("politics"."policy_questions"."policy_domain" in ('foreign_policy', 'humanitarian_aid', 'housing', 'health', 'economy', 'taxation', 'climate', 'immigration', 'justice', 'education', 'infrastructure', 'agriculture', 'technology', 'other')) NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."policy_questions" VALIDATE CONSTRAINT "policy_questions_domain_chk";--> statement-breakpoint
ALTER TABLE "politics"."policy_questions" ADD CONSTRAINT "policy_questions_dimension_chk" CHECK ("politics"."policy_questions"."primary_dimension" in ('economic', 'social', 'cultural', 'authority', 'environmental', 'welfare', 'globalism', 'technocratic')) NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."policy_questions" VALIDATE CONSTRAINT "policy_questions_dimension_chk";
