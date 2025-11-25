import { db, pool } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Running migration: add_party_dimensions");
  
  try {
    // Add the new columns to the parties table
    await db.execute(sql`
      ALTER TABLE parties
      ADD COLUMN IF NOT EXISTS economic_score DECIMAL(3,1),
      ADD COLUMN IF NOT EXISTS social_score DECIMAL(3,1),
      ADD COLUMN IF NOT EXISTS cultural_score DECIMAL(3,1),
      ADD COLUMN IF NOT EXISTS globalism_score DECIMAL(3,1),
      ADD COLUMN IF NOT EXISTS environmental_score DECIMAL(3,1),
      ADD COLUMN IF NOT EXISTS authority_score DECIMAL(3,1),
      ADD COLUMN IF NOT EXISTS welfare_score DECIMAL(3,1),
      ADD COLUMN IF NOT EXISTS technocratic_score DECIMAL(3,1),
      ADD COLUMN IF NOT EXISTS dimension_rationales TEXT
    `);
    
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});