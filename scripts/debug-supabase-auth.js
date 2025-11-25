/**
 * Debug Supabase Authentication
 * Checks which key is being used and what permissions it has
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function debugAuth() {
  console.log('\n🔍 Debugging Supabase Authentication...\n');
  
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('Keys present:');
  console.log(`  URL: ${url ? '✅' : '❌'}`);
  console.log(`  ANON: ${anonKey ? '✅ ' + anonKey.substring(0, 20) + '...' : '❌'}`);
  console.log(`  SERVICE: ${serviceKey ? '✅ ' + serviceKey.substring(0, 20) + '...' : '❌'}\n`);
  
  // Test with service_role key
  console.log('Test 1: Using SERVICE_ROLE key...');
  const serviceClient = createClient(url, serviceKey);
  
  try {
    const { data, error } = await serviceClient
      .from('news_sources')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`❌ SERVICE_ROLE failed: ${error.message}`);
      console.log(`   Code: ${error.code}`);
      console.log(`   Hint: ${error.hint || 'none'}\n`);
    } else {
      console.log(`✅ SERVICE_ROLE works! Got ${data.length} rows\n`);
    }
  } catch (e) {
    console.log(`❌ SERVICE_ROLE exception: ${e.message}\n`);
  }
  
  // Test with anon key
  console.log('Test 2: Using ANON key...');
  const anonClient = createClient(url, anonKey);
  
  try {
    const { data, error } = await anonClient
      .from('news_sources')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`❌ ANON failed: ${error.message}`);
      console.log(`   Code: ${error.code}\n`);
    } else {
      console.log(`✅ ANON works! Got ${data.length} rows\n`);
    }
  } catch (e) {
    console.log(`❌ ANON exception: ${e.message}\n`);
  }
  
  // Test direct SQL query to check if tables exist
  console.log('Test 3: Checking table existence...');
  try {
    const { data, error } = await serviceClient.rpc('exec', {
      sql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'news_sources'`
    });
    
    if (error) {
      console.log(`   Can't run RPC: ${error.message}`);
    } else {
      console.log(`   RPC result:`, data);
    }
  } catch (e) {
    console.log(`   RPC not available (expected)\n`);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

debugAuth();

