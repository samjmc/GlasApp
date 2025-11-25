/**
 * Check News Articles Table Schema
 * Shows actual column names in the database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function checkSchema() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  console.log('\n📋 Checking news_articles table schema...\n');
  
  // Insert a minimal test row to see what columns are accepted
  const testData = {
    url: `https://test-schema-check-${Date.now()}.com`,
    title: 'Schema Test',
    content: 'Test content',
    source: 'Test',
    published_date: new Date().toISOString()
  };
  
  const { data, error } = await supabase
    .from('news_articles')
    .insert(testData)
    .select()
    .single();
  
  if (error) {
    console.error('Error:', error.message);
    console.error('Details:', error.details);
    console.error('Hint:', error.hint);
  } else {
    console.log('✅ Successfully inserted test row');
    console.log('\n📊 Actual columns in returned data:');
    console.log(Object.keys(data));
    
    // Clean up
    await supabase.from('news_articles').delete().eq('id', data.id);
    console.log('\n🗑️  Test row deleted\n');
  }
}

checkSchema();

