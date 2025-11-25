-- Migration: Create td_questions table for storing parliamentary questions
-- This enables detailed tracking of TD accountability through questions asked

-- Create td_questions table
CREATE TABLE IF NOT EXISTS td_questions (
  id SERIAL PRIMARY KEY,
  td_id INTEGER REFERENCES td_scores(id) ON DELETE CASCADE,
  
  -- Question identification
  question_id TEXT UNIQUE NOT NULL,
  question_uri TEXT,
  question_number TEXT,
  question_type TEXT CHECK (question_type IN ('oral', 'written')),
  
  -- Dates
  date_asked DATE NOT NULL,
  date_answered DATE,
  response_time_days INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN date_answered IS NOT NULL THEN (date_answered - date_asked)
      ELSE NULL
    END
  ) STORED,
  
  -- Subject and content
  subject TEXT,
  question_text TEXT,
  answer_text TEXT,
  
  -- Ministerial details
  minister_name TEXT,
  minister_uri TEXT,
  department TEXT,
  
  -- AI-enhanced fields
  ai_topic TEXT,  -- AI-extracted topic category (Housing, Health, Crime, etc.)
  ai_sentiment TEXT,  -- Sentiment of answer (positive, neutral, negative)
  ai_answer_quality_score FLOAT,  -- AI score of answer completeness (0-100)
  ai_extracted_at TIMESTAMP,
  
  -- Links
  debate_uri TEXT,
  debate_section TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_td_questions_td_id ON td_questions(td_id);
CREATE INDEX idx_td_questions_date_asked ON td_questions(date_asked DESC);
CREATE INDEX idx_td_questions_question_type ON td_questions(question_type);
CREATE INDEX idx_td_questions_minister ON td_questions(minister_name);
CREATE INDEX idx_td_questions_ai_topic ON td_questions(ai_topic);
CREATE INDEX idx_td_questions_date_range ON td_questions(date_asked, date_answered);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_td_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_td_questions_updated_at
  BEFORE UPDATE ON td_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_td_questions_updated_at();

-- Add helpful comments
COMMENT ON TABLE td_questions IS 'Stores parliamentary questions asked by TDs with AI-enhanced analysis';
COMMENT ON COLUMN td_questions.response_time_days IS 'Automatically calculated as date_answered - date_asked';
COMMENT ON COLUMN td_questions.ai_topic IS 'AI-extracted topic category for easier filtering';
COMMENT ON COLUMN td_questions.ai_sentiment IS 'AI-analyzed sentiment of ministerial answer';
COMMENT ON COLUMN td_questions.ai_answer_quality_score IS 'AI-scored quality of answer (0-100), based on completeness and directness';

-- Create view for TD question statistics
CREATE OR REPLACE VIEW td_question_stats AS
SELECT 
  td_id,
  COUNT(*) as total_questions,
  COUNT(*) FILTER (WHERE question_type = 'oral') as oral_questions,
  COUNT(*) FILTER (WHERE question_type = 'written') as written_questions,
  COUNT(*) FILTER (WHERE date_answered IS NOT NULL) as answered_questions,
  COUNT(*) FILTER (WHERE date_answered IS NULL) as unanswered_questions,
  ROUND(AVG(response_time_days)::numeric, 1) as avg_response_time_days,
  MAX(date_asked) as most_recent_question_date,
  MIN(date_asked) as earliest_question_date
FROM td_questions
GROUP BY td_id;

COMMENT ON VIEW td_question_stats IS 'Aggregated statistics for TD questions - useful for quick lookups';

-- Grant appropriate permissions (adjust based on your roles)
-- GRANT SELECT ON td_questions TO authenticated;
-- GRANT SELECT ON td_question_stats TO authenticated;
-- GRANT ALL ON td_questions TO service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ td_questions table created successfully';
  RAISE NOTICE '✅ Indexes created for optimal query performance';
  RAISE NOTICE '✅ View td_question_stats created for aggregations';
END $$;

