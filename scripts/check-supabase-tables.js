/**
 * Check what tables exist in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function checkTables() {
  console.log('\n🔍 Checking Supabase tables...\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  // Try to list tables using Supabase introspection
  console.log('📋 Attempting to query system tables...\n');
  
  const tables = [
    'news_articles',
    'td_scores',
    'td_score_history',
    'news_sources',
    'scraping_jobs'
  ];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        if (error.code === '42P01') {
          console.log(`❌ ${table}: Does not exist`);
        } else if (error.code === '42501') {
          console.log(`⚠️  ${table}: Exists but RLS is blocking access (need to disable RLS)`);
        } else {
          console.log(`❌ ${table}: Error - ${error.message}`);
        }
      } else {
        console.log(`✅ ${table}: Exists with ${count || 0} rows`);
      }
    } catch (e) {
      console.log(`❌ ${table}: ${e.message}`);
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📝 Next steps:\n');
  console.log('1. If tables don\'t exist: Run migrations/create_news_tables.sql via Supabase dashboard');
  console.log('2. If RLS is blocking: Run migrations/disable_rls_news_tables.sql via Supabase dashboard');
  console.log('\n');
}

checkTables();

