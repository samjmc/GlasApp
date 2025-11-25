import { Pool } from '@neondatabase/serverless';
import { db, pool } from '../server/db';
import { sql } from 'drizzle-orm';

async function updateSchema() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database schema update...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Check if columns already exist
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'quiz_results' 
      AND column_name IN ('detailed_analysis', 'political_values', 'irish_context_insights')
    `);
    
    const existingColumns = checkResult.rows.map(row => row.column_name);
    
    // Add detailed_analysis column if it doesn't exist
    if (!existingColumns.includes('detailed_analysis')) {
      console.log('Adding detailed_analysis column...');
      await client.query(`
        ALTER TABLE quiz_results 
        ADD COLUMN detailed_analysis TEXT
      `);
    }
    
    // Add political_values column if it doesn't exist
    if (!existingColumns.includes('political_values')) {
      console.log('Adding political_values column...');
      await client.query(`
        ALTER TABLE quiz_results 
        ADD COLUMN political_values TEXT
      `);
    }
    
    // Add irish_context_insights column if it doesn't exist
    if (!existingColumns.includes('irish_context_insights')) {
      console.log('Adding irish_context_insights column...');
      await client.query(`
        ALTER TABLE quiz_results 
        ADD COLUMN irish_context_insights TEXT
      `);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('Schema update completed successfully!');
  } catch (error) {
    // Rollback in case of error
    await client.query('ROLLBACK');
    console.error('Error updating schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the update
updateSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed to update schema:', err);
    process.exit(1);
  });