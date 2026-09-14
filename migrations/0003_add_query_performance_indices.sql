-- Phase 2B schema cleanup: add missing indices for frequently filtered/sorted columns.
-- All statements are idempotent (IF NOT EXISTS) so this is safe to run multiple times
-- and safe against a fresh database that already has these indices via drizzle-kit push.

-- quiz_results.user_id: used to look up a user's active/historical quiz results.
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON quiz_results(user_id);

-- user_activity.user_id: used to fetch a user's activity feed/history.
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);

-- td_score_history(politician_name, created_at): composite index to speed up
-- "history for politician X ordered by date" queries. Complements the existing
-- single-column idx_history_politician and idx_history_date indices.
CREATE INDEX IF NOT EXISTS idx_td_score_history_politician_created_at
  ON td_score_history(politician_name, created_at);
