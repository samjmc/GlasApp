-- Disable Row Level Security on News Tables
-- This allows the service_role key to access the tables
-- Run this via Supabase SQL Editor

-- Disable RLS on news_articles
ALTER TABLE news_articles DISABLE ROW LEVEL SECURITY;

-- Disable RLS on td_scores  
ALTER TABLE td_scores DISABLE ROW LEVEL SECURITY;

-- Disable RLS on td_score_history
ALTER TABLE td_score_history DISABLE ROW LEVEL SECURITY;

-- Disable RLS on news_sources
ALTER TABLE news_sources DISABLE ROW LEVEL SECURITY;

-- Disable RLS on scraping_jobs
ALTER TABLE scraping_jobs DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('news_articles', 'td_scores', 'td_score_history', 'news_sources', 'scraping_jobs')
ORDER BY tablename;

