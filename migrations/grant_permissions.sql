-- Grant Permissions on News Tables
-- Run this in Supabase SQL Editor

-- Grant all permissions to authenticated users and service_role
GRANT ALL ON TABLE news_articles TO authenticated;
GRANT ALL ON TABLE news_articles TO service_role;
GRANT ALL ON TABLE news_articles TO anon;

GRANT ALL ON TABLE td_scores TO authenticated;
GRANT ALL ON TABLE td_scores TO service_role;
GRANT ALL ON TABLE td_scores TO anon;

GRANT ALL ON TABLE td_score_history TO authenticated;
GRANT ALL ON TABLE td_score_history TO service_role;
GRANT ALL ON TABLE td_score_history TO anon;

GRANT ALL ON TABLE news_sources TO authenticated;
GRANT ALL ON TABLE news_sources TO service_role;
GRANT ALL ON TABLE news_sources TO anon;

GRANT ALL ON TABLE scraping_jobs TO authenticated;
GRANT ALL ON TABLE scraping_jobs TO service_role;
GRANT ALL ON TABLE scraping_jobs TO anon;

-- Grant sequence permissions (needed for SERIAL columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Verify grants
SELECT 
  tablename,
  CASE 
    WHEN has_table_privilege('anon', 'public.' || tablename, 'SELECT') 
    THEN '✅ anon can read'
    ELSE '❌ anon blocked'
  END as anon_permission,
  CASE 
    WHEN has_table_privilege('service_role', 'public.' || tablename, 'SELECT') 
    THEN '✅ service_role can read'
    ELSE '❌ service_role blocked'
  END as service_permission
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('news_articles', 'td_scores', 'td_score_history', 'news_sources', 'scraping_jobs')
ORDER BY tablename;

