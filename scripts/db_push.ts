import { Pool } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  // Connect to PostgreSQL database
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  console.log('Connected to PostgreSQL database');

  try {
    // Read migration SQL file using import.meta.url instead of __dirname
    const moduleURL = new URL(import.meta.url);
    const modulePath = moduleURL.pathname;
    const projectRoot = path.dirname(path.dirname(modulePath));
    const migrationPath = path.join(projectRoot, 'migrations', '0000_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    console.log('Running migration...');
    await pool.query(sql);
    console.log('Migration completed successfully');

    // Clean up connection
    await pool.end();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error running migration:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigrations()
  .then(() => {
    console.log('Schema migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });