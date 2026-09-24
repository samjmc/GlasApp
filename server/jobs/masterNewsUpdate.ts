/**
 * MASTER NEWS UPDATE JOB
 * 
 * This is the ONE SCRIPT to run that does EVERYTHING:
 * 1. Fetches latest news from all Irish sources
 * 2. Analyzes articles and extracts TD mentions
 * 3. Scores articles with TD impact analysis
 * 4. Updates all TD/party scores
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
  const stats: MasterJobStats = {
    articlesFound: 0,
    articlesProcessed: 0,
    articlesSaved: 0,
    tdsScored: 0,
    tdScoresUpdated: 0,
    partyScoresUpdated: 0,
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
      
    } catch (error: unknown) {
      console.error('❌ Step 1 FAILED:', error instanceof Error ? error.message : String(error));
      stats.errors.push(`News scraping: ${error instanceof Error ? error.message : String(error)}`);
      // Continue with other steps even if scraping fails
    }

    // ========================================================================
    // STEP 2: SCORE TD IMPACTS (the pipeline recalculates TD and party scores itself)
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('🎯 STEP 2: Scoring articles and recalculating TD and party scores...\n');

    try {
      const { runPipeline, recalculateAll } = await import('../scoring/index.js');
      const scoringStats = await runPipeline({ batchSize: 100 });
      stats.tdsScored = scoringStats.tdsUpdated;
      // Pull in parliamentary/debate inputs that changed since the last run even when no
      // article moved an ELO.
      const recalc = await recalculateAll();
      stats.tdScoresUpdated = recalc.tds;
      stats.partyScoresUpdated = recalc.parties;

      console.log(`✅ Step 2 Complete:`);
      console.log(`   Articles processed: ${scoringStats.articlesProcessed}`);
      console.log(`   TDs scored: ${scoringStats.tdsUpdated}`);
      console.log(`   TDs recalculated: ${recalc.tds}, parties: ${recalc.parties}`);
      if (scoringStats.errors > 0) {
        console.log(`   ⚠️  Errors: ${scoringStats.errors}`);
      }
      console.log('');

    } catch (error: unknown) {
      console.error('❌ Step 2 FAILED:', error instanceof Error ? error.message : String(error));
      stats.errors.push(`TD scoring: ${error instanceof Error ? error.message : String(error)}`);
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
      
    } catch (error: unknown) {
      console.error('⚠️  Step 6 failed (non-critical):', error instanceof Error ? error.message : String(error));
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
    
  } catch (fatalError: unknown) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ FATAL ERROR - JOB ABORTED');
    console.error('='.repeat(80));
    console.error(fatalError);
    stats.errors.push(`Fatal: ${fatalError instanceof Error ? fatalError.message : String(fatalError)}`);
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

function parseCliOptions(args: string[]): { lookbackHours?: number } {
  const options: { lookbackHours?: number } = {};
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
    }
  }
  return options;
}

