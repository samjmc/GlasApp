import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Creating pledge tracking tables...');

  // Create pledges table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pledges (
      id SERIAL PRIMARY KEY,
      party_id INTEGER NOT NULL REFERENCES parties(id),
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(100) NOT NULL,
      election_year INTEGER NOT NULL,
      target_date TIMESTAMP,
      status VARCHAR(50) DEFAULT 'active',
      score_type VARCHAR(20) NOT NULL,
      score DECIMAL(5,2) DEFAULT 0,
      evidence TEXT,
      source_url TEXT,
      last_updated TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Create pledge_actions table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pledge_actions (
      id SERIAL PRIMARY KEY,
      pledge_id INTEGER NOT NULL REFERENCES pledges(id),
      action_type VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      action_date TIMESTAMP NOT NULL,
      impact_score DECIMAL(4,2) DEFAULT 0,
      source_url TEXT,
      evidence_details TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Create party_performance_scores table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS party_performance_scores (
      id SERIAL PRIMARY KEY,
      party_id INTEGER NOT NULL REFERENCES parties(id),
      score_type VARCHAR(50) NOT NULL,
      overall_score DECIMAL(5,2) NOT NULL,
      pledge_fulfillment_score DECIMAL(5,2),
      policy_consistency_score DECIMAL(5,2),
      parliamentary_activity_score DECIMAL(5,2),
      integrity_score DECIMAL(5,2),
      transparency_score DECIMAL(5,2),
      factual_accuracy_score DECIMAL(5,2),
      public_accountability_score DECIMAL(5,2),
      conflict_avoidance_score DECIMAL(5,2),
      government_status VARCHAR(20) NOT NULL,
      calculated_at TIMESTAMP DEFAULT NOW(),
      valid_from TIMESTAMP DEFAULT NOW(),
      valid_to TIMESTAMP
    );
  `);

  // Create indexes for better performance
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_pledges_party_id ON pledges(party_id);
    CREATE INDEX IF NOT EXISTS idx_pledges_election_year ON pledges(election_year);
    CREATE INDEX IF NOT EXISTS idx_pledges_score_type ON pledges(score_type);
    CREATE INDEX IF NOT EXISTS idx_pledge_actions_pledge_id ON pledge_actions(pledge_id);
    CREATE INDEX IF NOT EXISTS idx_pledge_actions_action_date ON pledge_actions(action_date);
    CREATE INDEX IF NOT EXISTS idx_party_performance_scores_party_id ON party_performance_scores(party_id);
    CREATE INDEX IF NOT EXISTS idx_party_performance_scores_score_type ON party_performance_scores(score_type);
  `);

  console.log('Pledge tracking tables created successfully!');
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});