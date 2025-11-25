-- Migration: Create News Scoring System Tables
-- Created: 2025-10-26
-- Run this via MCP or Supabase SQL Editor

-- News articles table
CREATE TABLE IF NOT EXISTS news_articles (
  id SERIAL PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source VARCHAR(100) NOT NULL,
  published_date TIMESTAMP NOT NULL,
  fetched_at TIMESTAMP DEFAULT NOW(),
  
  -- TD linkage
  politician_name VARCHAR(255),
  constituency VARCHAR(100),
  party VARCHAR(100),
  
  -- AI Analysis results
  story_type VARCHAR(50), -- scandal, achievement, policy_work, etc.
  sentiment VARCHAR(20), -- very_positive, positive, neutral, negative, very_negative
  impact_score DECIMAL(4,2), -- -10.00 to +10.00
  
  -- Dimensional impacts
  transparency_impact DECIMAL(4,2),
  effectiveness_impact DECIMAL(4,2),
  integrity_impact DECIMAL(4,2),
  consistency_impact DECIMAL(4,2),
  constituency_service_impact DECIMAL(4,2),
  
  -- AI analysis details
  ai_summary TEXT,
  ai_reasoning TEXT,
  key_quotes TEXT, -- JSON array
  
  -- Processing status
  processed BOOLEAN DEFAULT FALSE,
  score_applied BOOLEAN DEFAULT FALSE,
  needs_review BOOLEAN DEFAULT FALSE, -- Flag for human review
  credibility_score DECIMAL(3,2) DEFAULT 0.8,
  
  -- AI model info
  analyzed_by VARCHAR(50), -- 'claude', 'gpt4', 'both'
  cross_checked BOOLEAN DEFAULT FALSE,
  
  -- Image URL for frontend display
  image_url TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for news_articles
CREATE INDEX IF NOT EXISTS idx_news_politician ON news_articles(politician_name);
CREATE INDEX IF NOT EXISTS idx_news_date ON news_articles(published_date);
CREATE INDEX IF NOT EXISTS idx_news_processed ON news_articles(processed);

-- TD Scores table (ELO-style ratings)
CREATE TABLE IF NOT EXISTS td_scores (
  id SERIAL PRIMARY KEY,
  politician_name VARCHAR(255) UNIQUE NOT NULL,
  constituency VARCHAR(100) NOT NULL,
  party VARCHAR(100),
  
  -- Overall ELO score
  overall_elo INTEGER DEFAULT 1500 NOT NULL,
  
  -- Dimensional ELO scores
  transparency_elo INTEGER DEFAULT 1500 NOT NULL,
  effectiveness_elo INTEGER DEFAULT 1500 NOT NULL,
  integrity_elo INTEGER DEFAULT 1500 NOT NULL,
  consistency_elo INTEGER DEFAULT 1500 NOT NULL,
  constituency_service_elo INTEGER DEFAULT 1500 NOT NULL,
  
  -- Statistics
  total_stories INTEGER DEFAULT 0 NOT NULL,
  positive_stories INTEGER DEFAULT 0 NOT NULL,
  negative_stories INTEGER DEFAULT 0 NOT NULL,
  neutral_stories INTEGER DEFAULT 0 NOT NULL,
  
  -- Rankings
  national_rank INTEGER,
  constituency_rank INTEGER,
  party_rank INTEGER,
  
  -- Week-over-week change
  weekly_elo_change INTEGER DEFAULT 0,
  monthly_elo_change INTEGER DEFAULT 0,
  
  -- Metadata
  image_url TEXT,
  bio TEXT,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for td_scores
CREATE INDEX IF NOT EXISTS idx_td_constituency ON td_scores(constituency);
CREATE INDEX IF NOT EXISTS idx_td_overall_elo ON td_scores(overall_elo);

-- Score history for tracking changes over time
CREATE TABLE IF NOT EXISTS td_score_history (
  id SERIAL PRIMARY KEY,
  politician_name VARCHAR(255) NOT NULL,
  article_id INTEGER, -- References news_articles.id
  
  -- Score changes
  old_overall_elo INTEGER NOT NULL,
  new_overall_elo INTEGER NOT NULL,
  elo_change INTEGER NOT NULL,
  
  -- What caused the change
  dimension_affected VARCHAR(50),
  impact_score DECIMAL(4,2),
  story_type VARCHAR(50),
  
  -- Metadata
  article_url TEXT,
  article_title TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for td_score_history
CREATE INDEX IF NOT EXISTS idx_history_politician ON td_score_history(politician_name);
CREATE INDEX IF NOT EXISTS idx_history_date ON td_score_history(created_at);

-- News sources configuration
CREATE TABLE IF NOT EXISTS news_sources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  url TEXT NOT NULL,
  rss_feed TEXT,
  scraping_enabled BOOLEAN DEFAULT TRUE,
  credibility_score DECIMAL(3,2) DEFAULT 0.8,
  political_bias VARCHAR(20), -- 'left', 'center', 'right', 'neutral'
  constituency VARCHAR(100), -- null for national news
  last_scraped TIMESTAMP,
  articles_processed INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Scraping jobs log
CREATE TABLE IF NOT EXISTS scraping_jobs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(50) NOT NULL, -- 'daily_scrape', 'manual_scrape', etc.
  status VARCHAR(20) NOT NULL, -- 'running', 'completed', 'failed'
  
  -- Results
  articles_found INTEGER DEFAULT 0,
  articles_processed INTEGER DEFAULT 0,
  tds_mentioned INTEGER DEFAULT 0,
  scores_updated INTEGER DEFAULT 0,
  
  -- Error tracking
  errors TEXT, -- JSON array of errors
  
  -- Performance
  duration_ms INTEGER,
  
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Insert initial news sources
INSERT INTO news_sources (name, url, rss_feed, credibility_score, political_bias) VALUES
  ('The Irish Times', 'https://www.irishtimes.com', 'https://www.irishtimes.com/cmlink/news-1.1319192', 0.95, 'center'),
  ('The Journal', 'https://www.thejournal.ie', 'https://www.thejournal.ie/feed', 0.90, 'neutral'),
  ('Irish Independent', 'https://www.independent.ie', 'https://www.independent.ie/rss', 0.85, 'center-right'),
  ('RTE News', 'https://www.rte.ie/news', 'https://www.rte.ie/rss/news.xml', 0.95, 'neutral'),
  ('Breaking News', 'https://www.breakingnews.ie', 'https://www.breakingnews.ie/rss', 0.80, 'neutral')
ON CONFLICT (name) DO NOTHING;

-- Success message
SELECT 
  '✅ News scoring tables created successfully!' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('news_articles', 'td_scores', 'td_score_history', 'news_sources', 'scraping_jobs')) as tables_created,
  (SELECT COUNT(*) FROM news_sources) as news_sources_seeded;

