/**
 * Daily News Scraper Job
 * Automated job that runs daily to scrape news, analyze articles, and update TD scores
 */

import cron from 'node-cron';
import { NewsScraperService } from '../services/newsScraperService';
import { TDExtractionService } from '../services/tdExtractionService';
import { AINewsAnalysisService } from '../services/aiNewsAnalysisService';
import { supabaseDb } from '../db';
import { ArticleAnalysis } from '../services/aiNewsAnalysisService';
import { ScrapedArticle } from '../services/newsScraperService';


interface DailyScraperOptions {
  lookbackHours?: number;
}

interface JobStats {
  articlesFound: number;
  articlesProcessed: number;
  articlesSkippedExisting: number;
  tdsMentioned: number;
  scoresUpdated: number;
  policyOpportunityCandidates: number;
  policyOpportunitiesCreated: number;
  errors: string[];
  startTime: Date;
  endTime?: Date;
}

/**
 * Main daily news scraping job
 */
export async function runDailyNewsScraper(options: DailyScraperOptions = {}): Promise<JobStats> {
  const stats: JobStats = {
    articlesFound: 0,
    articlesProcessed: 0,
    articlesSkippedExisting: 0,
    tdsMentioned: 0,
    scoresUpdated: 0,
    policyOpportunityCandidates: 0,
    policyOpportunitiesCreated: 0,
    errors: [],
    startTime: new Date()
  };
  const lookbackHours = options.lookbackHours ?? resolveConfiguredLookbackHours();

  console.log('\n📰 ========================================');
  console.log('🗞️  STARTING DAILY NEWS SCRAPING JOB');
  console.log(`📅 ${stats.startTime.toLocaleString('en-IE')}`);
  console.log('==========================================\n');

  try {
    // Step 1: Fetch all news articles
    console.log('📡 Step 1: Fetching news from Irish sources...');
    const allArticles = await NewsScraperService.fetchAllIrishNews({ lookbackHours });
    stats.articlesFound = allArticles.length;
    console.log(`✅ Found ${allArticles.length} total articles\n`);

    // Early duplicate filtering to avoid reprocessing saved articles
    const existingArticleUrls = new Set<string>();
    let articlesForProcessing = allArticles;

    if (supabaseDb && allArticles.length > 0) {
      const uniqueUrls = Array.from(new Set(allArticles.map(article => article.url)));
      try {
        for (const chunk of chunkArray(uniqueUrls, 100)) {
          const { data } = await supabaseDb
            .from('news_articles')
            .select('url')
            .in('url', chunk);

          data?.forEach(record => {
            if (record.url) {
              existingArticleUrls.add(record.url);
            }
          });
        }

        if (existingArticleUrls.size > 0) {
          console.log(`ℹ️  Skipping ${existingArticleUrls.size} articles already stored in database\n`);
        }

        if (existingArticleUrls.size > 0) {
          articlesForProcessing = allArticles.filter(article => !existingArticleUrls.has(article.url));
          stats.articlesSkippedExisting = allArticles.length - articlesForProcessing.length;
        }
      } catch (error: unknown) {
        console.warn(`⚠️ Unable to pre-check existing articles before filtering: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (stats.articlesSkippedExisting > 0) {
      console.log(`✅ ${stats.articlesSkippedExisting} duplicates removed before analysis (${articlesForProcessing.length} remain)\n`);
    }

    // Step 2: Filter for political content FIRST (before fetching full content)
    console.log('🔍 Step 2: Pre-filtering political articles (by title)...');
    const potentiallyPolitical = await NewsScraperService.filterPoliticalArticles(articlesForProcessing);
    console.log(`✅ ${potentiallyPolitical.length} articles flagged as political (keywords + classifier)\n`);
    
    // Step 3: Fetch full content for ALL political articles with short snippets
    console.log('📄 Step 3: Fetching full content for political articles...');
    const politicalArticles = [];
    
    for (const article of potentiallyPolitical) {
      // Fetch full content if RSS only gave us a snippet
      if (article.content.length < 500) {
        console.log(`   📖 Fetching: ${article.title.substring(0, 60)}...`);
        try {
          let fullContent = '';
          
          // Use source-specific scrapers for known sites
          if (article.source === 'Gript Media') {
            const { GriptScraper } = await import('../services/customScrapers/griptScraper');
            fullContent = await GriptScraper.scrapeArticleContent(article.url);
          } else if (article.source === 'The Ditch') {
            const { DitchScraper } = await import('../services/customScrapers/ditchScraper');
            fullContent = await DitchScraper.scrapeArticleContent(article.url);
          } else {
            // Use generic scraper for all other sources (Irish Times, RTE, Journal, etc.)
            fullContent = await NewsScraperService.scrapeArticleContent(article.url);
          }
          
          if (fullContent && fullContent.length > 200) {
            article.content = fullContent;
            console.log(`   ✅ Got ${fullContent.length} characters`);
          } else {
            console.log(`   ⚠️ Content too short (${fullContent?.length || 0} chars), keeping snippet`);
          }
          
          // Rate limit between requests
          await sleep(2000);
        } catch (error: unknown) {
          console.log(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      politicalArticles.push(article);
    }
    console.log(`✅ Full content ready for ${politicalArticles.length} political articles\n`);

    // Step 4: Process ALL political articles
    console.log('💾 Step 4: Processing all political articles...');
    
    const articlesToProcess = existingArticleUrls.size > 0
      ? politicalArticles.filter(article => !existingArticleUrls.has(article.url))
      : politicalArticles;
    console.log(`   Will analyze ${articlesToProcess.length} new articles (out of ${politicalArticles.length})\n`);
    
    // Step 5: Save as unprocessed. Scoring belongs to the scoring module (server/scoring),
    // which the scheduler and `npm run td-scoring` run against unprocessed articles.
    for (const article of articlesToProcess) {
      try {
        const savedId = await saveArticleToDatabase(article, null, null);
        if (savedId) stats.articlesProcessed++;
      } catch (error: unknown) {
        stats.errors.push(`Failed to save: ${article.title} (${error instanceof Error ? error.message : String(error)})`);
      }
    }
    console.log(`\n✅ Saved ${stats.articlesProcessed} new articles for scoring\n`);


    await topUpPolicyOpportunities(stats);

    stats.endTime = new Date();
    const duration = stats.endTime.getTime() - stats.startTime.getTime();
    
    console.log('\n==========================================');
    console.log('✅ DAILY NEWS SCRAPING COMPLETE');
    console.log('==========================================');
    console.log(`📊 Statistics:`);
    console.log(`   Articles found: ${stats.articlesFound}`);
    console.log(`   Articles processed: ${stats.articlesProcessed}`);
    console.log(`   Duplicates skipped: ${stats.articlesSkippedExisting}`);
    console.log(`   TDs mentioned: ${stats.tdsMentioned}`);
    console.log(`   Scores updated: ${stats.scoresUpdated}`);
    console.log(`   Policy votes created: ${stats.policyOpportunitiesCreated}/${stats.policyOpportunityCandidates} (${stats.policyOpportunityCandidates > 0 ? Math.round((stats.policyOpportunitiesCreated / stats.policyOpportunityCandidates) * 100) : 0}%)`);
    console.log(`   Errors: ${stats.errors.length}`);
    console.log(`   Duration: ${Math.round(duration / 1000)}s`);
    console.log('==========================================\n');
    const policyCoverageRatio = stats.policyOpportunityCandidates > 0
      ? stats.policyOpportunitiesCreated / stats.policyOpportunityCandidates
      : 0;
    if (policyCoverageRatio < 0.3) {
      console.warn(`⚠️ Policy vote coverage below target (${(policyCoverageRatio * 100).toFixed(1)}%). Target is 33%.`);
    }
    console.log(JSON.stringify({
      event: 'dailyNewsScraper.summary',
      timestamp: stats.endTime.toISOString(),
      lookbackHours,
      articlesFound: stats.articlesFound,
      articlesProcessed: stats.articlesProcessed,
      articlesSkippedExisting: stats.articlesSkippedExisting,
      tdsMentioned: stats.tdsMentioned,
      scoresUpdated: stats.scoresUpdated,
      policyOpportunityCandidates: stats.policyOpportunityCandidates,
      policyOpportunitiesCreated: stats.policyOpportunitiesCreated,
      errorCount: stats.errors.length
    }));

  } catch (error: unknown) {
    console.error('❌ Daily news scraper failed:', error);
    stats.errors.push(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    stats.endTime = new Date();
  }

  return stats;
}

/**
 * Schedule daily news scraping job
 */
/** Schedule the daily news scraping job. */
export function scheduleDailyNewsScraper() {
  // Run every day at 6 AM Irish time
  cron.schedule('0 6 * * *', async () => {
    console.log('⏰ Triggered: Daily news scraping job');
    await runDailyNewsScraper();
  }, {
    timezone: 'Europe/Dublin'
  });

  console.log('✅ Daily news scraper scheduled for 6:00 AM Irish time');
}

/**
 * Run scraper manually (for testing)
 */
export async function runManualScrape(options: {
  limit?: number;
  crossCheck?: boolean;
} = {}): Promise<JobStats> {
  console.log('🚀 Running manual news scrape...');
  return runDailyNewsScraper();
}

/**
 * DEPRECATED: Policy vote opportunities are now generated during multi-agent scoring
 * This function is kept for backwards compatibility but does nothing.
 * Policy opportunities are only created for articles that pass the importance filter
 * and are scored by the multi-agent team. See newsToTDScoringService.ts
 */
async function topUpPolicyOpportunities(stats: JobStats, targetRatio = 0.33): Promise<void> {
  // Policy vote generation moved to multi-agent scoring phase
  // Only articles scored by the multi-agent team get policy vote opportunities
  // This ensures quality over quantity - see newsToTDScoringService.ts
  console.log('ℹ️  Policy vote top-up skipped (now handled during multi-agent scoring)');
  return;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Save article to database (without TD analysis for general political news)
 */
async function saveArticleToDatabase(
  article: ScrapedArticle,
  politician: { name: string; constituency: string; party: string } | null,
  analysis: ArticleAnalysis | null
): Promise<number | null> {
  if (!supabaseDb) {
    console.warn('⚠️ Supabase not connected - cannot save article');
    return null;
  }
  
  try {
    // Check if article already exists (by URL)
    const { data: existing } = await supabaseDb
      .from('news_articles')
      .select('id')
      .eq('url', article.url)
      .single();
    
    if (existing) {
      console.log(`   ℹ️  Article already processed (ID: ${existing.id})`);
      return existing.id;
    }
    
    // Layer 1: Quick title deduplication check
    // Catches "Herzog Park protest" from multiple sources
    const { TitleDeduplicationService } = await import('../services/titleDeduplicationService');
    const duplicateCheck = await TitleDeduplicationService.checkForDuplicate(
      article.title,
      { lookbackHours: 48, threshold: 0.6 }
    );
    
    if (duplicateCheck.isDuplicate) {
      console.log(`   🔗 DUPLICATE: "${article.title.substring(0, 50)}..."`);
      console.log(`      Similar to: "${duplicateCheck.similarTitle?.substring(0, 50)}..." (${duplicateCheck.similarSource})`);
      console.log(`      Similarity: ${Math.round(duplicateCheck.similarityScore * 100)}% - SKIPPING`);
      return null; // Don't save duplicate
    }
    
    // Import image generation service
    const { NewsImageGenerationService } = await import('../services/newsImageGenerationService');
    
    // Generate unique DALL-E image for article (or fallback to RSS image or random)
    let imageUrl = article.imageUrl;
    if (!imageUrl) {
      // Generate a unique AI image for this article
      console.log(`   🎨 Generating unique AI image for article...`);
      imageUrl = await NewsImageGenerationService.generateArticleImage(
        article,
        Date.now() // Temporary ID until we get the real one
      );
      console.log(`   ✅ Image ready: ${imageUrl}`);
    } else {
      console.log(`   🖼️  Using RSS image: ${imageUrl}`);
    }
    
    // Prepare base article data
    // visible: false - Will be set true after importance triage
    // processed: false - Will be set true after multi-agent scoring
    const articleData: Record<string, any> = {
      url: article.url,
      title: article.title,
      content: article.content,
      source: article.source,
      published_date: article.published_date.toISOString(),
      image_url: imageUrl,
      processed: false,  // Multi-agent scoring will set this to true
      visible: false,    // Importance triage will set this to true
      credibility_score: article.credibility
    };
    
    // Add TD analysis if available
    if (politician && analysis) {
      articleData.politician_name = politician.name;
      articleData.constituency = politician.constituency;
      articleData.story_type = analysis.story_type;
      articleData.sentiment = analysis.sentiment;
      articleData.impact_score = analysis.impact_score;
      articleData.transparency_impact = analysis.transparency_impact;
      articleData.effectiveness_impact = analysis.effectiveness_impact;
      articleData.integrity_impact = analysis.integrity_impact;
      articleData.consistency_impact = analysis.consistency_impact;
      articleData.constituency_service_impact = analysis.constituency_service_impact;
      articleData.ai_summary = analysis.summary;
      articleData.ai_reasoning = analysis.reasoning;
      articleData.key_quotes = JSON.stringify(analysis.key_quotes);
      articleData.is_announcement = analysis.is_announcement;
      articleData.critical_analysis_summary = analysis.critical_analysis?.reality_check;
      articleData.final_adjusted_impact = analysis.bias_adjustments?.final_adjusted_impact;
      articleData.score_applied = false;
    } else {
      // General political article - generate a better summary
      // Take first 600 characters, then find a good sentence ending
      const contentSnippet = article.content.substring(0, 600);
      const lastSentenceEnd = Math.max(
        contentSnippet.lastIndexOf('. '),
        contentSnippet.lastIndexOf('! '),
        contentSnippet.lastIndexOf('? ')
      );
      // Use the sentence boundary if found, otherwise use the full snippet
      const summary = lastSentenceEnd > 100 
        ? contentSnippet.substring(0, lastSentenceEnd + 1).trim()
        : contentSnippet.trim();
      articleData.ai_summary = summary;
      articleData.impact_score = 50; // Neutral score for general political news
    }
    
    // Insert new article
    const { data: inserted, error } = await supabaseDb
      .from('news_articles')
      .insert(articleData)
      .select('id')
      .single();
    
    if (error) {
      console.error(`   ❌ Failed to save article: ${error.message}`);
      return null;
    }
    
    console.log(`   ✅ Saved article (ID: ${inserted.id})`);
    return inserted.id;
    
  } catch (error: unknown) {
    console.error(`   ❌ Error saving article: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Save article analysis to database (DEPRECATED - use saveArticleToDatabase)
 */
async function saveArticleAnalysis(
  article: ScrapedArticle,
  politician: { name: string; constituency: string; party: string },
  analysis: ArticleAnalysis
): Promise<number | null> {
  if (!supabaseDb) {
    console.warn('⚠️ Supabase not connected - cannot save article');
    return null;
  }
  
  try {
    // Check if article already exists
    const { data: existing } = await supabaseDb
      .from('news_articles')
      .select('id')
      .eq('url', article.url)
      .single();
    
    if (existing) {
      console.log(`   ℹ️  Article already processed (ID: ${existing.id})`);
      return existing.id;
    }
    
    // Import image generation service
    const { NewsImageGenerationService } = await import('../services/newsImageGenerationService');
    
    // Generate unique DALL-E image for article (or fallback to RSS image or random)
    let imageUrl = article.imageUrl;
    if (!imageUrl) {
      // Generate a unique AI image for this article
      console.log(`   🎨 Generating unique AI image for article...`);
      imageUrl = await NewsImageGenerationService.generateArticleImage(
        article,
        Date.now() // Temporary ID until we get the real one
      );
      console.log(`   ✅ Image ready: ${imageUrl}`);
    } else {
      console.log(`   🖼️  Using RSS image: ${imageUrl}`);
    }
    
    // Insert new article with analysis
    const { data: inserted, error } = await supabaseDb
      .from('news_articles')
      .insert({
        url: article.url,
        title: article.title,
        content: article.content,
        source: article.source,
        published_date: article.published_date.toISOString(),
        politician_name: politician.name,
        constituency: politician.constituency,
        image_url: imageUrl,  // Always has an image!
        
        // AI Analysis
        story_type: analysis.story_type,
        sentiment: analysis.sentiment,
        impact_score: analysis.impact_score,
        transparency_impact: analysis.transparency_impact,
        effectiveness_impact: analysis.effectiveness_impact,
        integrity_impact: analysis.integrity_impact,
        consistency_impact: analysis.consistency_impact,
        constituency_service_impact: analysis.constituency_service_impact,
        ai_summary: analysis.summary,
        ai_reasoning: analysis.reasoning,
        key_quotes: JSON.stringify(analysis.key_quotes),
        
        // Bias Protection
        is_announcement: analysis.is_announcement,
        critical_analysis_summary: analysis.critical_analysis?.reality_check,
        final_adjusted_impact: analysis.bias_adjustments?.final_adjusted_impact,
        
        // Metadata
        processed: true,
        score_applied: false,
        credibility_score: article.credibility
      })
      .select('id')
      .single();
    
    if (error) {
      console.error(`   ❌ Failed to save article: ${error.message}`);
      return null;
    }
    
    console.log(`   ✅ Saved article (ID: ${inserted.id})`);
    return inserted.id;
    
  } catch (error: unknown) {
    console.error(`   ❌ Error saving article: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}


/** Scheduled job for scraping daily news. */
export const DailyNewsScraperJob = {
  run: runDailyNewsScraper,
  schedule: scheduleDailyNewsScraper,
  runManual: runManualScrape,
  saveArticleAnalysis
};

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}


function resolveConfiguredLookbackHours(): number {
  const envHours = Number(process.env.NEWS_LOOKBACK_HOURS);
  if (!Number.isNaN(envHours) && envHours > 0) {
    return envHours;
  }
  const envDays = Number(process.env.NEWS_LOOKBACK_DAYS);
  if (!Number.isNaN(envDays) && envDays > 0) {
    return envDays * 24;
  }
  return 48;
}

