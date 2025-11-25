/**
 * Hourly TD Scoring Job
 * Processes news articles and updates TD scores every hour
 * 
 * Usage:
 * - Manual: npx tsx server/jobs/hourlyTDScoring.ts
 * - Scheduled: Run via cron/Task Scheduler
 */

import 'dotenv/config';
import { NewsToTDScoringService } from '../services/newsToTDScoringService.js';
import { shutdown } from '../db.js';

/**
 * Run the TD scoring process
 */
async function runTDScoring() {
  const startTime = Date.now();
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🕐 HOURLY TD SCORING JOB`);
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log(`${'='.repeat(70)}\n`);
  
  try {
    // Process unprocessed articles
    // crossCheck: false for speed (only use for high-impact stories)
    const stats = await NewsToTDScoringService.processUnprocessedArticles({
      batchSize: 50,
      crossCheck: false  // Set to true if you want GPT-4 cross-checking
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`✅ JOB COMPLETE`);
    console.log(`Duration: ${duration}s`);
    console.log(`${'='.repeat(70)}\n`);
    
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

