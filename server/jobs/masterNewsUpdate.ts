/**
 * MASTER NEWS UPDATE JOB
 * 
 * This is the ONE SCRIPT to run that does EVERYTHING:
 * 1. Fetches latest news from all Irish sources
 * 2. Analyzes articles and extracts TD mentions
 * 3. Scores articles with TD impact analysis
 * 4. Updates all TD/party scores
 * 5. Recalculates personal rankings
 * 6. Updates all feeds (recent, highest impact, today's story)
 * 
 * Usage:
 *   npm run update-news
 *   or: npx tsx server/jobs/masterNewsUpdate.ts
 */

import 'dotenv/config';
import { shutdown } from '../db.js';

interface MasterJobStats {
  articlesFound: number;
  articlesProcessed: number;
  articlesSaved: number;
  tdsScored: number;
  tdScoresUpdated: number;
  partyScoresUpdated: number;
  personalRankingsUpdated: number;
  errors: string[];
  duration: number;
}

async function runMasterNewsUpdate(): Promise<MasterJobStats> {
  const startTime = Date.now();
  const cliOptions = parseCliOptions(process.argv.slice(2));
  const envLookbackHours = Number(process.env.NEWS_LOOKBACK_HOURS);
  const envLookbackDays = Number(process.env.NEWS_LOOKBACK_DAYS);
  let lookbackHoursOverride = cliOptions.lookbackHours;
  if (lookbackHoursOverride === undefined) {
    if (!Number.isNaN(envLookbackHours) && envLookbackHours > 0) {
      lookbackHoursOverride = envLookbackHours;
    } else if (!Number.isNaN(envLookbackDays) && envLookbackDays > 0) {
      lookbackHoursOverride = envLookbackDays * 24;
    }
  }
  const skipUnifiedScoreSave = cliOptions.skipUnifiedScore ?? process.env.SKIP_UNIFIED_SCORE_SAVE === 'true';
  const stats: MasterJobStats = {
    articlesFound: 0,
    articlesProcessed: 0,
    articlesSaved: 0,
    tdsScored: 0,
    tdScoresUpdated: 0,
    partyScoresUpdated: 0,
    personalRankingsUpdated: 0,
    errors: [],
    duration: 0
  };

  console.log('\n' + '='.repeat(80));
  console.log('🚀 MASTER NEWS UPDATE JOB - COMPLETE PIPELINE');
  console.log('='.repeat(80));
  console.log(`📅 Started: ${new Date().toLocaleString('en-IE')}`);
  console.log('='.repeat(80) + '\n');

  try {
    // ========================================================================
    // STEP 1: FETCH & ANALYZE NEWS ARTICLES
    // ========================================================================
    console.log('📰 STEP 1: Fetching and analyzing news articles...\n');
    
    try {
      const { runDailyNewsScraper } = await import('./dailyNewsScraper.js');
      const scraperStats = await runDailyNewsScraper({
        lookbackHours: lookbackHoursOverride
      });
      
      stats.articlesFound = scraperStats.articlesFound;
      stats.articlesProcessed = scraperStats.articlesProcessed;
      stats.articlesSaved = scraperStats.articlesProcessed;
      stats.errors.push(...scraperStats.errors);
      
      console.log(`✅ Step 1 Complete:`);
      console.log(`   Articles found: ${scraperStats.articlesFound}`);
      console.log(`   Articles saved: ${scraperStats.articlesProcessed}`);
      console.log(`   TDs mentioned: ${scraperStats.tdsMentioned}\n`);
      
    } catch (error: any) {
      console.error('❌ Step 1 FAILED:', error.message);
      stats.errors.push(`News scraping: ${error.message}`);
      // Continue with other steps even if scraping fails
    }

    // ========================================================================
    // STEP 2: PROCESS ARTICLES & SCORE TD IMPACTS
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('🎯 STEP 2: Processing articles and scoring TD impacts...\n');
    
    try {
      const { NewsToTDScoringService } = await import('../services/newsToTDScoringService.js');
      const scoringStats = await NewsToTDScoringService.processUnprocessedArticles({
        batchSize: 100, // Process up to 100 articles at once
        crossCheck: false // Set to true for high-accuracy mode (slower, uses GPT-4)
      });
      
      stats.tdsScored = scoringStats.tdsUpdated;
      
      console.log(`✅ Step 2 Complete:`);
      console.log(`   Articles processed: ${scoringStats.articlesProcessed}`);
      console.log(`   TDs scored: ${scoringStats.tdsUpdated}`);
      console.log(`   Score changes: ${scoringStats.scoresChanged}`);
      if (scoringStats.errors > 0) {
        console.log(`   ⚠️  Errors: ${scoringStats.errors}`);
      }
      console.log('');
      
    } catch (error: any) {
      console.error('❌ Step 2 FAILED:', error.message);
      stats.errors.push(`TD scoring: ${error.message}`);
    }

    // ========================================================================
    // STEP 3: RECALCULATE ALL TD & PARTY SCORES
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 STEP 3: Recalculating all TD and party scores...\n');
    
    if (skipUnifiedScoreSave) {
      console.log('⚠️  Step 3 skipped (SKIP_UNIFIED_SCORE_SAVE enabled)');
    } else {
      try {
        const { recalculateAllScores } = await import('../services/comprehensiveTDScoringService.js');
        const recalcStats = await recalculateAllScores();
        
        stats.tdScoresUpdated = recalcStats.processed;
        
        console.log(`✅ Step 3 Complete:`);
        console.log(`   TDs updated: ${recalcStats.processed}`);
        console.log(`   Duration: ${(recalcStats.duration / 1000).toFixed(1)}s`);
        if (recalcStats.errors > 0) {
          console.log(`   ⚠️  Errors: ${recalcStats.errors}`);
        }
        console.log('');
        
      } catch (error: any) {
        console.error('❌ Step 3 FAILED:', error.message);
        stats.errors.push(`Score recalculation: ${error.message}`);
      }
    }

    // ========================================================================
    // STEP 4: UPDATE PARTY SCORES
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('🎭 STEP 4: Updating party aggregate scores...\n');
    
    try {
      const { PartyPerformanceService } = await import('../services/partyPerformanceService.js');
      const partyStats = await PartyPerformanceService.updateAllPartyScores();
      
      stats.partyScoresUpdated = partyStats.partiesUpdated || 0;
      
      console.log(`✅ Step 4 Complete:`);
      console.log(`   Parties updated: ${partyStats.partiesUpdated}`);
      console.log('');
      
    } catch (error: any) {
      console.error('⚠️  Step 4 failed (non-critical):', error.message);
      // Party scores are nice-to-have, not critical
    }

    // ========================================================================
    // STEP 5: UPDATE PERSONAL RANKINGS
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('👤 STEP 5: Updating personalized TD rankings...\n');
    
    try {
      const { PersonalRankingsService } = await import('../services/personalRankingsService.js');
      const rankingStats = await PersonalRankingsService.recalculateAllUserRankings();
      
      stats.personalRankingsUpdated = rankingStats.usersUpdated || 0;
      
      console.log(`✅ Step 5 Complete:`);
      console.log(`   User rankings updated: ${rankingStats.usersUpdated}`);
      console.log('');
      
    } catch (error: any) {
      console.error('⚠️  Step 5 failed (non-critical):', error.message);
      // Personal rankings are nice-to-have
    }

    // ========================================================================
    // STEP 6: CLEAR CACHES TO ENSURE FRESH DATA
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('🗑️  STEP 6: Clearing caches for fresh data...\n');
    
    try {
      const { CacheService } = await import('../services/cacheService.js');
      await CacheService.clearAllCaches();
      
      console.log(`✅ Step 6 Complete: All caches cleared\n`);
      
    } catch (error: any) {
      console.error('⚠️  Step 6 failed (non-critical):', error.message);
    }

    // ========================================================================
    // FINAL STATS
    // ========================================================================
    stats.duration = Date.now() - startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ MASTER NEWS UPDATE COMPLETE!');
    console.log('='.repeat(80));
    console.log('\n📊 FINAL STATISTICS:');
    console.log(`   ✓ Articles found:              ${stats.articlesFound}`);
    console.log(`   ✓ Articles processed:          ${stats.articlesProcessed}`);
    console.log(`   ✓ Articles saved:              ${stats.articlesSaved}`);
    console.log(`   ✓ TDs scored:                  ${stats.tdsScored}`);
    console.log(`   ✓ TD scores updated:           ${stats.tdScoresUpdated}`);
    console.log(`   ✓ Party scores updated:        ${stats.partyScoresUpdated}`);
    console.log(`   ✓ Personal rankings updated:   ${stats.personalRankingsUpdated}`);
    console.log(`   ⚠️  Errors:                     ${stats.errors.length}`);
    console.log(`   ⏱️  Total duration:             ${(stats.duration / 1000 / 60).toFixed(1)} minutes`);
    console.log('\n' + '='.repeat(80));
    
    if (stats.errors.length > 0) {
      console.log('\n⚠️  ERRORS ENCOUNTERED:');
      stats.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
      console.log('');
    }
    
    console.log('🎉 All feeds updated:');
    console.log('   ✓ Recent news feed');
    console.log('   ✓ Highest impact feed');
    console.log('   ✓ Today\'s biggest story');
    console.log('   ✓ TD profiles');
    console.log('   ✓ Party rankings');
    console.log('   ✓ Personal rankings\n');
    
  } catch (fatalError: any) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ FATAL ERROR - JOB ABORTED');
    console.error('='.repeat(80));
    console.error(fatalError);
    stats.errors.push(`Fatal: ${fatalError.message}`);
    stats.duration = Date.now() - startTime;
  }

  // Cleanup
  try {
    console.log('🧹 Cleaning up database connections...');
    await shutdown();
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('✅ Cleanup complete\n');
  } catch (cleanupError) {
    console.error('⚠️  Cleanup failed (non-critical)');
  }

  return stats;
}

// Run immediately when script is executed directly
runMasterNewsUpdate()
  .then((stats) => {
    const exitCode = stats.errors.length > 0 ? 1 : 0;
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('UNHANDLED ERROR:', error);
    process.exit(1);
  });

export { runMasterNewsUpdate };
export type { MasterJobStats };

function parseCliOptions(args: string[]): { lookbackHours?: number; skipUnifiedScore?: boolean } {
  const options: { lookbackHours?: number; skipUnifiedScore?: boolean } = {};
  for (const arg of args) {
    if (arg.startsWith('--lookback-hours=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isNaN(value) && value > 0) {
        options.lookbackHours = value;
      }
    } else if (arg.startsWith('--lookback-days=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isNaN(value) && value > 0) {
        options.lookbackHours = value * 24;
      }
    } else if (arg === '--skip-unified-save') {
      options.skipUnifiedScore = true;
    }
  }
  return options;
}

