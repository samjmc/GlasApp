/**
 * Daily News Scraper Job
 * Automated job that runs daily to scrape news, analyze articles, and update TD scores
 */

import cron from 'node-cron';
import { NewsScraperService } from '../services/newsScraperService';
import { TDExtractionService } from '../services/tdExtractionService';
import { AINewsAnalysisService } from '../services/aiNewsAnalysisService';
import { ELOScoringService } from '../services/eloScoringService';
import { TDIdeologyProfileService } from '../services/tdIdeologyProfileService';
import { supabaseDb } from '../db';
import { ArticleAnalysis } from '../services/aiNewsAnalysisService';
import { ScrapedArticle } from '../services/newsScraperService';
import { PolicyOpportunityService } from '../services/policyOpportunityService';

interface CachedTDScores {
  overall_elo: number;
  transparency_elo: number;
  effectiveness_elo: number;
  integrity_elo: number;
  consistency_elo: number;
  constituency_service_elo: number;
}

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
      } catch (error: any) {
        console.warn(`⚠️ Unable to pre-check existing articles before filtering: ${error.message}`);
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
        } catch (error: any) {
          console.log(`   ❌ Failed: ${error.message}`);
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
    
    // Step 5: LET AI EXTRACT TDs (smarter than keyword matching!)
    console.log('🤖 Step 5: AI analyzing articles to find relevant TDs...');
    console.log('   (AI can detect "Tánaiste", indirect references, policy impacts)');
    console.log('   (This replaces keyword filtering for better accuracy)\n');
    
    const articlesWithTDs = [];
    const tdScoreCache = new Map<string, CachedTDScores>();
    const promiseTrackingEnabled = isPromiseTrackingEnabled();
    
    for (const article of articlesToProcess) {
      try {
        console.log(`\n📰 Analyzing: "${article.title.substring(0, 70)}..."`);
        
        // NEW APPROACH: Ask AI to extract ALL relevant TDs from article
        // AI is smarter than keywords - can detect:
        // - Title-only ("Tánaiste said...")
        // - Indirect ("The government announced...")
        // - Multiple TDs affected by policy
        const aiExtractedTDs = await AINewsAnalysisService.extractRelevantTDsFromArticle(
          article,
          { useKeywordFallback: true } // Fallback to keyword extraction if AI fails
        );
        
        if (aiExtractedTDs.length > 0) {
          console.log(`   🎯 AI found ${aiExtractedTDs.length} relevant TDs: ${aiExtractedTDs.map(td => td.name).join(', ')}`);
          articlesWithTDs.push({
            article,
            politicians: aiExtractedTDs
          });
        } else {
          console.log(`   ⏭️  No TDs affected - saving as general news`);
          // No TD mentions - save article without TD scoring
          // Policy opportunities are now generated during multi-agent scoring (newsToTDScoringService)
          const savedId = await saveArticleToDatabase(article, null, null);
          // Policy vote generation moved to scoring phase - see newsToTDScoringService.ts
        }
        
        // Rate limiting to avoid API throttling
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`   ❌ Error analyzing article: ${error.message}`);
        stats.errors.push(`Failed to analyze: ${article.title}`);
        
        // Fallback to keyword extraction if AI fails
        console.log(`   🔄 Falling back to keyword extraction...`);
        const tdMentions = await TDExtractionService.extractTDMentions(
          article.title + ' ' + article.content
        );
        const substantialMentions = tdMentions.filter(mention => 
          TDExtractionService.isSubstantialMention(
            article.title + ' ' + article.content,
            mention.name
          )
        );
        
        if (substantialMentions.length > 0) {
          articlesWithTDs.push({
            article,
            politicians: substantialMentions
          });
        } else {
          const savedId = await saveArticleToDatabase(article, null, null);
          // Policy vote generation moved to scoring phase - see newsToTDScoringService.ts
        }
      }
    }
    
    console.log(`\n✅ ${articlesWithTDs.length} articles have relevant TDs\n`);

    // Step 5: Analyze impact for each TD
    console.log('📊 Step 5: Scoring TD impacts with AI...');
    console.log('   (Analyzing how each article affects each TD)\n');
    
    if (articlesWithTDs.length > 0) {
      const preloadedScores = await loadAllCurrentTDScores();
      preloadedScores.forEach((value, key) => tdScoreCache.set(key, value));
    }
    
    for (const { article, politicians } of articlesWithTDs) {
      for (const politician of politicians) {
        try {
          console.log(`\n📰 Article: "${article.title.substring(0, 60)}..."`);
          console.log(`👤 TD: ${politician.name} (${politician.constituency})`);
          
          // Analyze impact with AI
          const shouldCrossCheck = (article.credibility ?? 0.75) >= 0.9;
          const analysis = await AINewsAnalysisService.analyzeArticle(
            article,
            politician,
            { crossCheck: shouldCrossCheck }
          );
          
          // Display results
          console.log(`   📊 Type: ${analysis.story_type}`);
          console.log(`   😊 Sentiment: ${analysis.sentiment}`);
          console.log(`   💥 Impact: ${analysis.impact_score > 0 ? '+' : ''}${analysis.impact_score}`);
          console.log(`   💬 Summary: ${analysis.summary}`);
          
          // Calculate ELO changes
          const articleAge = ELOScoringService.getArticleAge(article.published_date);
          
          const cacheKey = politician.name.toLowerCase();
          const currentScores = await getCurrentTDScores(politician.name, tdScoreCache);
          
          const { updated, changes } = ELOScoringService.updateTDScores(
            currentScores,
            analysis,
            article.credibility,
            articleAge
          );
          
          console.log(`   🎯 ELO Change: ${changes.overall.oldScore} → ${changes.overall.newScore} (${changes.overall.change > 0 ? '+' : ''}${changes.overall.change})`);
          
          // Save to database with TD analysis
          const articleId = await saveArticleToDatabase(article, politician, analysis);
          
          if (articleId) {
            // Policy vote generation moved to multi-agent scoring phase
            // See newsToTDScoringService.ts - only scored articles get policy opportunities
            const updateSuccess = await updateTDScoreInDB(
              politician.name,
              politician.constituency,
              politician.party,
              updated,
              changes,
              articleId
            );
            if (updateSuccess) {
              tdScoreCache.set(cacheKey, { ...updated });
              await upsertArticleTDScore(articleId, politician.name, analysis, changes);
              await markArticleAsScored(articleId);
            }
            stats.scoresUpdated++;
            
            // NEW: Update TD ideology profiles if policy stance detected (WITH ENHANCEMENTS)
            if (analysis.td_policy_stance?.ideology_delta && analysis.td_policy_stance.stance !== 'unclear') {
              console.log(`   🧭 Updating ${politician.name}'s ideology profile from policy stance...`);
              
              // Import enhancement functions
              const {
                calculateEnhancedArticleWeight,
                applyIssueSalienceWeighting,
                checkArticleConsistency,
              } = await import('../services/articleIdeologyEnhancements.js');
              
              // Step 1: Determine source reliability
              const sourceUrl = article.url?.toLowerCase() || '';
              let sourceReliability = 0.7; // default
              if (sourceUrl.includes('rte.ie') || sourceUrl.includes('oireachtas.ie')) {
                sourceReliability = 0.9; // Primary/major sources
              } else if (sourceUrl.includes('irishtimes.com') || sourceUrl.includes('independent.ie')) {
                sourceReliability = 0.85; // Major news
              } else if (sourceUrl.includes('thejournal.ie') || sourceUrl.includes('examiner.ie')) {
                sourceReliability = 0.75; // Regional/online news
              } else if (sourceUrl.includes('twitter.com') || sourceUrl.includes('facebook.com')) {
                sourceReliability = 0.3; // Social media
              }
              
              // Step 2: Base weight calculation
              const baseWeight = (analysis.td_policy_stance.strength / 5) * (analysis.confidence || 0.8) * sourceReliability;
              
              // Step 3: Apply political science enhancements
              const { effectiveWeight, adjustments } = await calculateEnhancedArticleWeight(
                politician.name,
                politician.party,
                politician.role,
                {
                  stance: analysis.td_policy_stance.stance,
                  strength: analysis.td_policy_stance.strength,
                  policy_topic: analysis.td_policy_stance.policy_topic,
                  is_opposition_advocacy: analysis.is_opposition_advocacy,
                  is_ideological_policy: analysis.is_ideological_policy,
                  speech_classification: analysis.speech_classification,
                },
                baseWeight,
              );
              
              if (adjustments.length > 0) {
                console.log(`   📊 Enhancements applied: ${adjustments.join(', ')}`);
              }
              
              // Step 4: Apply issue salience weighting per dimension
              const salienceAdjustedDeltas = applyIssueSalienceWeighting(
                analysis.td_policy_stance.ideology_delta,
                analysis.td_policy_stance.policy_topic,
              );
              
              // Step 5: Check for consistency with previous statements
              const consistencyCheck = await checkArticleConsistency(
                politician.name,
                analysis.td_policy_stance.policy_topic,
                salienceAdjustedDeltas,
                article.published_at || new Date(),
              );
              
              let finalWeight = effectiveWeight;
              if (consistencyCheck.hasContradiction) {
                finalWeight *= consistencyCheck.penalty;
                console.log(`   ⚠️  Consistency issue detected: ${consistencyCheck.reason} (penalty: ${consistencyCheck.penalty.toFixed(2)}×)`);
              }
              
              // Step 6: Apply ideology adjustments with enhanced weight
              await TDIdeologyProfileService.applyAdjustments(
                politician.name,
                salienceAdjustedDeltas,
                {
                  sourceType: 'article',
                  sourceId: articleId,
                  policyTopic: analysis.td_policy_stance.policy_topic,
                  weight: finalWeight,
                  confidence: analysis.confidence || 0.8,
                  sourceDate: article.published_at || new Date(),
                  sourceReliability,
                }
              );
              console.log(`   ✅ Ideology profile updated (final weight: ${finalWeight.toFixed(3)})`);
            }
            
            // BIAS PROTECTION: Track promises from announcements
            if (promiseTrackingEnabled && analysis.is_announcement && analysis.impact_score > 0) {
              await trackPromiseForVerification(
                articleId,
                politician.name,
                article,
                analysis
              );
              console.log(`   📋 Promise tracked for future verification`);
            }
          }
          
          stats.articlesProcessed++;
          stats.tdsMentioned++;
          
        } catch (error: any) {
          console.error(`   ❌ Analysis failed: ${error.message}`);
          stats.errors.push(`${politician.name}: ${error.message}`);
        }
        
        // Rate limiting - 2 seconds between requests
        await sleep(2000);
      }
    }

    // Step 6: Run TD Scoring Service to process articles into article_td_scores table
    console.log('\n🎯 Step 6: Running TD Scoring Service to populate impact scores...\n');
    
    try {
      const { NewsToTDScoringService } = await import('../services/newsToTDScoringService');
      const scoringStats = await NewsToTDScoringService.processUnprocessedArticles({
        batchSize: 50,
        crossCheck: false  // Set to true for high-accuracy mode (slower)
      });
      
      console.log(`✅ TD Scoring complete:`);
      console.log(`   Articles processed: ${scoringStats.articlesProcessed}`);
      console.log(`   TDs updated: ${scoringStats.tdsUpdated}`);
      console.log(`   Scores changed: ${scoringStats.scoresChanged}`);
      if (scoringStats.errors > 0) {
        console.log(`   ⚠️  Errors: ${scoringStats.errors}`);
      }
    } catch (scoringError: any) {
      console.error('⚠️  TD Scoring failed:', scoringError.message);
      stats.errors.push(`TD Scoring: ${scoringError.message}`);
    }
    
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

  } catch (error: any) {
    console.error('❌ Daily news scraper failed:', error);
    stats.errors.push(`Fatal error: ${error.message}`);
    stats.endTime = new Date();
  }

  return stats;
}

/**
 * Schedule daily news scraping job
 */
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

async function generatePolicyOpportunity(
  articleId: number,
  article: ScrapedArticle,
  options: { force?: boolean } = {}
): Promise<boolean> {
  try {
    return await PolicyOpportunityService.generateAndSave(articleId, {
      id: articleId,
      title: article.title,
      content: article.content,
      source: article.source,
      published_date: article.published_date
    }, options);
  } catch (error: any) {
    console.error(`   ❌ Failed to create policy opportunity: ${error.message}`);
    return false;
  }
}

async function upsertArticleTDScore(
  articleId: number,
  politicianName: string,
  analysis: ArticleAnalysis,
  changes: any
): Promise<void> {
  if (!supabaseDb) return;

  try {
    await supabaseDb
      .from('article_td_scores')
      .upsert(
        {
          article_id: articleId,
          politician_name: politicianName,
          transparency_score: analysis.transparency_score ?? null,
          integrity_score: analysis.integrity_score ?? null,
          effectiveness_score: analysis.effectiveness_score ?? null,
          consistency_score: analysis.consistency_score ?? null,
          transparency_reasoning: analysis.transparency_reasoning ?? null,
          effectiveness_reasoning: analysis.effectiveness_reasoning ?? null,
          integrity_reasoning: analysis.integrity_reasoning ?? null,
          consistency_reasoning: analysis.consistency_reasoning ?? null,
          impact_score: analysis.impact_score ?? 0,
          story_type: analysis.story_type,
          sentiment: analysis.sentiment,
          flip_flop_detected: analysis.historical_context?.flipFlopSeverity || 'none',
          flip_flop_explanation: analysis.historical_context?.flipFlopDetails || null,
          suspicious_timing: analysis.historical_context?.suspiciousTiming || false,
          needs_review: analysis.historical_context?.needsHumanReview || false,
          old_overall_elo: changes?.overall?.oldScore ?? null,
          new_overall_elo: changes?.overall?.newScore ?? null,
          elo_change: changes?.overall?.change ?? null,
          ai_reasoning: analysis.reasoning ?? null,
          is_opposition_advocacy: analysis.is_opposition_advocacy ?? false,
          analyzed_by: analysis.analyzed_by ?? null,
        },
        { onConflict: 'article_id,politician_name' },
      );
  } catch (error: any) {
    console.error(`   ⚠️  Warning: Failed to record article_td_scores: ${error.message}`);
  }
}

async function markArticleAsScored(articleId: number): Promise<void> {
  if (!supabaseDb) return;
  try {
    await supabaseDb
      .from('news_articles')
      .update({
        processed: true,
        score_applied: true,
        last_processed_at: new Date().toISOString(),
      })
      .eq('id', articleId);
  } catch (error: any) {
    console.error(`   ⚠️  Warning: Failed to mark article as scored: ${error.message}`);
  }
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
    const articleData: any = {
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
    
  } catch (error: any) {
    console.error(`   ❌ Error saving article: ${error.message}`);
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
    
  } catch (error: any) {
    console.error(`   ❌ Error saving article: ${error.message}`);
    return null;
  }
}

/**
 * Update TD score in database
 */
async function updateTDScoreInDB(
  tdName: string,
  constituency: string,
  party: string,
  updatedScores: any,
  changes: any,
  articleId: number | null
): Promise<boolean> {
  if (!supabaseDb) {
    console.warn('⚠️ Supabase not connected - cannot update TD score');
    return false;
  }
  
  try {
    // Check if TD score exists
    const { data: existing } = await supabaseDb
      .from('td_scores')
      .select('*')
      .eq('politician_name', tdName)
      .single();
    
    if (existing) {
      // Update existing score
      const { error } = await supabaseDb
        .from('td_scores')
        .update({
          overall_elo: updatedScores.overall_elo,
          transparency_elo: updatedScores.transparency_elo,
          effectiveness_elo: updatedScores.effectiveness_elo,
          integrity_elo: updatedScores.integrity_elo,
          consistency_elo: updatedScores.consistency_elo,
          constituency_service_elo: updatedScores.constituency_service_elo,
          total_stories: existing.total_stories + 1,
          last_updated: new Date().toISOString()
        })
        .eq('politician_name', tdName);
      
      if (error) {
        console.error(`   ❌ Failed to update TD score: ${error.message}`);
        return false;
      }
      
      // Record history
      await supabaseDb
        .from('td_score_history')
        .insert({
          politician_name: tdName,
          article_id: articleId,
          old_overall_elo: changes.overall.oldScore,
          new_overall_elo: changes.overall.newScore,
          elo_change: changes.overall.change,
          dimension_affected: getPrimaryDimension(changes),
          impact_score: changes.overall.impactScore,
          story_type: changes.overall.storyType
        });
      
      console.log(`   ✅ Updated TD score in database`);
      return true;
    } else {
      // Create new TD score
      const { error } = await supabaseDb
        .from('td_scores')
        .insert({
          politician_name: tdName,
          constituency: constituency,
          party: party,
          overall_elo: updatedScores.overall_elo,
          transparency_elo: updatedScores.transparency_elo,
          effectiveness_elo: updatedScores.effectiveness_elo,
          integrity_elo: updatedScores.integrity_elo,
          consistency_elo: updatedScores.consistency_elo,
          constituency_service_elo: updatedScores.constituency_service_elo,
          total_stories: 1,
          positive_stories: changes.overall.sentiment?.includes('positive') ? 1 : 0,
          negative_stories: changes.overall.sentiment?.includes('negative') ? 1 : 0,
          neutral_stories: changes.overall.sentiment === 'neutral' ? 1 : 0
        });
      
      if (error) {
        console.error(`   ❌ Failed to create TD score: ${error.message}`);
        return false;
      }
      
      console.log(`   ✅ Created new TD score in database`);
      return true;
    }
    
  } catch (error: any) {
    console.error(`   ❌ Error updating TD score: ${error.message}`);
    return false;
  }
}

/**
 * Get the primary dimension that changed most
 */
function getPrimaryDimension(changes: any): string {
  const dimensions = {
    transparency: Math.abs(changes.transparency?.change || 0),
    effectiveness: Math.abs(changes.effectiveness?.change || 0),
    integrity: Math.abs(changes.integrity?.change || 0),
    consistency: Math.abs(changes.consistency?.change || 0),
    constituency_service: Math.abs(changes.constituency_service?.change || 0)
  };
  
  return Object.entries(dimensions)
    .sort(([,a], [,b]) => b - a)[0][0];
}

/**
 * Track promise for future verification (BIAS PROTECTION)
 */
async function trackPromiseForVerification(
  articleId: number,
  politicianName: string,
  article: ScrapedArticle,
  analysis: ArticleAnalysis
): Promise<void> {
  if (!isPromiseTrackingEnabled()) {
    return;
  }
  if (!supabaseDb) {
    console.warn('⚠️ Supabase not connected - cannot track promise');
    return;
  }
  
  try {
    // Extract promise details from article title
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + 6);  // Verify in 6 months
    
    const nextCheckDate = new Date();
    nextCheckDate.setMonth(nextCheckDate.getMonth() + 3);  // First check in 3 months
    
    // Save promise to track
    const { error } = await supabaseDb
      .from('policy_promises')
      .insert({
        politician_name: politicianName,
        promise_text: article.title,
        promise_type: analysis.story_type === 'policy_work' ? 'policy' : 'service',
        announced_date: article.published_date.toISOString().split('T')[0],
        source_article_id: articleId,
        initial_score_given: analysis.bias_adjustments?.final_adjusted_impact || analysis.impact_score,
        target_date: targetDate.toISOString().split('T')[0],
        next_check_date: nextCheckDate.toISOString().split('T')[0],
        status: 'pending'
      });
    
    if (error) {
      if (!promisePermissionWarningLogged && error.message?.includes('permission denied')) {
        promisePermissionWarningLogged = true;
        console.warn(`   ⚠️ Skipping promise tracking due to permissions: ${error.message}`);
      }
    }
    
  } catch (error: any) {
    if (!promisePermissionWarningLogged && error.message?.includes('permission denied')) {
      promisePermissionWarningLogged = true;
      console.warn(`   ⚠️ Skipping promise tracking due to permissions: ${error.message}`);
    } else {
      console.error(`   ⚠️ Error tracking promise: ${error.message}`);
    }
  }
}

export const DailyNewsScraperJob = {
  run: runDailyNewsScraper,
  schedule: scheduleDailyNewsScraper,
  runManual: runManualScrape,
  saveArticleAnalysis,
  updateTDScoreInDB
};

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function createDefaultTDScores(): CachedTDScores {
  return {
    overall_elo: 1500,
    transparency_elo: 1500,
    effectiveness_elo: 1500,
    integrity_elo: 1500,
    consistency_elo: 1500,
    constituency_service_elo: 1500
  };
}

async function getCurrentTDScores(tdName: string, cache: Map<string, CachedTDScores>): Promise<CachedTDScores> {
  const cacheKey = tdName.toLowerCase();
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }
  
  if (!supabaseDb) {
    const defaults = createDefaultTDScores();
    cache.set(cacheKey, defaults);
    return defaults;
  }
  
  const { data, error } = await supabaseDb
    .from('td_scores')
    .select('overall_elo, transparency_elo, effectiveness_elo, integrity_elo, consistency_elo, constituency_service_elo')
    .eq('politician_name', tdName)
    .maybeSingle();
  
  const defaults = createDefaultTDScores();
  
  if (error || !data) {
    if (error && !error.message?.includes('No rows')) {
      console.warn(`   ⚠️ Could not load existing scores for ${tdName}: ${error.message}`);
    }
    cache.set(cacheKey, defaults);
    return defaults;
  }
  
  const parsed: CachedTDScores = {
    overall_elo: Number(data.overall_elo) || defaults.overall_elo,
    transparency_elo: Number(data.transparency_elo) || defaults.transparency_elo,
    effectiveness_elo: Number(data.effectiveness_elo) || defaults.effectiveness_elo,
    integrity_elo: Number(data.integrity_elo) || defaults.integrity_elo,
    consistency_elo: Number(data.consistency_elo) || defaults.consistency_elo,
    constituency_service_elo: Number(data.constituency_service_elo) || defaults.constituency_service_elo
  };
  
  cache.set(cacheKey, parsed);
  return parsed;
}

let promisePermissionWarningLogged = false;

function isPromiseTrackingEnabled(): boolean {
  return process.env.ENABLE_PROMISE_TRACKING === 'true';
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

async function loadAllCurrentTDScores(): Promise<Map<string, CachedTDScores>> {
  const map = new Map<string, CachedTDScores>();
  if (!supabaseDb) {
    return map;
  }
  const { data, error } = await supabaseDb
    .from('td_scores')
    .select('politician_name, overall_elo, transparency_elo, effectiveness_elo, integrity_elo, consistency_elo, constituency_service_elo')
    .eq('is_active', true);
  if (error) {
    console.warn(`   ⚠️ Unable to preload TD scores: ${error.message}`);
    return map;
  }
  data?.forEach(row => {
    if (!row?.politician_name) return;
    map.set(row.politician_name.toLowerCase(), {
      overall_elo: Number(row.overall_elo) || 1500,
      transparency_elo: Number(row.transparency_elo) || 1500,
      effectiveness_elo: Number(row.effectiveness_elo) || 1500,
      integrity_elo: Number(row.integrity_elo) || 1500,
      consistency_elo: Number(row.consistency_elo) || 1500,
      constituency_service_elo: Number(row.constituency_service_elo) || 1500
    });
  });
  return map;
}



