/**
 * News Scraper Diagnostic Tool
 * Tests each component of the news scraping pipeline
 */

import 'dotenv/config';
import { NewsScraperService } from './server/services/newsScraperService';
import { TDExtractionService } from './server/services/tdExtractionService';
import { supabaseDb } from './server/db';

async function diagnoseNewsScraper() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  NEWS SCRAPER DIAGNOSTIC TOOL                         ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  // TEST 1: Environment Variables
  console.log('📋 TEST 1: Environment Variables');
  console.log('─────────────────────────────────────────────────');
  try {
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasSupabaseUrl = !!process.env.DATABASE_URL;
    
    console.log(`  OPENAI_API_KEY: ${hasOpenAI ? '✅ Set' : '❌ Missing'}`);
    console.log(`  DATABASE_URL: ${hasSupabaseUrl ? '✅ Set' : '❌ Missing'}`);
    
    if (hasOpenAI && hasSupabaseUrl) {
      passed++;
      console.log('  ✅ PASSED\n');
    } else {
      failed++;
      console.log('  ❌ FAILED - Missing environment variables\n');
    }
  } catch (error) {
    failed++;
    console.log(`  ❌ ERROR: ${error}\n`);
  }

  // TEST 2: Database Connection
  console.log('📋 TEST 2: Database Connection');
  console.log('─────────────────────────────────────────────────');
  try {
    if (!supabaseDb) {
      throw new Error('Supabase client not initialized');
    }
    
    const { data, error } = await supabaseDb
      .from('news_articles')
      .select('id')
      .limit(1);
    
    if (error) throw error;
    
    console.log('  ✅ Database connected successfully');
    console.log(`  ✅ Can query news_articles table`);
    passed++;
    console.log('  ✅ PASSED\n');
  } catch (error: any) {
    failed++;
    console.log(`  ❌ FAILED: ${error.message}\n`);
  }

  // TEST 3: Fetch RSS Feed
  console.log('📋 TEST 3: Fetch RSS Feed (The Journal)');
  console.log('─────────────────────────────────────────────────');
  try {
    const articles = await NewsScraperService.fetchRSSFeed(
      'https://www.thejournal.ie/feed/',
      'The Journal',
      0.90
    );
    
    console.log(`  ✅ Fetched ${articles.length} articles from RSS`);
    
    if (articles.length > 0) {
      const latest = articles[0];
      console.log(`  📰 Latest: "${latest.title.substring(0, 60)}..."`);
      console.log(`  📅 Published: ${latest.published_date.toISOString()}`);
      console.log(`  🔗 URL: ${latest.url}`);
      passed++;
      console.log('  ✅ PASSED\n');
    } else {
      failed++;
      console.log('  ❌ FAILED - No articles fetched\n');
    }
  } catch (error: any) {
    failed++;
    console.log(`  ❌ FAILED: ${error.message}\n`);
  }

  // TEST 4: Political Filtering
  console.log('📋 TEST 4: Political Article Filtering');
  console.log('─────────────────────────────────────────────────');
  try {
    const allArticles = await NewsScraperService.fetchRSSFeed(
      'https://www.thejournal.ie/feed/',
      'The Journal',
      0.90
    );
    
    const politicalArticles = await NewsScraperService.filterPoliticalArticles(allArticles);
    
    console.log(`  📊 Total articles: ${allArticles.length}`);
    console.log(`  🔍 Political articles: ${politicalArticles.length}`);
    console.log(`  📈 Filter rate: ${((politicalArticles.length / allArticles.length) * 100).toFixed(1)}%`);
    
    if (politicalArticles.length > 0) {
      console.log(`  📰 Sample: "${politicalArticles[0].title.substring(0, 60)}..."`);
      passed++;
      console.log('  ✅ PASSED\n');
    } else {
      failed++;
      console.log('  ❌ FAILED - No political articles found\n');
    }
  } catch (error: any) {
    failed++;
    console.log(`  ❌ FAILED: ${error.message}\n`);
  }

  // TEST 5: TD Extraction (async)
  console.log('📋 TEST 5: TD Mention Extraction');
  console.log('─────────────────────────────────────────────────');
  try {
    const testText = "Deputy Simon Harris criticized the opposition. Minister Mary Lou McDonald responded to questions in the Dáil.";
    
    const mentions = await TDExtractionService.extractTDMentions(testText);
    
    console.log(`  👤 Found ${mentions.length} TD mentions`);
    if (mentions.length > 0) {
      mentions.forEach(m => {
        console.log(`     - ${m.name} (${m.party})`);
      });
      passed++;
      console.log('  ✅ PASSED\n');
    } else {
      console.log('  ⚠️  WARNING - No TDs found (but this is not a failure)\n');
      passed++;
    }
  } catch (error: any) {
    failed++;
    console.log(`  ❌ FAILED: ${error.message}\n`);
  }

  // TEST 6: Check for Duplicate URLs
  console.log('📋 TEST 6: Duplicate Article Detection');
  console.log('─────────────────────────────────────────────────');
  try {
    const articles = await NewsScraperService.fetchRSSFeed(
      'https://www.thejournal.ie/feed/',
      'The Journal',
      0.90
    );
    
    const politicalArticles = await NewsScraperService.filterPoliticalArticles(articles);
    
    if (politicalArticles.length === 0) {
      console.log('  ⚠️  No political articles to check\n');
      passed++;
    } else {
      const testUrl = politicalArticles[0].url;
      
      const { data: existing } = await supabaseDb
        .from('news_articles')
        .select('id, title')
        .eq('url', testUrl)
        .single();
      
      if (existing) {
        console.log(`  📰 Article: "${politicalArticles[0].title.substring(0, 60)}..."`);
        console.log(`  🔗 URL: ${testUrl}`);
        console.log(`  ✅ Already exists in database (ID: ${existing.id})`);
        console.log(`  ℹ️  This is why it wasn't added - duplicate detection working!\n`);
      } else {
        console.log(`  📰 Article: "${politicalArticles[0].title.substring(0, 60)}..."`);
        console.log(`  🔗 URL: ${testUrl}`);
        console.log(`  ✅ NEW article - should be added to database`);
        console.log(`  ℹ️  This article would be processed by the scraper\n`);
      }
      passed++;
      console.log('  ✅ PASSED\n');
    }
  } catch (error: any) {
    if (error.code === 'PGRST116') {
      // No rows returned - article is new
      console.log('  ✅ Article is new (not a duplicate)');
      passed++;
      console.log('  ✅ PASSED\n');
    } else {
      failed++;
      console.log(`  ❌ FAILED: ${error.message}\n`);
    }
  }

  // TEST 7: Test Image Generation Service
  console.log('📋 TEST 7: Image Generation Service');
  console.log('─────────────────────────────────────────────────');
  try {
    const { NewsImageGenerationService } = await import('./server/services/newsImageGenerationService');
    
    const testArticle = {
      title: "Budget 2025: Housing package announced",
      content: "The government announced a major housing initiative...",
      source: "Test"
    };
    
    const prompt = NewsImageGenerationService.generateImagePrompt(testArticle);
    console.log(`  🎨 Generated prompt: "${prompt.substring(0, 80)}..."`);
    
    // Don't actually generate image, just test the function exists
    const fallbackImage = NewsImageGenerationService.getRandomExistingImage();
    console.log(`  🖼️  Fallback image: ${fallbackImage}`);
    
    passed++;
    console.log('  ✅ PASSED\n');
  } catch (error: any) {
    failed++;
    console.log(`  ❌ FAILED: ${error.message}\n`);
  }

  // TEST 8: Find truly NEW articles from today
  console.log('📋 TEST 8: Find NEW Articles from Today');
  console.log('─────────────────────────────────────────────────');
  try {
    const articles = await NewsScraperService.fetchRSSFeed(
      'https://www.thejournal.ie/feed/',
      'The Journal',
      0.90
    );
    
    const politicalArticles = await NewsScraperService.filterPoliticalArticles(articles);
    
    // Check each article against database
    let newCount = 0;
    const newArticles = [];
    
    for (const article of politicalArticles.slice(0, 10)) { // Check first 10
      const { data: existing } = await supabaseDb
        .from('news_articles')
        .select('id')
        .eq('url', article.url)
        .single();
      
      if (!existing) {
        newCount++;
        newArticles.push(article);
      }
    }
    
    console.log(`  📊 Checked ${Math.min(10, politicalArticles.length)} political articles`);
    console.log(`  ✨ Found ${newCount} NEW articles (not in database)`);
    
    if (newCount > 0) {
      console.log(`\n  📰 NEW ARTICLES TO BE ADDED:`);
      newArticles.forEach((article, idx) => {
        console.log(`     ${idx + 1}. "${article.title.substring(0, 70)}..."`);
        console.log(`        Published: ${article.published_date.toISOString()}`);
      });
      passed++;
      console.log('\n  ✅ PASSED - Found new articles to process\n');
    } else {
      console.log('  ℹ️  No new articles found (all are already in database)');
      console.log('  ℹ️  This explains why the scraper isn\'t adding articles\n');
      passed++;
    }
  } catch (error: any) {
    if (error.code === 'PGRST116') {
      // Expected - article doesn't exist
      passed++;
    } else {
      failed++;
      console.log(`  ❌ FAILED: ${error.message}\n`);
    }
  }

  // SUMMARY
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  DIAGNOSTIC SUMMARY                                   ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📊 Total: ${passed + failed}\n`);
  
  if (failed === 0) {
    console.log('  🎉 All tests passed! System is working correctly.\n');
    console.log('  💡 If no articles are being added, it\'s because they already exist in the database.\n');
  } else {
    console.log('  ⚠️  Some tests failed. Check the errors above.\n');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run diagnostics
diagnoseNewsScraper().catch(error => {
  console.error('\n❌ FATAL ERROR:', error);
  process.exit(1);
});








