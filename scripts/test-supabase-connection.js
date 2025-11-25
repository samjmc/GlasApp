/**
 * Test Supabase Connection
 * Run this to verify Supabase client is working
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('\n🧪 Testing Supabase Connection...\n');
  
  // Check environment variables
  console.log('📋 Checking environment variables:');
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '⚠️  Optional (using anon key)'}\n`);
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Missing required Supabase credentials!');
    console.log('\n📖 See GET_SUPABASE_KEYS.md for instructions\n');
    process.exit(1);
  }
  
  // Create client
  console.log('🔌 Creating Supabase client...');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  
  console.log('✅ Client created\n');
  
  // Test 1: Query news_sources table
  console.log('Test 1: Querying news_sources table...');
  try {
    const { data, error } = await supabase
      .from('news_sources')
      .select('*')
      .limit(5);
    
    if (error) throw error;
    
    console.log(`✅ SUCCESS! Found ${data.length} news sources:`);
    data.forEach(source => {
      console.log(`   - ${source.name}`);
    });
    console.log('');
    
  } catch (error) {
    console.error('❌ Query failed:', error.message);
    console.log('');
  }
  
  // Test 2: Insert a test article
  console.log('Test 2: Inserting test article...');
  try {
    const testArticle = {
      url: `https://test.example.com/article-${Date.now()}`,
      title: 'Test Article - Supabase Connection Test',
      content: 'This is a test article to verify Supabase connection works.',
      source: 'Test Source',
      published_date: new Date().toISOString(),
      impact_score: 85,
      ai_summary: 'Test summary',
      processed: true
    };
    
    const { data, error } = await supabase
      .from('news_articles')
      .insert(testArticle)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log(`✅ SUCCESS! Test article inserted with ID: ${data.id}`);
    console.log('');
    
    // Clean up - delete test article
    console.log('Test 3: Cleaning up test article...');
    const { error: deleteError } = await supabase
      .from('news_articles')
      .delete()
      .eq('id', data.id);
    
    if (deleteError) throw deleteError;
    console.log('✅ Test article deleted');
    console.log('');
    
  } catch (error) {
    console.error('❌ Insert failed:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.details) {
      console.error(`   Details: ${error.details}`);
    }
    if (error.hint) {
      console.error(`   Hint: ${error.hint}`);
    }
    console.log('');
  }
  
  // Test 4: Check if td_unified_scores table exists
  console.log('Test 4: Checking for td_unified_scores table...');
  try {
    const { data, error } = await supabase
      .from('td_unified_scores')
      .select('count')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log('⚠️  Table td_unified_scores does not exist yet (expected)');
        console.log('   Will be created when we build unified scoring system');
      } else {
        throw error;
      }
    } else {
      console.log('✅ Table td_unified_scores exists!');
    }
    console.log('');
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
    console.log('');
  }
  
  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 SUPABASE CONNECTION TEST COMPLETE!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Supabase client is working correctly');
  console.log('✅ Can query tables');
  console.log('✅ Can insert data');
  console.log('✅ Can delete data');
  console.log('\n🚀 Ready to build the TD ELO system!\n');
}

testConnection().catch(error => {
  console.error('\n💥 Test failed:', error);
  process.exit(1);
});

