ALTER TABLE "politics"."users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."news_articles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."news_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."bill_debates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."bill_sponsors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."bill_stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."bills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."committee_attendance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."committee_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."committee_sittings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."committees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."debate_extraction_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."debate_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."debate_participation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."debate_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."debate_speeches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."debates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."disclosure_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."division_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."divisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."parliament_sync_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."question_askers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."question_counts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."question_exchanges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."question_participation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."td_absences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."td_allowance_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."td_interests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."td_leave_alerts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."td_offices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."td_parliament_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."td_party_leaders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."pledge_category_priorities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."pledge_evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."pledges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."article_tds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."td_historical_baselines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."td_history_suppressed" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."td_scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."tds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."ideology_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."quiz_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."td_ideology_evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."division_readings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."td_stances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."daily_session_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."daily_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."policy_question_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."policy_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."policy_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Part 2 is HAND-WRITTEN (the ENABLE statements above are drizzle-kit's output, from `.enableRLS()`
-- on every table in shared/schema). Defence in depth for the political-opinion tables: Supabase's
-- public API roles get nothing in `politics`, now or for tables made later. Checked on GlasCore
-- 2026-10-12: anon and authenticated already had no USAGE on the schema, so this changes nothing
-- that works today. RLS with no policy denies every role except the table owner, which is what the
-- app connects as (server/db.ts); without FORCE the owner is not affected.
-- anon and authenticated exist only on Supabase, not on CI's or a developer's Postgres, so the
-- role statements run only for the roles that exist.
DO $$
DECLARE
  api_role text;
BEGIN
  REVOKE ALL ON SCHEMA politics FROM PUBLIC;
  FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON SCHEMA politics FROM %I', api_role);
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA politics FROM %I', api_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA politics REVOKE ALL ON TABLES FROM %I', api_role);
  END LOOP;
END $$;