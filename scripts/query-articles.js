/**
 * Query Articles from Supabase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function queryArticles() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  console.log('\n📰 Querying articles from Supabase...\n');
  
  const { data, error, count } = await supabase
    .from('news_articles')
    .select('id, title, source, impact_score, published_date', { count: 'exact' })
    .order('published_date', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log(`✅ Found ${count} total articles in database\n`);
  console.log('📋 Latest articles:');
  data.forEach((article, i) => {
    console.log(`\n${i + 1}. ${article.title}`);
    console.log(`   Source: ${article.source} | Score: ${article.impact_score} | ID: ${article.id}`);
    console.log(`   Published: ${new Date(article.published_date).toLocaleString()}`);
  });
  
  console.log('\n');
}

queryArticles();

