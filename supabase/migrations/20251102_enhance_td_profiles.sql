-- Migration: Enhance td_scores table with additional member data
-- Adding fields available from /members endpoint that we weren't using

-- Add new columns for enhanced TD profiles
ALTER TABLE td_scores 
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS wikipedia_title TEXT,
  ADD COLUMN IF NOT EXISTS member_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS member_uri TEXT,
  ADD COLUMN IF NOT EXISTS offices JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS membership_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS date_of_death DATE,
  ADD COLUMN IF NOT EXISTS has_profile_image BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_term_start DATE,
  ADD COLUMN IF NOT EXISTS first_elected_date DATE;

-- Add indexes for new searchable fields
CREATE INDEX IF NOT EXISTS idx_td_scores_gender ON td_scores(gender);
CREATE INDEX IF NOT EXISTS idx_td_scores_member_code ON td_scores(member_code);
CREATE INDEX IF NOT EXISTS idx_td_scores_offices ON td_scores USING gin(offices);
CREATE INDEX IF NOT EXISTS idx_td_scores_first_elected ON td_scores(first_elected_date);

-- Add comments for documentation
COMMENT ON COLUMN td_scores.gender IS 'TD gender (male, female, other)';
COMMENT ON COLUMN td_scores.wikipedia_title IS 'Wikipedia page title for linking';
COMMENT ON COLUMN td_scores.member_code IS 'Oireachtas API member code (unique identifier)';
COMMENT ON COLUMN td_scores.member_uri IS 'Oireachtas API member URI';
COMMENT ON COLUMN td_scores.offices IS 'Array of current offices held (Minister, Chair, Whip, etc.)';
COMMENT ON COLUMN td_scores.membership_history IS 'Historical record of party changes and term dates';
COMMENT ON COLUMN td_scores.has_profile_image IS 'Whether Oireachtas has a profile image for this TD';
COMMENT ON COLUMN td_scores.current_term_start IS 'Start date of current Dáil term';
COMMENT ON COLUMN td_scores.first_elected_date IS 'Date first elected to Dáil (any term)';

-- Create view for government positions
CREATE OR REPLACE VIEW government_positions AS
SELECT 
  ts.id,
  ts.politician_name,
  ts.party,
  ts.constituency,
  ts.offices,
  ts.overall_elo as performance_score,
  CASE 
    WHEN ts.offices::text LIKE '%Minister%' THEN 'Minister'
    WHEN ts.offices::text LIKE '%Chair%' THEN 'Committee Chair'
    WHEN ts.offices::text LIKE '%Whip%' THEN 'Party Whip'
    ELSE 'TD'
  END as position_type
FROM td_scores ts
WHERE ts.offices IS NOT NULL 
  AND jsonb_array_length(ts.offices) > 0
ORDER BY 
  CASE 
    WHEN ts.offices::text LIKE '%Taoiseach%' THEN 1
    WHEN ts.offices::text LIKE '%Tánaiste%' THEN 2
    WHEN ts.offices::text LIKE '%Minister%' THEN 3
    WHEN ts.offices::text LIKE '%Chair%' THEN 4
    ELSE 5
  END,
  ts.politician_name;

COMMENT ON VIEW government_positions IS 'TDs who hold government or committee positions';

-- Create view for gender diversity analysis
CREATE OR REPLACE VIEW gender_diversity_stats AS
SELECT 
  party,
  COUNT(*) as total_tds,
  COUNT(*) FILTER (WHERE gender = 'male') as male_count,
  COUNT(*) FILTER (WHERE gender = 'female') as female_count,
  ROUND(
    (COUNT(*) FILTER (WHERE gender = 'female')::numeric / NULLIF(COUNT(*), 0)::numeric * 100), 
    1
  ) as female_percentage
FROM td_scores
WHERE party IS NOT NULL
GROUP BY party
ORDER BY total_tds DESC;

COMMENT ON VIEW gender_diversity_stats IS 'Gender breakdown by political party';

-- Create view for seniority/experience
CREATE OR REPLACE VIEW td_seniority AS
SELECT 
  id,
  politician_name,
  party,
  constituency,
  first_elected_date,
  current_term_start,
  CASE 
    WHEN first_elected_date IS NOT NULL 
    THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, first_elected_date))
    ELSE NULL
  END as years_in_dail,
  CASE
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, first_elected_date)) >= 20 THEN 'Veteran (20+ years)'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, first_elected_date)) >= 10 THEN 'Senior (10-20 years)'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, first_elected_date)) >= 5 THEN 'Experienced (5-10 years)'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, first_elected_date)) >= 0 THEN 'Junior (0-5 years)'
    ELSE 'Unknown'
  END as seniority_level
FROM td_scores
WHERE first_elected_date IS NOT NULL
ORDER BY first_elected_date ASC;

COMMENT ON VIEW td_seniority IS 'TD seniority and experience levels';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Enhanced TD profile fields added';
  RAISE NOTICE '✅ New indexes created for performance';
  RAISE NOTICE '✅ Views created: government_positions, gender_diversity_stats, td_seniority';
  RAISE NOTICE '📊 Ready to populate with enhanced member data';
END $$;

