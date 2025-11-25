-- Migration: Create td_votes table for storing parliamentary votes
-- This enables tracking of TD voting records, party loyalty, and cross-party voting

-- Create td_votes table
CREATE TABLE IF NOT EXISTS td_votes (
  id SERIAL PRIMARY KEY,
  td_id INTEGER REFERENCES td_scores(id) ON DELETE CASCADE,
  
  -- Vote identification
  vote_id TEXT UNIQUE NOT NULL,
  vote_uri TEXT,
  vote_date DATE NOT NULL,
  
  -- Vote details
  vote_subject TEXT,
  vote_outcome TEXT,  -- 'Agreed to', 'Defeated', etc.
  
  -- TD's vote
  td_vote TEXT CHECK (td_vote IN ('ta', 'nil', 'staon')),  -- ta=yes, nil=no, staon=abstain
  voted_with_party BOOLEAN,
  
  -- Party context (at time of vote)
  td_party_at_vote TEXT,
  
  -- Links
  debate_uri TEXT,
  legislation_uri TEXT,
  
  -- Vote tallies (for context)
  total_ta_votes INTEGER,  -- Total yes votes
  total_nil_votes INTEGER,  -- Total no votes
  total_staon_votes INTEGER,  -- Total abstentions
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_td_votes_td_id ON td_votes(td_id);
CREATE INDEX idx_td_votes_date ON td_votes(vote_date DESC);
CREATE INDEX idx_td_votes_td_vote ON td_votes(td_vote);
CREATE INDEX idx_td_votes_party_loyalty ON td_votes(voted_with_party);
CREATE INDEX idx_td_votes_outcome ON td_votes(vote_outcome);
CREATE INDEX idx_td_votes_date_range ON td_votes(vote_date, td_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_td_votes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_td_votes_updated_at
  BEFORE UPDATE ON td_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_td_votes_updated_at();

-- Add helpful comments
COMMENT ON TABLE td_votes IS 'Stores individual voting records for TDs in Dáil divisions';
COMMENT ON COLUMN td_votes.td_vote IS 'TD vote: ta (yes), nil (no), staon (abstain)';
COMMENT ON COLUMN td_votes.voted_with_party IS 'Whether TD voted with their party majority';

-- Create view for TD voting statistics
CREATE OR REPLACE VIEW td_vote_stats AS
SELECT 
  td_id,
  COUNT(*) as total_votes,
  COUNT(*) FILTER (WHERE td_vote = 'ta') as votes_yes,
  COUNT(*) FILTER (WHERE td_vote = 'nil') as votes_no,
  COUNT(*) FILTER (WHERE td_vote = 'staon') as votes_abstain,
  COUNT(*) FILTER (WHERE voted_with_party = true) as votes_with_party,
  COUNT(*) FILTER (WHERE voted_with_party = false) as votes_against_party,
  ROUND(
    (COUNT(*) FILTER (WHERE voted_with_party = true)::numeric / NULLIF(COUNT(*), 0)::numeric * 100), 
    1
  ) as party_loyalty_pct,
  MAX(vote_date) as most_recent_vote_date,
  MIN(vote_date) as earliest_vote_date
FROM td_votes
GROUP BY td_id;

COMMENT ON VIEW td_vote_stats IS 'Aggregated voting statistics for TDs - includes party loyalty percentage';

-- Create view for cross-party voting incidents
CREATE OR REPLACE VIEW cross_party_votes AS
SELECT 
  v.id,
  v.td_id,
  ts.politician_name,
  v.vote_date,
  v.vote_subject,
  v.td_vote,
  v.td_party_at_vote,
  v.vote_outcome
FROM td_votes v
JOIN td_scores ts ON v.td_id = ts.id
WHERE v.voted_with_party = false
ORDER BY v.vote_date DESC;

COMMENT ON VIEW cross_party_votes IS 'TDs who voted against their party line - useful for identifying independent thinkers';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ td_votes table created successfully';
  RAISE NOTICE '✅ Indexes created for optimal query performance';
  RAISE NOTICE '✅ Views created: td_vote_stats, cross_party_votes';
END $$;

