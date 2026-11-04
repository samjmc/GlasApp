-- Indexes from the database sweep (plan Phase 2: D4 D5 D11 D12 D13 D22, the feed sort D2, and the
-- relink and question-count scans seen live). Plain CREATE INDEX, not CONCURRENTLY: db:migrate runs
-- in one transaction, and every table here is small (the largest, debate_speeches, is ~70k rows and
-- builds in well under a second), so the short write lock is fine. See docs/deploy.md section 3 for
-- the by-hand CONCURRENTLY route a big table needs.
-- disclosure_files_kind_period_idx becomes UNIQUE: it fails, and the migration with it, if a period
-- already has two files. Nothing is deleted here; find such rows first with
--   select kind, period, count(*) from politics.disclosure_files group by 1, 2 having count(*) > 1;
-- and keep only the newest read_at of each by hand before migrating.
DROP INDEX "politics"."question_askers_member_idx";--> statement-breakpoint
DROP INDEX "politics"."pledges_party_idx";--> statement-breakpoint
DROP INDEX "politics"."td_scores_overall_score_idx";--> statement-breakpoint
DROP INDEX "politics"."debate_speeches_member_idx";--> statement-breakpoint
DROP INDEX "politics"."disclosure_files_kind_period_idx";--> statement-breakpoint
DROP INDEX "politics"."division_votes_member_idx";--> statement-breakpoint
ALTER TABLE "politics"."debate_extraction_runs" ALTER COLUMN "debate_id" SET DATA TYPE varchar(100);--> statement-breakpoint
CREATE INDEX "news_articles_source_idx" ON "politics"."news_articles" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "news_articles_feed_importance_idx" ON "politics"."news_articles" USING btree (("importance_score" is null),"importance_score" desc,"published_at" desc,"id" desc) WHERE "politics"."news_articles"."status" <> 'duplicate' and coalesce("politics"."news_articles"."relevance_score", 100) >= 60;--> statement-breakpoint
CREATE INDEX "debate_sections_parent_idx" ON "politics"."debate_sections" USING btree ("parent_id") WHERE "politics"."debate_sections"."parent_id" is not null;--> statement-breakpoint
CREATE INDEX "debate_sections_title_idx" ON "politics"."debate_sections" USING hash ("title");--> statement-breakpoint
CREATE INDEX "divisions_debate_section_idx" ON "politics"."divisions" USING btree ("debate_section_id" text_pattern_ops);--> statement-breakpoint
CREATE INDEX "question_counts_month_idx" ON "politics"."question_counts" USING btree ("month");--> statement-breakpoint
CREATE INDEX "division_readings_question_idx" ON "politics"."division_readings" USING btree ("question_id") WHERE "politics"."division_readings"."question_id" is not null;--> statement-breakpoint
CREATE INDEX "td_stances_division_idx" ON "politics"."td_stances" USING btree ("division_id") WHERE "politics"."td_stances"."division_id" is not null;--> statement-breakpoint
CREATE INDEX "daily_session_items_question_id_idx" ON "politics"."daily_session_items" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "policy_votes_session_item_idx" ON "politics"."policy_votes" USING btree ("session_item_id") WHERE "politics"."policy_votes"."session_item_id" is not null;--> statement-breakpoint
CREATE INDEX "debate_speeches_member_idx" ON "politics"."debate_speeches" USING btree ("member_code","td_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disclosure_files_kind_period_idx" ON "politics"."disclosure_files" USING btree ("kind","period");--> statement-breakpoint
CREATE INDEX "division_votes_member_idx" ON "politics"."division_votes" USING btree ("member_code","td_id");