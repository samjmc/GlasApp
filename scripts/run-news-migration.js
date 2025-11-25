/**
 * Run News Tables Migration
 * Executes the SQL migration to create news scoring tables
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const { Pool } = pg;

// Load environment variables
dotenv.config();

// Disable SSL certificate verification for Supabase self-signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  console.log('🚀 Starting news tables migration...\n');

  // Create connection pool  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Test connection
    console.log('📡 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected\n');

    // Read migration file
    const migrationPath = join(__dirname, '..', 'migrations', 'create_news_tables.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);
    const sql = readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    console.log('⚡ Executing migration...\n');
    const result = await pool.query(sql);
    
    // Show results
    console.log('✅ Migration completed successfully!\n');
    
    if (result.rows && result.rows.length > 0) {
      console.log('📊 Migration Results:');
      console.log(result.rows[0]);
    }
    
    // Verify tables were created
    console.log('\n🔍 Verifying tables...');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('news_articles', 'td_scores', 'td_score_history', 'news_sources', 'scraping_jobs')
      ORDER BY table_name
    `);
    
    console.log(`✅ Found ${tablesResult.rows.length} tables:`);
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    // Count news sources
    const sourcesResult = await pool.query('SELECT COUNT(*) FROM news_sources');
    console.log(`\n📰 News sources seeded: ${sourcesResult.rows[0].count}`);
    
    console.log('\n🎉 Migration complete! Your news system is ready.\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
runMigration();

