import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Creating quiz_history table...");
  
  try {
    // Create the quiz_history table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS quiz_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        economic_score DECIMAL(4,1) NOT NULL,
        social_score DECIMAL(4,1) NOT NULL,
        cultural_score DECIMAL(4,1) NOT NULL,
        globalism_score DECIMAL(4,1) NOT NULL,
        environmental_score DECIMAL(4,1) NOT NULL,
        authority_score DECIMAL(4,1) NOT NULL,
        welfare_score DECIMAL(4,1) NOT NULL,
        technocratic_score DECIMAL(4,1) NOT NULL,
        ideology VARCHAR(100),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_current BOOLEAN DEFAULT TRUE
      )
    `);
    
    console.log("✅ quiz_history table created successfully");
  } catch (error) {
    console.error("Error creating quiz_history table:", error);
    throw error;
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});