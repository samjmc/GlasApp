/**
 * Hourly TD Scoring Job (v2 - Multi-Agent)
 * 
 * Processes news articles and updates TD scores using:
 * 1. Importance filtering (top 25% of articles)
 * 2. Multi-agent scoring team
 * 
 * Usage:
 * - Manual: npx tsx server/jobs/hourlyTDScoring.ts
 * - Scheduled: Run via cron/Task Scheduler
 */

import 'dotenv/config';
import { NewsToTDScoringService } from '../services/newsToTDScoringService.js';
import { shutdown } from '../db.js';

// Configuration
const CONFIG = {
  batchSize: 50,           // Max articles to fetch per run
  topPercentile: 25,       // Only score top 25% most important articles
  minImportanceScore: 40   // Minimum importance score to be considered
};

/**
 * Run the TD scoring process
 */
async function runTDScoring() {
  const startTime = Date.now();
  
  console.log(`\n${'█'.repeat(70)}`);
  console.log(`█  HOURLY TD SCORING JOB (v2 - Multi-Agent)`);
  console.log(`█  Started: ${new Date().toLocaleString()}`);
  console.log(`${'█'.repeat(70)}`);
  console.log(`\n📋 Configuration:`);
  console.log(`   • Batch Size: ${CONFIG.batchSize}`);
  console.log(`   • Top Percentile: ${CONFIG.topPercentile}%`);
  console.log(`   • Min Importance: ${CONFIG.minImportanceScore}`);
  console.log(`   • Scoring: Multi-Agent Team (6-8 LLM calls per article)`);
  
  try {
    // Process unprocessed articles with importance filtering + multi-agent
    const stats = await NewsToTDScoringService.processUnprocessedArticles({
      batchSize: CONFIG.batchSize,
      topPercentile: CONFIG.topPercentile,
      minImportanceScore: CONFIG.minImportanceScore
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\n${'█'.repeat(70)}`);
    console.log(`█  JOB COMPLETE`);
    console.log(`█  Duration: ${duration}s`);
    console.log(`█`);
    console.log(`█  Summary:`);
    console.log(`█  • Total Articles Seen: ${stats.totalArticles}`);
    console.log(`█  • Selected for Scoring (top ${CONFIG.topPercentile}%): ${stats.selectedForScoring}`);
    console.log(`█  • Skipped (low importance): ${stats.skippedLowImportance}`);
    console.log(`█  • Successfully Scored: ${stats.articlesProcessed}`);
    console.log(`█  • TDs Updated: ${stats.tdsUpdated}`);
    console.log(`█  • Errors: ${stats.errors}`);
    console.log(`${'█'.repeat(70)}\n`);
    
    // Cleanup database connections before exit (Windows fix)
    await shutdown();
    
    // Small delay to ensure cleanup completes on Windows
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Exit with appropriate code
    if (stats.errors > 0) {
      console.warn(`⚠️  Completed with ${stats.errors} errors`);
      process.exit(1);
    } else {
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    
    // Cleanup even on error
    await shutdown();
    await new Promise(resolve => setTimeout(resolve, 200));
    
    process.exit(1);
  }
}

// Always run when this file is executed
runTDScoring();

export { runTDScoring };

