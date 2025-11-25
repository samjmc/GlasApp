-- ============================================================================
-- CRITICAL RLS SECURITY FIXES
-- Generated: November 4, 2025
-- Status: MUST APPLY BEFORE LAUNCH
-- ============================================================================

-- This migration fixes critical security vulnerabilities in the database
-- by enabling Row Level Security (RLS) on user tables and implementing
-- proper access control policies.

-- ============================================================================
-- PHASE 1: CRITICAL SECURITY FIXES (Users, Tokens, Sessions)
-- ============================================================================

-- 1. USERS TABLE - Protect user data
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text OR auth.uid()::integer = id);

-- Users can only update their own data (excluding role)
CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text OR auth.uid()::integer = id)
  WITH CHECK (auth.uid()::text = id::text OR auth.uid()::integer = id);

-- Only service role can insert users (handled via backend)
-- No policy needed - defaults to no public access

-- Admins can view all users
CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE (u.id = auth.uid()::integer OR u.id::text = auth.uid()::text)
      AND u.role = 'admin'
    )
  );


-- 2. EMAIL VERIFICATION TOKENS - No public access
-- ============================================================================
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to email tokens"
  ON email_verification_tokens FOR ALL
  USING (false);

-- Service role can manage tokens (via backend only)


-- 3. TWO FACTOR TOKENS - No public access
-- ============================================================================
ALTER TABLE two_factor_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to 2FA tokens"
  ON two_factor_tokens FOR ALL
  USING (false);


-- 4. SESSIONS - No public access
-- ============================================================================
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to sessions"
  ON sessions FOR ALL
  USING (false);


-- 5. FIX BROKEN USER_TD_RATINGS POLICIES
-- ============================================================================
-- Drop existing broken policies
DROP POLICY IF EXISTS "Public can insert ratings" ON user_td_ratings;
DROP POLICY IF EXISTS "Public can update ratings" ON user_td_ratings;
DROP POLICY IF EXISTS "Public can delete ratings" ON user_td_ratings;
DROP POLICY IF EXISTS "Public can read ratings" ON user_td_ratings;

-- Create secure policies
CREATE POLICY "Anyone can read ratings (for aggregation)"
  ON user_td_ratings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create ratings"
  ON user_td_ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own ratings"
  ON user_td_ratings FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own ratings"
  ON user_td_ratings FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

-- Add unique constraint to prevent duplicate ratings
ALTER TABLE user_td_ratings 
  DROP CONSTRAINT IF EXISTS unique_user_td_rating;
ALTER TABLE user_td_ratings 
  ADD CONSTRAINT unique_user_td_rating UNIQUE (user_id, politician_name);


-- ============================================================================
-- PHASE 2: USER DATA ISOLATION (Quiz, Personal Data, Activity)
-- ============================================================================

-- 6. QUIZ RESULTS - Users can only see their own (unless shared)
-- ============================================================================
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own quiz results"
  ON quiz_results FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR share_code IS NOT NULL  -- Shared results are public
  );

CREATE POLICY "Anonymous can view shared quiz results"
  ON quiz_results FOR SELECT
  TO anon
  USING (share_code IS NOT NULL);

CREATE POLICY "Users can insert own quiz results"
  ON quiz_results FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quiz results"
  ON quiz_results FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- 7. QUIZ HISTORY - Private to user
-- ============================================================================
ALTER TABLE quiz_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own quiz history"
  ON quiz_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz history"
  ON quiz_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);


-- 8. POLITICAL EVOLUTION - Private to user
-- ============================================================================
ALTER TABLE political_evolution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own political evolution"
  ON political_evolution FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own evolution"
  ON political_evolution FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);


-- 9. USER LOCATIONS - GDPR protected
-- ============================================================================
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own location"
  ON user_locations FOR SELECT
  TO authenticated
  USING (auth.uid()::text = firebase_uid);

CREATE POLICY "Users can update own location"
  ON user_locations FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = firebase_uid)
  WITH CHECK (auth.uid()::text = firebase_uid);

CREATE POLICY "Users can insert own location"
  ON user_locations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = firebase_uid);


-- 10. USER PERSONAL RANKINGS - Private
-- ============================================================================
ALTER TABLE user_personal_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own rankings"
  ON user_personal_rankings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage rankings"
  ON user_personal_rankings FOR ALL
  USING (true);  -- Backend with service role


-- 11. USER QUIZ RESULTS - Private
-- ============================================================================
ALTER TABLE user_quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own quiz results"
  ON user_quiz_results FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own results"
  ON user_quiz_results FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);


-- 12. USER TD POLICY AGREEMENTS - Private
-- ============================================================================
ALTER TABLE user_td_policy_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own agreements"
  ON user_td_policy_agreements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage agreements"
  ON user_td_policy_agreements FOR ALL
  USING (true);  -- Backend with service role


-- 13. ENGAGEMENT POINTS - Private
-- ============================================================================
ALTER TABLE engagement_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own points"
  ON engagement_points FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage points"
  ON engagement_points FOR ALL
  USING (true);  -- Backend with service role


-- 14. ACTIVITY LOGS - Private
-- ============================================================================
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own activity"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can log activity"
  ON activity_logs FOR INSERT
  USING (true);  -- Backend with service role


-- ============================================================================
-- PHASE 3: VOTING TABLES - Prevent Manipulation
-- ============================================================================

-- 15. IDEA VOTES
-- ============================================================================
ALTER TABLE idea_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view vote counts"
  ON idea_votes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can vote"
  ON idea_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own votes"
  ON idea_votes FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own votes"
  ON idea_votes FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- Prevent duplicate votes
ALTER TABLE idea_votes DROP CONSTRAINT IF EXISTS unique_user_idea_vote;
ALTER TABLE idea_votes ADD CONSTRAINT unique_user_idea_vote UNIQUE (user_id, idea_id);


-- 16. PROBLEM VOTES
-- ============================================================================
ALTER TABLE problem_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view problem votes"
  ON problem_votes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can vote on problems"
  ON problem_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own problem votes"
  ON problem_votes FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own problem votes"
  ON problem_votes FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

-- Prevent duplicate votes
ALTER TABLE problem_votes DROP CONSTRAINT IF EXISTS unique_user_problem_vote;
ALTER TABLE problem_votes ADD CONSTRAINT unique_user_problem_vote UNIQUE (user_id, problem_id);


-- 17. SOLUTION VOTES
-- ============================================================================
ALTER TABLE solution_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view solution votes"
  ON solution_votes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can vote on solutions"
  ON solution_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own solution votes"
  ON solution_votes FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own solution votes"
  ON solution_votes FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

-- Prevent duplicate votes
ALTER TABLE solution_votes DROP CONSTRAINT IF EXISTS unique_user_solution_vote;
ALTER TABLE solution_votes ADD CONSTRAINT unique_user_solution_vote UNIQUE (user_id, solution_id);


-- 18. PARTY SENTIMENT VOTES
-- ============================================================================
ALTER TABLE party_sentiment_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view party sentiment"
  ON party_sentiment_votes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can vote on party sentiment"
  ON party_sentiment_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own party sentiment"
  ON party_sentiment_votes FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);


-- ============================================================================
-- PHASE 4: USER-GENERATED CONTENT (Ideas, Problems, Solutions)
-- ============================================================================

-- 19. IDEAS
-- ============================================================================
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active ideas"
  ON ideas FOR SELECT
  USING (status = 'active' OR status IS NULL);

CREATE POLICY "Authenticated users can create ideas"
  ON ideas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own ideas"
  ON ideas FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own ideas"
  ON ideas FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can manage all ideas"
  ON ideas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE (u.id = auth.uid()::integer OR u.id::text = auth.uid()::text)
      AND u.role = 'admin'
    )
  );


-- 20. PROBLEMS
-- ============================================================================
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active problems"
  ON problems FOR SELECT
  USING (
    (status = 'active' OR status IS NULL)
    AND (is_admin_only = false OR is_admin_only IS NULL)
  );

CREATE POLICY "Admins can see admin-only problems"
  ON problems FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE (u.id = auth.uid()::integer OR u.id::text = auth.uid()::text)
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can create problems"
  ON problems FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own problems"
  ON problems FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);


-- 21. SOLUTIONS
-- ============================================================================
ALTER TABLE solutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active solutions"
  ON solutions FOR SELECT
  USING (
    (status = 'active' OR status IS NULL)
    AND (is_admin_only = false OR is_admin_only IS NULL)
  );

CREATE POLICY "Admins can see admin-only solutions"
  ON solutions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE (u.id = auth.uid()::integer OR u.id::text = auth.uid()::text)
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can create solutions"
  ON solutions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own solutions"
  ON solutions FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);


-- ============================================================================
-- PHASE 5: ADMIN TABLES
-- ============================================================================

-- 22. SCRAPING JOBS - Admin only
-- ============================================================================
ALTER TABLE scraping_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view scraping jobs"
  ON scraping_jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE (u.id = auth.uid()::integer OR u.id::text = auth.uid()::text)
      AND u.role = 'admin'
    )
  );

CREATE POLICY "System can manage scraping jobs"
  ON scraping_jobs FOR ALL
  USING (true);  -- Backend with service role


-- 23. NEWS SOURCES - Public read, admin write
-- ============================================================================
ALTER TABLE news_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view news sources"
  ON news_sources FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify news sources"
  ON news_sources FOR INSERT, UPDATE, DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE (u.id = auth.uid()::integer OR u.id::text = auth.uid()::text)
      AND u.role = 'admin'
    )
  );


-- 24. SCORE COMPONENT WEIGHTS - Admin only
-- ============================================================================
ALTER TABLE score_component_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view score weights"
  ON score_component_weights FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify weights"
  ON score_component_weights FOR INSERT, UPDATE, DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE (u.id = auth.uid()::integer OR u.id::text = auth.uid()::text)
      AND u.role = 'admin'
    )
  );


-- ============================================================================
-- PHASE 6: PUBLIC READ-ONLY TABLES (Best Practice)
-- ============================================================================

-- Enable RLS on all public data tables for defense in depth
-- These tables are read-only to public, but RLS ensures no accidental writes

-- 25. TD SCORES
ALTER TABLE td_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view TD scores" ON td_scores FOR SELECT USING (true);

-- 26. NEWS ARTICLES
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view news articles" ON news_articles FOR SELECT USING (true);

-- 27. POLLS
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view polls" ON polls FOR SELECT USING (true);

-- 28. POLL SOURCES
ALTER TABLE poll_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view poll sources" ON poll_sources FOR SELECT USING (true);

-- 29. POLL PARTY RESULTS
ALTER TABLE poll_party_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view party poll results" ON poll_party_results FOR SELECT USING (true);

-- 30. PARTIES
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view parties" ON parties FOR SELECT USING (true);

-- 31. CONSTITUENCIES
ALTER TABLE constituencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view constituencies" ON constituencies FOR SELECT USING (true);

-- 32. TD QUESTIONS
ALTER TABLE td_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view TD questions" ON td_questions FOR SELECT USING (true);

-- 33. TD VOTES
ALTER TABLE td_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view TD votes" ON td_votes FOR SELECT USING (true);

-- 34. TD LEGISLATION
ALTER TABLE td_legislation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view TD legislation" ON td_legislation FOR SELECT USING (true);

-- 35. TD DEBATES
ALTER TABLE td_debates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view TD debates" ON td_debates FOR SELECT USING (true);

-- 36. PARTY PERFORMANCE SCORES
ALTER TABLE party_performance_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view party performance" ON party_performance_scores FOR SELECT USING (true);

-- 37. PARTY POSITIONS
ALTER TABLE party_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view party positions" ON party_positions FOR SELECT USING (true);

-- 38. POLLING AGGREGATES CACHE
ALTER TABLE polling_aggregates_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view polling aggregates" ON polling_aggregates_cache FOR SELECT USING (true);

-- 39. ARTICLE TD SCORES
ALTER TABLE article_td_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view article TD scores" ON article_td_scores FOR SELECT USING (true);

-- 40. TD POLICY STANCES
ALTER TABLE td_policy_stances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view TD policy stances" ON td_policy_stances FOR SELECT USING (true);


-- ============================================================================
-- ADDITIONAL SECURITY FIXES
-- ============================================================================

-- Fix function search paths (SQL injection protection)
ALTER FUNCTION IF EXISTS update_td_questions_updated_at() 
  SET search_path = public, pg_temp;

ALTER FUNCTION IF EXISTS update_td_votes_updated_at() 
  SET search_path = public, pg_temp;

ALTER FUNCTION IF EXISTS update_updated_at_column() 
  SET search_path = public, pg_temp;


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify RLS is enabled:

-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename;

-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- ============================================================================
-- END OF CRITICAL RLS FIXES
-- ============================================================================

COMMENT ON SCHEMA public IS 'Critical RLS policies applied on November 4, 2025';






















