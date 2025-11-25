import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('Running migration: Add email verification and 2FA tables...');
  
  try {
    // Add new columns to users table
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8),
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8);
    `);
    
    // Create email verification tokens table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Create two factor tokens table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS two_factor_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        token VARCHAR(6) NOT NULL,
        type VARCHAR(20) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
main().catch(console.error);

export default main;