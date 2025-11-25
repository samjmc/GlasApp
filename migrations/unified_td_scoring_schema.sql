/**
 * Unified TD Scoring System - Database Schema
 * 
 * This migration creates tables for the comprehensive unified scoring system
 * that combines news analysis, parliamentary activity, and user feedback
 * into a single authoritative score (0-100 scale).
 */

-- ============================================
-- 1. UNIFIED TD SCORES TABLE (Main scores table)
-- ============================================

CREATE TABLE IF NOT EXISTS unified_td_scores (
  id SERIAL PRIMARY KEY,
  politician_name VARCHAR(255) UNIQUE NOT NULL,
  constituency VARCHAR(100) NOT NULL,
  party VARCHAR(100),
  
  -- ============================================
  -- PRIMARY SCORES (0-100 scale) ← What users see
  -- ============================================
  overall_score DECIMAL(5,2) NOT NULL DEFAULT 50.00,  -- THE main score
  
  -- Component scores (0-100 each, showing what contributes)
  news_score DECIMAL(5,2) DEFAULT 50.00,              -- From news analysis (50% weight)
  parliamentary_score DECIMAL(5,2) DEFAULT 50.00,     -- From Dáil activity (30% weight)
  constituency_score DECIMAL(5,2) DEFAULT 50.00,      -- From local work (15% weight)
  public_trust_score DECIMAL(5,2) DEFAULT 50.00,      -- From user ratings (5% weight)
  
  -- Dimensional scores (0-100 each)
  transparency_score DECIMAL(5,2) DEFAULT 50.00,
  effectiveness_score DECIMAL(5,2) DEFAULT 50.00,
  integrity_score DECIMAL(5,2) DEFAULT 50.00,
  consistency_score DECIMAL(5,2) DEFAULT 50.00,
  constituency_service_score DECIMAL(5,2) DEFAULT 50.00,
  
  -- ============================================
  -- LEGACY ELO SCORES (for backward compatibility)
  -- ============================================
  overall_elo INTEGER DEFAULT 1500,
  transparency_elo INTEGER DEFAULT 1500,
  effectiveness_elo INTEGER DEFAULT 1500,
  integrity_elo INTEGER DEFAULT 1500,
  consistency_elo INTEGER DEFAULT 1500,
  constituency_service_elo INTEGER DEFAULT 1500,
  
  -- ============================================
  -- RANKINGS (Updated daily)
  -- ============================================
  national_rank INTEGER,
  constituency_rank INTEGER,
  party_rank INTEGER,
  
  -- ============================================
  -- TRENDS & CHANGES
  -- ============================================
  weekly_change DECIMAL(5,2) DEFAULT 0.00,     -- Change in overall_score this week
  monthly_change DECIMAL(5,2) DEFAULT 0.00,    -- Change in overall_score this month
  trend VARCHAR(20) DEFAULT 'stable',           -- 'improving', 'declining', 'stable'
  
  -- ============================================
  -- STATISTICS
  -- ============================================
  total_stories INTEGER DEFAULT 0,
  positive_stories INTEGER DEFAULT 0,
  negative_stories INTEGER DEFAULT 0,
  neutral_stories INTEGER DEFAULT 0,
  
  questions_asked INTEGER DEFAULT 0,
  attendance_percentage DECIMAL(5,2),
  committee_participations INTEGER DEFAULT 0,
  
  bills_proposed INTEGER DEFAULT 0,
  bills_passed INTEGER DEFAULT 0,
  
  clinics_held INTEGER DEFAULT 0,
  cases_resolved INTEGER DEFAULT 0,
  
  -- ============================================
  -- QUALITY INDICATORS
  -- ============================================
  confidence_score DECIMAL(3,2) DEFAULT 0.50,   -- 0-1 based on data availability
  data_sources_count INTEGER DEFAULT 0,          -- How many data sources we have
  last_news_update TIMESTAMP,
  last_parliamentary_update TIMESTAMP,
  last_user_rating_update TIMESTAMP,
  
  -- ============================================
  -- METADATA
  -- ============================================
  last_calculated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_unified_scores_overall ON unified_td_scores(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_unified_scores_constituency ON unified_td_scores(constituency);
CREATE INDEX IF NOT EXISTS idx_unified_scores_party ON unified_td_scores(party);
CREATE INDEX IF NOT EXISTS idx_unified_scores_rank ON unified_td_scores(national_rank);

-- ============================================
-- 2. SCORE HISTORY TABLE (Track changes over time)
-- ============================================

CREATE TABLE IF NOT EXISTS unified_score_history (
  id SERIAL PRIMARY KEY,
  politician_name VARCHAR(255) NOT NULL,
  
  -- What changed
  old_overall_score DECIMAL(5,2) NOT NULL,
  new_overall_score DECIMAL(5,2) NOT NULL,
  score_change DECIMAL(5,2) NOT NULL,
  
  -- What caused the change
  trigger_type VARCHAR(50) NOT NULL,  -- 'news_article', 'parliamentary_update', 'user_rating', 'manual'
  trigger_id INTEGER,                   -- ID of the article/event that caused change
  
  -- Component that changed most
  primary_component VARCHAR(50),         -- 'news', 'parliamentary', 'constituency', 'public_trust'
  component_change DECIMAL(5,2),
  
  -- Snapshot of all scores at this point
  news_score DECIMAL(5,2),
  parliamentary_score DECIMAL(5,2),
  constituency_score DECIMAL(5,2),
  public_trust_score DECIMAL(5,2),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for querying history
CREATE INDEX IF NOT EXISTS idx_score_history_politician ON unified_score_history(politician_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_history_date ON unified_score_history(created_at DESC);

-- ============================================
-- 3. SCORE CALCULATION LOG (Audit trail)
-- ============================================

CREATE TABLE IF NOT EXISTS score_calculation_log (
  id SERIAL PRIMARY KEY,
  calculation_id UUID DEFAULT gen_random_uuid(),
  
  -- What was calculated
  calculation_type VARCHAR(50) NOT NULL,  -- 'full_recalc', 'single_td', 'news_update', 'rankings'
  tds_affected INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(20) NOT NULL,             -- 'running', 'completed', 'failed'
  error_message TEXT,
  
  -- Performance
  duration_ms INTEGER,
  db_queries INTEGER,
  api_calls INTEGER,
  
  -- Metadata
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- ============================================
-- 4. USER TD RATINGS TABLE (Public trust component)
-- ============================================

CREATE TABLE IF NOT EXISTS user_td_ratings (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  politician_name VARCHAR(255) NOT NULL,
  
  -- Rating (1-5 stars → converted to 0-100)
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  
  -- Optional feedback
  comment TEXT,
  category VARCHAR(50),  -- 'overall', 'transparency', 'effectiveness', etc.
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, politician_name, category)
);

-- Index for aggregating ratings
CREATE INDEX IF NOT EXISTS idx_user_ratings_politician ON user_td_ratings(politician_name);
CREATE INDEX IF NOT EXISTS idx_user_ratings_user ON user_td_ratings(user_id);

-- ============================================
-- 5. DATA SOURCE TRACKING (Monitor what data we have)
-- ============================================

CREATE TABLE IF NOT EXISTS td_data_sources (
  id SERIAL PRIMARY KEY,
  politician_name VARCHAR(255) NOT NULL,
  
  -- Which data sources are available
  has_news_data BOOLEAN DEFAULT FALSE,
  has_parliamentary_data BOOLEAN DEFAULT FALSE,
  has_legislative_data BOOLEAN DEFAULT FALSE,
  has_constituency_data BOOLEAN DEFAULT FALSE,
  has_user_ratings BOOLEAN DEFAULT FALSE,
  
  -- Data freshness
  news_last_updated TIMESTAMP,
  parliamentary_last_updated TIMESTAMP,
  ratings_last_updated TIMESTAMP,
  
  -- Data counts
  news_articles_count INTEGER DEFAULT 0,
  parliamentary_questions_count INTEGER DEFAULT 0,
  user_ratings_count INTEGER DEFAULT 0,
  
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(politician_name)
);

-- ============================================
-- 6. COMPONENT WEIGHTS TABLE (Configure weighting)
-- ============================================

CREATE TABLE IF NOT EXISTS score_component_weights (
  id SERIAL PRIMARY KEY,
  component_name VARCHAR(50) UNIQUE NOT NULL,
  weight DECIMAL(3,2) NOT NULL CHECK (weight BETWEEN 0 AND 1),
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default weights
INSERT INTO score_component_weights (component_name, weight, description) VALUES
  ('news', 0.50, 'News analysis and media coverage'),
  ('parliamentary', 0.30, 'Parliamentary activity (questions, attendance, committee work)'),
  ('constituency', 0.15, 'Constituency service and local engagement'),
  ('public_trust', 0.05, 'User ratings and community feedback')
ON CONFLICT (component_name) DO NOTHING;

-- ============================================
-- 7. VIEWS FOR COMMON QUERIES
-- ============================================

-- Top performers view
CREATE OR REPLACE VIEW top_performing_tds AS
SELECT 
  politician_name,
  constituency,
  party,
  overall_score,
  national_rank,
  weekly_change,
  confidence_score
FROM unified_td_scores
WHERE confidence_score >= 0.3  -- Only include TDs with sufficient data
ORDER BY overall_score DESC
LIMIT 20;

-- Constituency leaderboard view
CREATE OR REPLACE VIEW constituency_leaderboards AS
SELECT 
  constituency,
  politician_name,
  party,
  overall_score,
  constituency_rank,
  ROW_NUMBER() OVER (PARTITION BY constituency ORDER BY overall_score DESC) as position
FROM unified_td_scores
ORDER BY constituency, overall_score DESC;

-- Party averages view
CREATE OR REPLACE VIEW party_performance_averages AS
SELECT 
  party,
  COUNT(*) as td_count,
  ROUND(AVG(overall_score), 2) as avg_overall_score,
  ROUND(AVG(transparency_score), 2) as avg_transparency,
  ROUND(AVG(effectiveness_score), 2) as avg_effectiveness,
  ROUND(AVG(integrity_score), 2) as avg_integrity
FROM unified_td_scores
WHERE party IS NOT NULL
GROUP BY party
ORDER BY avg_overall_score DESC;

-- ============================================
-- 8. TRIGGERS FOR AUTO-UPDATE
-- ============================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_unified_td_scores_updated_at 
  BEFORE UPDATE ON unified_td_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_td_ratings_updated_at
  BEFORE UPDATE ON user_td_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. FUNCTIONS FOR SCORE CALCULATIONS
-- ============================================

-- Calculate trend based on recent changes
CREATE OR REPLACE FUNCTION calculate_trend(weekly_change DECIMAL, monthly_change DECIMAL)
RETURNS VARCHAR(20) AS $$
BEGIN
  IF weekly_change > 2 OR monthly_change > 5 THEN
    RETURN 'improving';
  ELSIF weekly_change < -2 OR monthly_change < -5 THEN
    RETURN 'declining';
  ELSE
    RETURN 'stable';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- NOTES
-- ============================================

-- This schema provides:
-- ✅ Single source of truth for TD scores
-- ✅ 0-100 scale (user-friendly)
-- ✅ Historical tracking
-- ✅ Configurable weights
-- ✅ Quality indicators
-- ✅ Backward compatibility (ELO scores maintained)

-- Usage:
-- - Frontend shows overall_score (0-100)
-- - Click for breakdown (components + dimensions)
-- - Historical chart from score_history
-- - Leaderboards from views

