import { Pool } from '@neondatabase/serverless';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Create user_locations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_locations (
        id SERIAL PRIMARY KEY,
        firebase_uid VARCHAR(100) NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        constituency VARCHAR(100),
        county VARCHAR(50),
        accuracy INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(firebase_uid)
      );
    `);

    // Create index for faster constituency lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_locations_constituency 
      ON user_locations(constituency);
    `);

    // Create index for coordinate-based searches
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_locations_coords 
      ON user_locations(latitude, longitude);
    `);

    console.log('✅ User locations table created successfully');
  } catch (error) {
    console.error('❌ Error creating user locations table:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration if this file is executed directly
main().catch(console.error);

export default main;