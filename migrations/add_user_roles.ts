import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Adding role column to users table...');
  
  try {
    // Add role column with default value 'user'
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'`);
    
    console.log('✅ Successfully added role column to users table');
  } catch (error) {
    console.error('❌ Error adding role column:', error);
    throw error;
  }
}

main().catch(console.error);