-- Phase 1: Create user_preferences table (additive, backward compatible)
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id varchar(100) PRIMARY KEY,
  county varchar(50),
  bio text,
  latitude varchar(50),
  longitude varchar(50),
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Backfill from users table (idempotent via ON CONFLICT)
INSERT INTO user_preferences (user_id, county, bio, latitude, longitude, created_at, updated_at)
SELECT id, county, bio, latitude, longitude, created_at, updated_at FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Add FK constraint with ON DELETE CASCADE (safe after backfill)
ALTER TABLE user_preferences
ADD CONSTRAINT IF NOT EXISTS fk_user_preferences_users
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add index for updated_at queries (idempotent)
CREATE INDEX IF NOT EXISTS idx_user_preferences_updated_at ON user_preferences(updated_at);
