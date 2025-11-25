/**
 * Add image_url column to news_articles
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

// Disable SSL verification
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function addColumn() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('Adding image_url column...');
    await pool.query('ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS image_url TEXT');
    console.log('✅ Column added successfully!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

addColumn();

