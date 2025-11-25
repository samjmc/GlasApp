-- ============================================================================
-- POLLING AGGREGATION SYSTEM
-- Comprehensive polling data tracking for parties and TDs
-- Created: 2025-11-03
-- ============================================================================

-- Poll sources (pollsters and media outlets)
CREATE TABLE IF NOT EXISTS poll_sources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'pollster', 'media', 'academic'
  reliability_score DECIMAL(3,2) DEFAULT 0.80, -- 0.00-1.00
  methodology_notes TEXT,
  political_bias VARCHAR(20), -- 'left', 'center', 'right', 'neutral', 'unknown'
  website TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Core polls table
CREATE TABLE IF NOT EXISTS polls (
  id SERIAL PRIMARY KEY,
  source_id INTEGER REFERENCES poll_sources(id),
  poll_date DATE NOT NULL,
  publication_date DATE NOT NULL,
  
  -- Methodology
  sample_size INTEGER NOT NULL,
  margin_of_error DECIMAL(4,2),
  methodology VARCHAR(100), -- 'phone', 'online', 'face_to_face', 'mixed'
  weighting_applied BOOLEAN DEFAULT false,
  weighting_method TEXT,
  
  -- Geographic scope
  scope VARCHAR(50) NOT NULL, -- 'national', 'constituency', 'region'
  constituency VARCHAR(100),
  region VARCHAR(100),
  
  -- Quality indicators
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
  verified BOOLEAN DEFAULT false,
  verified_by VARCHAR(100),
  
  -- Source tracking
  source_url TEXT,
  article_title TEXT,
  
  -- Metadata
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Poll results for parties
CREATE TABLE IF NOT EXISTS poll_party_results (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
  party_id INTEGER REFERENCES parties(id),
  party_name VARCHAR(100) NOT NULL, -- Denormalized for flexibility
  
  -- Results
  first_preference DECIMAL(5,2) CHECK (first_preference >= 0 AND first_preference <= 100),
  vote_share DECIMAL(5,2) CHECK (vote_share >= 0 AND vote_share <= 100),
  seat_projection INTEGER,
  seats_projection_lower INTEGER, -- Confidence interval
  seats_projection_upper INTEGER,
  
  -- Comparison metrics
  change_from_previous DECIMAL(5,2), -- vs previous poll from same source
  change_from_election DECIMAL(5,2), -- vs last general election
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Poll results for individual TDs (rare but valuable)
CREATE TABLE IF NOT EXISTS poll_td_results (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
  politician_name VARCHAR(255) NOT NULL,
  td_id INTEGER, -- References td_scores(id) when available
  constituency VARCHAR(100) NOT NULL,
  party VARCHAR(100),
  
  -- Results
  approval_rating DECIMAL(5,2) CHECK (approval_rating >= 0 AND approval_rating <= 100),
  disapproval_rating DECIMAL(5,2) CHECK (disapproval_rating >= 0 AND disapproval_rating <= 100),
  name_recognition DECIMAL(5,2) CHECK (name_recognition >= 0 AND name_recognition <= 100),
  voting_intention DECIMAL(5,2) CHECK (voting_intention >= 0 AND voting_intention <= 100),
  
  -- Context
  question_type VARCHAR(50), -- 'approval', 'recognition', 'voting_intent', 'performance'
  comparative_rank INTEGER, -- Rank vs other TDs in poll
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Time-series aggregations with trend analysis
CREATE TABLE IF NOT EXISTS polling_time_series (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('party', 'td')),
  entity_id INTEGER NOT NULL,
  entity_name VARCHAR(255) NOT NULL,
  
  -- Time window
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  granularity VARCHAR(20) NOT NULL, -- 'week', 'month', 'quarter', 'year'
  
  -- Statistical aggregations
  mean_support DECIMAL(5,2),
  median_support DECIMAL(5,2),
  mode_support DECIMAL(5,2),
  std_dev DECIMAL(5,2),
  min_support DECIMAL(5,2),
  max_support DECIMAL(5,2),
  poll_count INTEGER NOT NULL,
  
  -- Trend analysis
  linear_trend DECIMAL(6,3), -- Slope of trend line (percentage points per day)
  momentum VARCHAR(20) CHECK (momentum IN ('accelerating', 'stable', 'decelerating', 'insufficient_data')),
  volatility DECIMAL(5,2), -- Coefficient of variation
  trend_direction VARCHAR(20) CHECK (trend_direction IN ('rising', 'falling', 'stable', 'insufficient_data')),
  
  -- Confidence metrics
  confidence_level DECIMAL(3,2) CHECK (confidence_level >= 0 AND confidence_level <= 1),
  data_quality_score INTEGER CHECK (data_quality_score >= 0 AND data_quality_score <= 100),
  
  -- Calculation metadata
  calculated_at TIMESTAMP DEFAULT NOW(),
  calculation_method VARCHAR(50) DEFAULT 'weighted_average',
  
  UNIQUE(entity_type, entity_id, period_start, period_end, granularity)
);

-- Poll vs Performance correlation analysis
CREATE TABLE IF NOT EXISTS poll_performance_correlation (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('party', 'td')),
  entity_id INTEGER NOT NULL,
  entity_name VARCHAR(255) NOT NULL,
  
  -- Analysis period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_months INTEGER NOT NULL,
  
  -- Averages
  poll_avg DECIMAL(5,2),
  performance_score_avg DECIMAL(5,2),
  
  -- Statistical correlation
  correlation_coefficient DECIMAL(5,3) CHECK (correlation_coefficient >= -1 AND correlation_coefficient <= 1),
  correlation_strength VARCHAR(20), -- 'strong_positive', 'moderate_positive', 'weak', 'moderate_negative', 'strong_negative'
  p_value DECIMAL(6,4), -- Statistical significance
  
  -- Gap analysis
  gap DECIMAL(5,2), -- poll_avg - performance_score_avg
  gap_direction VARCHAR(30) CHECK (gap_direction IN ('polls_higher', 'aligned', 'performance_higher')),
  gap_interpretation TEXT,
  
  -- Sample info
  poll_count INTEGER,
  data_quality VARCHAR(20) CHECK (data_quality IN ('high', 'medium', 'low', 'insufficient')),
  
  calculated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(entity_type, entity_id, period_start, period_end)
);

-- Election predictions based on polling + performance
CREATE TABLE IF NOT EXISTS election_predictions (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('party', 'td')),
  entity_id INTEGER NOT NULL,
  entity_name VARCHAR(255) NOT NULL,
  constituency VARCHAR(100),
  
  -- Model inputs (for transparency)
  current_poll_avg DECIMAL(5,2),
  poll_trend DECIMAL(5,2),
  performance_score INTEGER,
  historical_election_result DECIMAL(5,2),
  incumbency_bonus DECIMAL(5,2),
  national_swing DECIMAL(5,2),
  
  -- Predictions
  predicted_first_pref DECIMAL(5,2),
  predicted_first_pref_lower DECIMAL(5,2), -- 95% confidence interval
  predicted_first_pref_upper DECIMAL(5,2),
  
  predicted_seat_probability DECIMAL(5,2) CHECK (predicted_seat_probability >= 0 AND predicted_seat_probability <= 100),
  predicted_seat_count INTEGER, -- For parties
  predicted_seat_count_lower INTEGER,
  predicted_seat_count_upper INTEGER,
  
  -- Model confidence
  model_confidence DECIMAL(3,2) CHECK (model_confidence >= 0 AND model_confidence <= 1),
  model_version VARCHAR(50),
  factors_considered JSONB,
  
  -- Prediction metadata
  prediction_date TIMESTAMP DEFAULT NOW(),
  target_election_date DATE,
  days_until_election INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- User poll predictions (gamification)
CREATE TABLE IF NOT EXISTS user_poll_predictions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('party', 'td')),
  entity_id INTEGER NOT NULL,
  entity_name VARCHAR(255) NOT NULL,
  
  -- User's prediction
  predicted_support DECIMAL(5,2) NOT NULL CHECK (predicted_support >= 0 AND predicted_support <= 100),
  confidence_level INTEGER CHECK (confidence_level >= 1 AND confidence_level <= 5),
  reasoning TEXT,
  
  -- Timing
  prediction_date TIMESTAMP DEFAULT NOW(),
  target_date DATE NOT NULL, -- When they predict this will be measured
  target_poll_date DATE, -- Specific poll they're predicting
  
  -- Actual results (filled in later)
  actual_support DECIMAL(5,2),
  actual_poll_id INTEGER REFERENCES polls(id),
  
  -- Scoring
  accuracy_score INTEGER, -- 0-100, how close they were
  points_awarded INTEGER DEFAULT 0,
  ranked_position INTEGER, -- Their rank among all predictors
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'scored', 'expired')),
  scored_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Poll aggregates cache for fast queries
CREATE TABLE IF NOT EXISTS polling_aggregates_cache (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL,
  entity_id INTEGER NOT NULL,
  entity_name VARCHAR(255) NOT NULL,
  
  -- Latest poll data
  latest_poll_date DATE,
  latest_support DECIMAL(5,2),
  latest_poll_source VARCHAR(100),
  
  -- Trends (last 30 days)
  support_30d_avg DECIMAL(5,2),
  support_30d_change DECIMAL(5,2),
  support_30d_trend VARCHAR(20),
  
  -- Trends (last 90 days)
  support_90d_avg DECIMAL(5,2),
  support_90d_change DECIMAL(5,2),
  support_90d_trend VARCHAR(20),
  
  -- All-time
  all_time_high DECIMAL(5,2),
  all_time_high_date DATE,
  all_time_low DECIMAL(5,2),
  all_time_low_date DATE,
  
  -- Rankings
  national_rank INTEGER,
  support_percentile DECIMAL(5,2),
  
  -- Data quality
  total_polls INTEGER,
  last_poll_days_ago INTEGER,
  data_recency VARCHAR(20) CHECK (data_recency IN ('current', 'recent', 'stale', 'no_data')),
  
  -- Cache metadata
  last_updated TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(entity_type, entity_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_polls_date ON polls(poll_date DESC);
CREATE INDEX IF NOT EXISTS idx_polls_source ON polls(source_id);
CREATE INDEX IF NOT EXISTS idx_polls_scope ON polls(scope, constituency);

CREATE INDEX IF NOT EXISTS idx_party_results_poll ON poll_party_results(poll_id);
CREATE INDEX IF NOT EXISTS idx_party_results_party ON poll_party_results(party_id);
CREATE INDEX IF NOT EXISTS idx_party_results_date ON poll_party_results(poll_id, party_id);

CREATE INDEX IF NOT EXISTS idx_td_results_poll ON poll_td_results(poll_id);
CREATE INDEX IF NOT EXISTS idx_td_results_politician ON poll_td_results(politician_name);
CREATE INDEX IF NOT EXISTS idx_td_results_constituency ON poll_td_results(constituency);

CREATE INDEX IF NOT EXISTS idx_time_series_entity ON polling_time_series(entity_type, entity_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_time_series_period ON polling_time_series(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_correlation_entity ON poll_performance_correlation(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_correlation_period ON poll_performance_correlation(period_end DESC);

CREATE INDEX IF NOT EXISTS idx_predictions_entity ON election_predictions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_predictions_date ON election_predictions(target_election_date);

CREATE INDEX IF NOT EXISTS idx_user_predictions_user ON user_poll_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_predictions_status ON user_poll_predictions(status, target_date);

CREATE INDEX IF NOT EXISTS idx_aggregates_cache_entity ON polling_aggregates_cache(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_aggregates_cache_updated ON polling_aggregates_cache(last_updated);

-- Insert default poll sources
INSERT INTO poll_sources (name, type, reliability_score, political_bias, website, active) VALUES
  ('Ireland Thinks', 'pollster', 0.85, 'neutral', 'https://irelandthinks.ie/', true),
  ('Red C', 'pollster', 0.90, 'neutral', 'https://www.redcresearch.ie/', true),
  ('Ipsos MRBI', 'pollster', 0.92, 'neutral', 'https://www.ipsos.com/en-ie', true),
  ('Behaviour & Attitudes', 'pollster', 0.88, 'neutral', 'https://www.banda.ie/', true),
  ('Amárach Research', 'pollster', 0.85, 'neutral', 'https://amarach.com/', true),
  ('The Irish Times', 'media', 0.88, 'center', 'https://www.irishtimes.com/', true),
  ('Irish Independent', 'media', 0.82, 'center-right', 'https://www.independent.ie/', true),
  ('RTÉ', 'media', 0.90, 'neutral', 'https://www.rte.ie/', true),
  ('Sunday Business Post', 'media', 0.85, 'center', 'https://www.businesspost.ie/', true),
  ('TheJournal.ie', 'media', 0.80, 'center-left', 'https://www.thejournal.ie/', true)
ON CONFLICT (name) DO NOTHING;

-- Create a view for latest party polling
CREATE OR REPLACE VIEW latest_party_polls AS
SELECT 
  p.id as poll_id,
  p.poll_date,
  p.publication_date,
  ps.name as source_name,
  ps.reliability_score,
  pr.party_id,
  pr.party_name,
  pr.first_preference,
  pr.vote_share,
  pr.seat_projection,
  pr.change_from_previous,
  pr.change_from_election,
  p.sample_size,
  p.margin_of_error,
  p.quality_score,
  ROW_NUMBER() OVER (PARTITION BY pr.party_id ORDER BY p.poll_date DESC) as recency_rank
FROM polls p
JOIN poll_sources ps ON p.source_id = ps.id
JOIN poll_party_results pr ON p.id = pr.poll_id
WHERE p.scope = 'national'
ORDER BY p.poll_date DESC;

-- Create a view for party polling trends
CREATE OR REPLACE VIEW party_polling_trends AS
SELECT 
  party_id,
  party_name,
  COUNT(*) as total_polls,
  AVG(first_preference) as avg_support,
  MIN(first_preference) as min_support,
  MAX(first_preference) as max_support,
  STDDEV(first_preference) as support_volatility,
  MIN(poll_date) as first_poll_date,
  MAX(poll_date) as latest_poll_date
FROM latest_party_polls
GROUP BY party_id, party_name;

COMMENT ON TABLE polls IS 'Core polling data with full methodology tracking';
COMMENT ON TABLE poll_party_results IS 'Party support levels from each poll';
COMMENT ON TABLE poll_td_results IS 'Individual TD approval/recognition ratings';
COMMENT ON TABLE polling_time_series IS 'Pre-calculated time series aggregations for performance';
COMMENT ON TABLE poll_performance_correlation IS 'Analysis of polling vs performance score correlation';
COMMENT ON TABLE election_predictions IS 'ML-based election outcome predictions';
COMMENT ON TABLE user_poll_predictions IS 'User predictions for gamification';
COMMENT ON TABLE polling_aggregates_cache IS 'Fast-access cache of polling summaries';

