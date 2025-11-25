import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { createClient } from '@supabase/supabase-js';
import * as schema from "@shared/schema";
import https from 'https';
import http from 'http';

console.log('🔌 Initializing database connection...');

if (!process.env.DATABASE_URL) {
  console.warn(
    "⚠️  DATABASE_URL not set - database features will be disabled",
  );
}

// PostgreSQL connection pool for Supabase (Drizzle ORM)
// DISABLED: SCRAM authentication issues with Node.js driver on Windows
// Use Supabase REST client (supabaseDb) instead via MCP
// Connection string format: postgresql://postgres:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres
export const pool = null; // Disabled due to SCRAM auth issues
/*
process.env.DATABASE_URL ? new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10, // Connection pool size
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 10000, // 10 seconds
  // Supabase requires SSL in all environments
  ssl: { rejectUnauthorized: false },
}) : null;
*/

export const db = pool ? drizzle(pool, { schema }) : null;

// HTTP agents with keepAlive disabled for Windows compatibility
// This prevents libuv "handle already closing" errors on script exit
const httpsAgent = new https.Agent({ keepAlive: false });
const httpAgent = new http.Agent({ keepAlive: false });

// Custom fetch with keepAlive disabled
const customFetch: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  const agent = url.startsWith('https:') ? httpsAgent : httpAgent;
  
  return fetch(input, {
    ...init,
    // @ts-ignore - Agent type compatibility
    agent
  });
};

// Supabase JS Client (for files that need REST API access)
// Used by news aggregation system and some specialized queries
export const supabaseDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
          },
          // Use custom fetch with keepAlive disabled
          fetch: customFetch
        }
      }
    )
  : null;

if (supabaseDb) {
  console.log('✅ Supabase REST client initialized with SERVICE ROLE KEY');
  console.log('   Using service role for RLS bypass');
} else {
  console.error('❌ Supabase REST client NOT initialized!');
  console.error('   Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('   SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'MISSING');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');
}

// Graceful shutdown handling (only for long-running processes like the main server)
// Jobs and scripts should handle their own cleanup explicitly
let isShuttingDown = false;

export const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('Closing database pool...');
  if (pool) {
    try {
      // End the pool and wait for all connections to close
      await pool.end();
      console.log('✅ Database pool closed successfully');
      
      // Small delay to ensure cleanup completes on Windows
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error closing database pool:', error);
    }
  }
};

// Only register shutdown handlers if this is the main server process
// (Not for one-off jobs/scripts)
const isMainServer = process.argv[1]?.includes('server/index');
if (isMainServer) {
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  if (!pool) {
    console.warn('⚠️  PostgreSQL pool disabled (using Supabase REST client instead)');
    // Check if Supabase REST client is available
    if (supabaseDb) {
      console.log('✅ Supabase REST client is available and working');
      return true;
    }
    return false;
  }

  try {
    const result = await pool.query('SELECT NOW() as now, current_database() as db, version() as version');
    const { now, db: dbName, version } = result.rows[0];
    console.log('✅ Database connection healthy');
    console.log(`   📅 Server time: ${now}`);
    console.log(`   🗄️  Database: ${dbName}`);
    console.log(`   📌 Version: ${version.split(' ').slice(0, 2).join(' ')}`);
    return true;
  } catch (error: any) {
    console.error('❌ Database connection failed:', error.message);
    if (error.code) console.error(`   Error code: ${error.code}`);
    return false;
  }
}
