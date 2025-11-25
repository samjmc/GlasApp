-- ============================================
-- DATA COLLECTION SYSTEM - DATABASE TABLES
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PARLIAMENTARY ACTIVITY (Oireachtas API Data)
-- ============================================

CREATE TABLE IF NOT EXISTS parliamentary_activity (
  id SERIAL PRIMARY KEY,
  politician_name VARCHAR(255) UNIQUE NOT NULL,
  member_id VARCHAR(100),
  member_code VARCHAR(100),
  party VARCHAR(100),
  constituency VARCHAR(100),
  
  -- Activity metrics
  questions_asked INTEGER DEFAULT 0,
  oral_questions INTEGER DEFAULT 0,
  written_questions INTEGER DEFAULT 0,
  debates INTEGER DEFAULT 0,
  votes INTEGER DEFAULT 0,
  estimated_attendance INTEGER DEFAULT 0,
  
  -- Metadata
  last_active TIMESTAMP,
  data_source VARCHAR(50) DEFAULT 'oireachtas_api',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for parliamentary_activity
CREATE INDEX IF NOT EXISTS idx_parliamentary_politician ON parliamentary_activity(politician_name);
CREATE INDEX IF NOT EXISTS idx_parliamentary_updated ON parliamentary_activity(updated_at);

-- ============================================
-- 2. NEWS ARTICLES (Scraped & AI Analyzed)
-- ============================================

CREATE TABLE IF NOT EXISTS news_articles (
  id SERIAL PRIMARY KEY,
  url VARCHAR(500) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  source VARCHAR(100) NOT NULL,
  published_date TIMESTAMP NOT NULL,
  
  -- TD Information
  politician_name VARCHAR(255),
  constituency VARCHAR(100),
  
  -- AI Analysis Results
  story_type VARCHAR(50), -- scandal, achievement, policy_work, etc.
  sentiment VARCHAR(50), -- very_positive, positive, neutral, negative, very_negative
  impact_score INTEGER, -- -10 to +10
  
  -- Dimensional Impacts (-10 to +10 each)
  transparency_impact INTEGER,
  effectiveness_impact INTEGER,
  integrity_impact INTEGER,
  consistency_impact INTEGER,
  constituency_service_impact INTEGER,
  
  -- AI Analysis Details
  ai_summary TEXT,
  ai_reasoning TEXT,
  key_quotes JSONB,
  
  -- Metadata
  processed BOOLEAN DEFAULT FALSE,
  score_applied BOOLEAN DEFAULT FALSE,
  credibility_score DECIMAL(3,2),
  analyzed_by VARCHAR(50), -- 'claude', 'gpt4', 'both'
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for news_articles
CREATE INDEX IF NOT EXISTS idx_news_politician ON news_articles(politician_name);
CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_news_source ON news_articles(source);
CREATE INDEX IF NOT EXISTS idx_news_processed ON news_articles(processed);
CREATE INDEX IF NOT EXISTS idx_news_url ON news_articles(url);

-- ============================================
-- 3. TD SCORES (ELO from News Coverage)
-- ============================================

CREATE TABLE IF NOT EXISTS td_scores (
  id SERIAL PRIMARY KEY,
  politician_name VARCHAR(255) UNIQUE NOT NULL,
  constituency VARCHAR(100),
  party VARCHAR(100),
  
  -- ELO Scores
  overall_elo INTEGER DEFAULT 1500,
  transparency_elo INTEGER DEFAULT 1500,
  effectiveness_elo INTEGER DEFAULT 1500,
  integrity_elo INTEGER DEFAULT 1500,
  consistency_elo INTEGER DEFAULT 1500,
  constituency_service_elo INTEGER DEFAULT 1500,
  
  -- Statistics
  total_stories INTEGER DEFAULT 0,
  positive_stories INTEGER DEFAULT 0,
  negative_stories INTEGER DEFAULT 0,
  neutral_stories INTEGER DEFAULT 0,
  
  -- Metadata
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for td_scores
CREATE INDEX IF NOT EXISTS idx_td_scores_politician ON td_scores(politician_name);
CREATE INDEX IF NOT EXISTS idx_td_scores_overall ON td_scores(overall_elo DESC);
CREATE INDEX IF NOT EXISTS idx_td_scores_constituency ON td_scores(constituency);
CREATE INDEX IF NOT EXISTS idx_td_scores_party ON td_scores(party);

-- ============================================
-- 4. TD SCORE HISTORY (Score Change Tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS td_score_history (
  id SERIAL PRIMARY KEY,
  politician_name VARCHAR(255) NOT NULL,
  article_id INTEGER REFERENCES news_articles(id),
  
  -- Score Changes
  old_overall_elo INTEGER,
  new_overall_elo INTEGER,
  elo_change INTEGER,
  
  -- Context
  dimension_affected VARCHAR(50),
  impact_score INTEGER,
  story_type VARCHAR(50),
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for td_score_history
CREATE INDEX IF NOT EXISTS idx_score_history_politician ON td_score_history(politician_name);
CREATE INDEX IF NOT EXISTS idx_score_history_created ON td_score_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_history_article ON td_score_history(article_id);

-- ============================================
-- 5. USER TD RATINGS (Citizen Feedback)
-- ============================================

CREATE TABLE IF NOT EXISTS user_td_ratings (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  politician_name VARCHAR(255) NOT NULL,
  
  -- Dimensional Ratings (0-100 each)
  transparency_rating INTEGER CHECK (transparency_rating >= 0 AND transparency_rating <= 100),
  effectiveness_rating INTEGER CHECK (effectiveness_rating >= 0 AND effectiveness_rating <= 100),
  integrity_rating INTEGER CHECK (integrity_rating >= 0 AND integrity_rating <= 100),
  consistency_rating INTEGER CHECK (consistency_rating >= 0 AND consistency_rating <= 100),
  constituency_service_rating INTEGER CHECK (constituency_service_rating >= 0 AND constituency_service_rating <= 100),
  
  -- Optional Comment
  comment TEXT,
  
  -- Metadata
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure one rating per user per TD
  UNIQUE(user_id, politician_name)
);

-- Indexes for user_td_ratings
CREATE INDEX IF NOT EXISTS idx_user_ratings_politician ON user_td_ratings(politician_name);
CREATE INDEX IF NOT EXISTS idx_user_ratings_user ON user_td_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_created ON user_td_ratings(created_at DESC);

-- ============================================
-- 6. UNIFIED TD SCORES (Combined 0-100 Scores)
-- ============================================

CREATE TABLE IF NOT EXISTS unified_td_scores (
  id SERIAL PRIMARY KEY,
  politician_name VARCHAR(255) UNIQUE NOT NULL,
  constituency VARCHAR(100),
  party VARCHAR(100),
  
  -- Overall Score (0-100)
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  
  -- Component Scores (0-100 each)
  news_score INTEGER,
  parliamentary_score INTEGER,
  constituency_score INTEGER,
  public_trust_score INTEGER,
  
  -- Dimensional Scores (0-100 each)
  transparency_score INTEGER,
  effectiveness_score INTEGER,
  integrity_score INTEGER,
  consistency_score INTEGER,
  constituency_service_score INTEGER,
  
  -- Confidence & Metadata
  confidence_level DECIMAL(3,2), -- 0.00 to 1.00
  data_sources_count INTEGER DEFAULT 0,
  calculation_version VARCHAR(20) DEFAULT 'v1.0',
  
  last_calculated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for unified_td_scores
CREATE INDEX IF NOT EXISTS idx_unified_scores_politician ON unified_td_scores(politician_name);
CREATE INDEX IF NOT EXISTS idx_unified_scores_overall ON unified_td_scores(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_unified_scores_constituency ON unified_td_scores(constituency);
CREATE INDEX IF NOT EXISTS idx_unified_scores_party ON unified_td_scores(party);
CREATE INDEX IF NOT EXISTS idx_unified_scores_calculated ON unified_td_scores(last_calculated DESC);

-- ============================================
-- 7. UNIFIED SCORE HISTORY (Score Changes Over Time)
-- ============================================

CREATE TABLE IF NOT EXISTS unified_score_history (
  id SERIAL PRIMARY KEY,
  politician_name VARCHAR(255) NOT NULL,
  
  -- Score Snapshot
  overall_score INTEGER,
  news_score INTEGER,
  parliamentary_score INTEGER,
  constituency_score INTEGER,
  public_trust_score INTEGER,
  
  -- Change Tracking
  score_change INTEGER, -- Change from previous
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for unified_score_history
CREATE INDEX IF NOT EXISTS idx_unified_history_politician ON unified_score_history(politician_name);
CREATE INDEX IF NOT EXISTS idx_unified_history_created ON unified_score_history(created_at DESC);

-- ============================================
-- 8. SCRAPING JOBS (Job Tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS scraping_jobs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(50) NOT NULL, -- 'news_scrape', 'parliamentary_update', 'score_calculation'
  
  -- Job Details
  status VARCHAR(20) DEFAULT 'running', -- 'running', 'completed', 'failed'
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  
  -- Statistics
  items_processed INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_messages JSONB,
  
  -- Metadata
  triggered_by VARCHAR(50) DEFAULT 'cron', -- 'cron', 'manual', 'api'
  duration_seconds INTEGER
);

-- Indexes for scraping_jobs
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_type ON scraping_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_started ON scraping_jobs(started_at DESC);

-- ============================================
-- 9. SCORE COMPONENT WEIGHTS (Configurable Weights)
-- ============================================

CREATE TABLE IF NOT EXISTS score_component_weights (
  id SERIAL PRIMARY KEY,
  component_name VARCHAR(50) UNIQUE NOT NULL,
  weight DECIMAL(3,2) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default weights
INSERT INTO score_component_weights (component_name, weight, description) VALUES
  ('news', 0.50, 'News coverage and media analysis'),
  ('parliamentary', 0.30, 'Parliamentary activity and performance'),
  ('constituency', 0.15, 'Constituency service and local work'),
  ('public_trust', 0.05, 'User ratings and public feedback')
ON CONFLICT (component_name) DO NOTHING;

-- ============================================
-- 10. SCORE CALCULATION LOG (Audit Trail)
-- ============================================

CREATE TABLE IF NOT EXISTS score_calculation_log (
  id SERIAL PRIMARY KEY,
  politician_name VARCHAR(255) NOT NULL,
  calculation_type VARCHAR(50), -- 'full_recalc', 'incremental', 'manual'
  
  -- Input Data
  news_article_count INTEGER,
  parliamentary_data_age_days INTEGER,
  user_rating_count INTEGER,
  
  -- Output Scores
  calculated_score INTEGER,
  previous_score INTEGER,
  score_change INTEGER,
  
  -- Metadata
  calculation_duration_ms INTEGER,
  calculation_version VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for score_calculation_log
CREATE INDEX IF NOT EXISTS idx_calc_log_politician ON score_calculation_log(politician_name);
CREATE INDEX IF NOT EXISTS idx_calc_log_created ON score_calculation_log(created_at DESC);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at (idempotent - safe to run multiple times)
DROP TRIGGER IF EXISTS update_parliamentary_activity_updated_at ON parliamentary_activity;
CREATE TRIGGER update_parliamentary_activity_updated_at BEFORE UPDATE ON parliamentary_activity
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_news_articles_updated_at ON news_articles;
CREATE TRIGGER update_news_articles_updated_at BEFORE UPDATE ON news_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_td_ratings_updated_at ON user_td_ratings;
CREATE TRIGGER update_user_td_ratings_updated_at BEFORE UPDATE ON user_td_ratings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PERMISSIONS (Adjust as needed for your setup)
-- ============================================

-- Grant permissions (uncomment if needed)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these to verify tables were created:

-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN (
--   'parliamentary_activity',
--   'news_articles',
--   'td_scores',
--   'td_score_history',
--   'user_td_ratings',
--   'unified_td_scores',
--   'unified_score_history',
--   'scraping_jobs',
--   'score_component_weights',
--   'score_calculation_log'
-- )
-- ORDER BY table_name;

-- Check indexes:
-- SELECT tablename, indexname FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- AND tablename LIKE '%td%' OR tablename LIKE '%news%' OR tablename LIKE '%parliamentary%'
-- ORDER BY tablename, indexname;

-- ============================================
-- 11. TD HISTORICAL BASELINES (AI-Generated Starting Points)
-- ============================================

CREATE TABLE IF NOT EXISTS td_historical_baselines (
  id SERIAL PRIMARY KEY,
  politician_name VARCHAR(255) UNIQUE NOT NULL,
  
  -- Baseline scoring
  baseline_modifier DECIMAL(4,2) NOT NULL DEFAULT 1.00 CHECK (baseline_modifier >= 0.50 AND baseline_modifier <= 1.30),
  baseline_score_0_100 INTEGER CHECK (baseline_score_0_100 >= 0 AND baseline_score_0_100 <= 100),
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  
  -- Categorization
  category VARCHAR(50), -- severe_issues, moderate_issues, minor_issues, neutral, good_record, exceptional_record
  
  -- AI Analysis
  historical_summary TEXT,
  key_findings JSONB, -- Array of {type, title, year, description, impact, source}
  reasoning TEXT,
  controversies_noted JSONB, -- Array of controversies not included in baseline
  data_quality JSONB, -- {sources_found, primary_sources, confidence_factors, research_date}
  
  -- Metadata
  research_date DATE,
  analyzed_by VARCHAR(50) DEFAULT 'claude', -- 'claude', 'gpt4', 'both'
  reviewed_by VARCHAR(255), -- Human reviewer (optional)
  review_notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for td_historical_baselines
CREATE INDEX IF NOT EXISTS idx_historical_baselines_politician ON td_historical_baselines(politician_name);
CREATE INDEX IF NOT EXISTS idx_historical_baselines_category ON td_historical_baselines(category);
CREATE INDEX IF NOT EXISTS idx_historical_baselines_modifier ON td_historical_baselines(baseline_modifier);
CREATE INDEX IF NOT EXISTS idx_historical_baselines_research_date ON td_historical_baselines(research_date DESC);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_td_historical_baselines_updated_at ON td_historical_baselines;
CREATE TRIGGER update_td_historical_baselines_updated_at BEFORE UPDATE ON td_historical_baselines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMPLETE!
-- ============================================

-- You should now have 11 new tables:
-- ✅ parliamentary_activity
-- ✅ news_articles
-- ✅ td_scores
-- ✅ td_score_history
-- ✅ user_td_ratings
-- ✅ unified_td_scores
-- ✅ unified_score_history
-- ✅ scraping_jobs
-- ✅ score_component_weights
-- ✅ score_calculation_log
-- ✅ td_historical_baselines (NEW - AI-generated starting points)

-- ============================================
-- 12. POLICY PROMISES (Promise Tracking for Bias Protection)
-- Tracks announcements and verifies delivery
-- ============================================

CREATE TABLE IF NOT EXISTS policy_promises (
  id SERIAL PRIMARY KEY,
  politician_name VARCHAR(255) NOT NULL,
  promise_text TEXT NOT NULL,
  promise_type VARCHAR(50), -- policy, funding, legislation, reform, service
  
  -- Announcement details
  announced_date DATE NOT NULL,
  source_article_id INTEGER REFERENCES news_articles(id),
  initial_score_given INTEGER, -- Small score given for announcement
  
  -- Promise specifics
  promised_amount VARCHAR(100), -- "€100M"
  promised_quantity VARCHAR(100), -- "10,000 families"
  promised_outcome TEXT,
  promised_timeline VARCHAR(100), -- "Q2 2026"
  
  -- Target
  target_date DATE,
  target_metrics JSONB,
  
  -- Actual delivery
  actual_amount VARCHAR(100),
  actual_quantity VARCHAR(100),
  actual_outcome TEXT,
  delivery_date DATE,
  
  -- Outcome
  status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, delivered, partial, failed, broken
  outcome_verified_date DATE,
  outcome_score INTEGER, -- Score adjustment when verified (positive if delivered, negative if broken)
  
  -- Verification
  verification_sources JSONB,
  verification_evidence TEXT,
  verified_by VARCHAR(50), -- 'ai', 'manual'
  
  -- Follow-up tracking
  follow_up_article_ids INTEGER[],
  last_checked DATE,
  next_check_date DATE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for policy_promises
CREATE INDEX IF NOT EXISTS idx_policy_promises_politician ON policy_promises(politician_name);
CREATE INDEX IF NOT EXISTS idx_policy_promises_status ON policy_promises(status);
CREATE INDEX IF NOT EXISTS idx_policy_promises_target_date ON policy_promises(target_date);
CREATE INDEX IF NOT EXISTS idx_policy_promises_next_check ON policy_promises(next_check_date);
CREATE INDEX IF NOT EXISTS idx_policy_promises_announced ON policy_promises(announced_date DESC);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_policy_promises_updated_at ON policy_promises;
CREATE TRIGGER update_policy_promises_updated_at BEFORE UPDATE ON policy_promises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ✅ policy_promises (NEW - Tracks announcements and verifies delivery)

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enable public access to user ratings
-- ============================================

-- Enable RLS on user_td_ratings table
ALTER TABLE user_td_ratings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Public can insert ratings" ON user_td_ratings;
DROP POLICY IF EXISTS "Public can read ratings" ON user_td_ratings;
DROP POLICY IF EXISTS "Public can update ratings" ON user_td_ratings;
DROP POLICY IF EXISTS "Public can delete ratings" ON user_td_ratings;

-- Allow anyone to insert ratings (authenticated or anonymous)
CREATE POLICY "Public can insert ratings"
ON user_td_ratings FOR INSERT
TO public
WITH CHECK (true);

-- Allow anyone to read all ratings
CREATE POLICY "Public can read ratings"
ON user_td_ratings FOR SELECT
TO public
USING (true);

-- Allow anyone to update ratings (they can update their own based on user_id matching)
CREATE POLICY "Public can update ratings"
ON user_td_ratings FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Allow anyone to delete ratings (optional - can restrict later)
CREATE POLICY "Public can delete ratings"
ON user_td_ratings FOR DELETE
TO public
USING (true);

-- Note: In production, you may want to restrict these policies to:
-- - Only allow users to update/delete their own ratings (WHERE user_id = auth.uid())
-- - Require authentication for submissions (TO authenticated instead of TO public)
-- - Add rate limiting via Supabase edge functions
-- For now, we allow public access to test the system

-- ============================================
-- PERMISSIONS FIX COMPLETE
-- ============================================
-- Run this entire SQL file in Supabase SQL Editor to:
-- 1. Create all 10 data collection tables
-- 2. Set up indexes and triggers
-- 3. Enable public access to user ratings
--
-- After running, test with:
--   npx tsx test-rating-submit.ts
--
-- Expected: Rating submitted successfully! ✅
-- ============================================

