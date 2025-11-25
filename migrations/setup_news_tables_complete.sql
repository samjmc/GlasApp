-- Complete News Tables Setup
-- Run this entire script in Supabase SQL Editor
-- It will: Create tables (if missing) + Disable RLS + Seed data

-- ============================================================================
-- STEP 1: CREATE TABLES (if they don't exist)
-- ============================================================================

-- News articles table
CREATE TABLE IF NOT EXISTS news_articles (
  id SERIAL PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source VARCHAR(100) NOT NULL,
  published_date TIMESTAMP NOT NULL,
  fetched_at TIMESTAMP DEFAULT NOW(),
  
  politician_name VARCHAR(255),
  constituency VARCHAR(100),
  party VARCHAR(100),
  
  story_type VARCHAR(50),
  sentiment VARCHAR(20),
  impact_score DECIMAL(4,2),
  
  transparency_impact DECIMAL(4,2),
  effectiveness_impact DECIMAL(4,2),
  integrity_impact DECIMAL(4,2),
  consistency_impact DECIMAL(4,2),
  constituency_service_impact DECIMAL(4,2),
  
  ai_summary TEXT,
  ai_reasoning TEXT,
  key_quotes TEXT,
  
  processed BOOLEAN DEFAULT FALSE,
  score_applied BOOLEAN DEFAULT FALSE,
  needs_review BOOLEAN DEFAULT FALSE,
  credibility_score DECIMAL(3,2) DEFAULT 0.8,
  
  analyzed_by VARCHAR(50),
  cross_checked BOOLEAN DEFAULT FALSE,
  
  image_url TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_politician ON news_articles(politician_name);
CREATE INDEX IF NOT EXISTS idx_news_date ON news_articles(published_date);
CREATE INDEX IF NOT EXISTS idx_news_processed ON news_articles(processed);

-- TD Scores table
CREATE TABLE IF NOT EXISTS td_scores (
  id SERIAL PRIMARY KEY,
  politician_name VARCHAR(255) UNIQUE NOT NULL,
  constituency VARCHAR(100) NOT NULL,
  party VARCHAR(100),
  
  overall_elo INTEGER DEFAULT 1500 NOT NULL,
  
  transparency_elo INTEGER DEFAULT 1500 NOT NULL,
  effectiveness_elo INTEGER DEFAULT 1500 NOT NULL,
  integrity_elo INTEGER DEFAULT 1500 NOT NULL,
  consistency_elo INTEGER DEFAULT 1500 NOT NULL,
  constituency_service_elo INTEGER DEFAULT 1500 NOT NULL,
  
  total_stories INTEGER DEFAULT 0 NOT NULL,
  positive_stories INTEGER DEFAULT 0 NOT NULL,
  negative_stories INTEGER DEFAULT 0 NOT NULL,
  neutral_stories INTEGER DEFAULT 0 NOT NULL,
  
  national_rank INTEGER,
  constituency_rank INTEGER,
  party_rank INTEGER,
  
  weekly_elo_change INTEGER DEFAULT 0,
  monthly_elo_change INTEGER DEFAULT 0,
  
  image_url TEXT,
  bio TEXT,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_td_constituency ON td_scores(constituency);
CREATE INDEX IF NOT EXISTS idx_td_overall_elo ON td_scores(overall_elo);

-- Score history table
CREATE TABLE IF NOT EXISTS td_score_history (
  id SERIAL PRIMARY KEY,
  politician_name VARCHAR(255) NOT NULL,
  article_id INTEGER,
  
  old_overall_elo INTEGER NOT NULL,
  new_overall_elo INTEGER NOT NULL,
  elo_change INTEGER NOT NULL,
  
  dimension_affected VARCHAR(50),
  impact_score DECIMAL(4,2),
  story_type VARCHAR(50),
  
  article_url TEXT,
  article_title TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_politician ON td_score_history(politician_name);
CREATE INDEX IF NOT EXISTS idx_history_date ON td_score_history(created_at);

-- News sources table
CREATE TABLE IF NOT EXISTS news_sources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  url TEXT NOT NULL,
  rss_feed TEXT,
  scraping_enabled BOOLEAN DEFAULT TRUE,
  credibility_score DECIMAL(3,2) DEFAULT 0.8,
  political_bias VARCHAR(20),
  constituency VARCHAR(100),
  last_scraped TIMESTAMP,
  articles_processed INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Scraping jobs table
CREATE TABLE IF NOT EXISTS scraping_jobs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  
  articles_found INTEGER DEFAULT 0,
  articles_processed INTEGER DEFAULT 0,
  tds_mentioned INTEGER DEFAULT 0,
  scores_updated INTEGER DEFAULT 0,
  
  errors TEXT,
  duration_ms INTEGER,
  
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- ============================================================================
-- STEP 2: DISABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE news_articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE td_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE td_score_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE news_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_jobs DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: SEED INITIAL DATA
-- ============================================================================

INSERT INTO news_sources (name, url, rss_feed, credibility_score, political_bias) VALUES
  ('The Irish Times', 'https://www.irishtimes.com', 'https://www.irishtimes.com/cmlink/news-1.1319192', 0.95, 'center'),
  ('The Journal', 'https://www.thejournal.ie', 'https://www.thejournal.ie/feed', 0.90, 'neutral'),
  ('Irish Independent', 'https://www.independent.ie', 'https://www.independent.ie/rss', 0.85, 'center-right'),
  ('RTE News', 'https://www.rte.ie/news', 'https://www.rte.ie/rss/news.xml', 0.95, 'neutral'),
  ('Breaking News', 'https://www.breakingnews.ie', 'https://www.breakingnews.ie/rss', 0.80, 'neutral'),
  ('Irish Mirror Politics', 'https://www.irishmirror.ie', NULL, 0.75, 'neutral')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- STEP 4: VERIFY SETUP
-- ============================================================================

SELECT 
  '✅ Setup complete!' as status,
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('news_articles', 'td_scores', 'td_score_history', 'news_sources', 'scraping_jobs')) as tables_created,
  (SELECT COUNT(*) FROM news_sources) as news_sources_count;

-- Check RLS status
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '🔒 Enabled' ELSE '🔓 Disabled' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('news_articles', 'td_scores', 'td_score_history', 'news_sources', 'scraping_jobs')
ORDER BY tablename;

