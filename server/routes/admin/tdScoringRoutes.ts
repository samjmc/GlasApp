/**
 * TD Scoring Admin Routes
 *
 * Endpoints for cronjob.org to trigger:
 * - TD scoring (Layers 3-4) - runs hourly
 * - Ingest + scoring in one call (full-pipeline)
 *
 * These are designed to be called by cronjob.org via HTTP POST.
 */

import { Router } from 'express';
import { ingest } from '../../news/ingest.js';
import { statusCounts } from '../../news/repository.js';
import { runPipeline } from '../../scoring/index.js';

const router = Router();

/**
 * POST /api/admin/td-scoring/run
 * 
 * Layers 3-4: Full TD scoring (runs hourly)
 * - Event deduplication (clusters same-story articles)
 * - Multi-agent scoring (6 agents per unique event)
 * - Updates TD ELO scores and ideology profiles
 * - Generates policy vote opportunities
 * 
 * Cost: ~$0.05-0.10 per unique event
 */
router.post('/run', async (req, res, next) => {
  try {
    console.log('🎯 TD scoring job triggered via API...');
    
    const options = {
      batchSize: req.body.batchSize || 50,
      topPercentile: req.body.topPercentile || 25,
      minImportanceScore: req.body.minImportance || 40
    };
    
    const stats = await runPipeline(options);

    res.json({
      success: true,
      message: 'TD scoring completed',
      stats
    });
    
  } catch (error: unknown) {
    console.error('❌ TD scoring job failed:', error);
    next(error);
  }
});

/**
 * GET /api/admin/td-scoring/status
 * 
 * Health check endpoint - article counts by pipeline status
 */
router.get('/status', async (req, res, next) => {
  try {
    const counts = await statusCounts();

    res.json({
      success: true,
      status: {
        ...counts,
        message: counts.pending === 0 && counts.claimed === 0
          ? 'All caught up!'
          : `${counts.pending} articles awaiting scoring, ${counts.claimed} being scored`
      }
    });
    
  } catch (error: unknown) {
    console.error('❌ Status check failed:', error);
    next(error);
  }
});

/**
 * POST /api/admin/td-scoring/full-pipeline
 * 
 * Run the full pipeline in sequence:
 * 1. Ingest (fetch and store new articles)
 * 2. Scoring
 *
 * Useful for manual testing or catch-up processing.
 */
router.post('/full-pipeline', async (req, res, next) => {
  try {
    console.log('🚀 Full TD scoring pipeline triggered via API...');

    // Step 1: Ingest
    console.log('\n📰 Step 1: Running news ingest...');
    const ingestStats = await ingest();

    // Step 2: Scoring
    console.log('\n🎯 Step 2: Running TD scoring...');
    const scoringStats = await runPipeline({
      batchSize: req.body.batchSize || 50,
      topPercentile: req.body.topPercentile || 25,
      minImportanceScore: req.body.minImportance || 40
    });
    
    res.json({
      success: true,
      message: 'Full pipeline completed',
      ingest: ingestStats,
      scoring: scoringStats
    });
    
  } catch (error: unknown) {
    console.error('❌ Full pipeline failed:', error);
    next(error);
  }
});

export default router;

