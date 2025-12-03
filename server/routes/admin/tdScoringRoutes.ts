/**
 * TD Scoring Admin Routes
 * 
 * Endpoints for cronjob.org to trigger:
 * - Article triage (Layer 2) - runs every 15 mins
 * - TD scoring (Layers 3-4) - runs hourly
 * 
 * These are designed to be called by cronjob.org via HTTP POST.
 */

import { Router } from 'express';
import { ArticleTriageJob } from '../../jobs/articleTriageJob.js';
import { NewsToTDScoringService } from '../../services/newsToTDScoringService.js';

const router = Router();

/**
 * POST /api/admin/td-scoring/triage
 * 
 * Layer 2: Quick importance triage (runs every 15 minutes)
 * - Scores article importance
 * - Sets visible: true for all
 * - Marks top 25% for full scoring
 * 
 * Cost: ~$0.0005 per article
 */
router.post('/triage', async (req, res, next) => {
  try {
    console.log('📋 Article triage job triggered via API...');
    
    const options = {
      batchSize: req.body.batchSize || 30,
      topPercentile: req.body.topPercentile || 25,
      minImportanceForScoring: req.body.minImportance || 40
    };
    
    const stats = await ArticleTriageJob.run(options);
    
    res.json({
      success: true,
      message: 'Article triage completed',
      stats
    });
    
  } catch (error: any) {
    console.error('❌ Triage job failed:', error);
    next(error);
  }
});

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
    
    const stats = await NewsToTDScoringService.processUnprocessedArticles(options);
    
    res.json({
      success: true,
      message: 'TD scoring completed',
      stats
    });
    
  } catch (error: any) {
    console.error('❌ TD scoring job failed:', error);
    next(error);
  }
});

/**
 * GET /api/admin/td-scoring/status
 * 
 * Health check endpoint - shows pending articles
 */
router.get('/status', async (req, res, next) => {
  try {
    const status = await ArticleTriageJob.getStatus();
    
    res.json({
      success: true,
      status: {
        pendingTriage: status.pendingTriage,
        pendingScoring: status.pendingScoring,
        message: status.pendingTriage === 0 && status.pendingScoring === 0
          ? 'All caught up!'
          : `${status.pendingTriage} articles awaiting triage, ${status.pendingScoring} awaiting scoring`
      }
    });
    
  } catch (error: any) {
    console.error('❌ Status check failed:', error);
    next(error);
  }
});

/**
 * POST /api/admin/td-scoring/full-pipeline
 * 
 * Run the full pipeline in sequence:
 * 1. Triage (set visibility)
 * 2. Event deduplication + scoring
 * 
 * Useful for manual testing or catch-up processing.
 */
router.post('/full-pipeline', async (req, res, next) => {
  try {
    console.log('🚀 Full TD scoring pipeline triggered via API...');
    
    // Step 1: Triage
    console.log('\n📋 Step 1: Running article triage...');
    const triageStats = await ArticleTriageJob.run({
      batchSize: req.body.batchSize || 50,
      topPercentile: req.body.topPercentile || 25,
      minImportanceForScoring: req.body.minImportance || 40
    });
    
    // Step 2: Scoring
    console.log('\n🎯 Step 2: Running TD scoring...');
    const scoringStats = await NewsToTDScoringService.processUnprocessedArticles({
      batchSize: req.body.batchSize || 50,
      topPercentile: req.body.topPercentile || 25,
      minImportanceScore: req.body.minImportance || 40
    });
    
    res.json({
      success: true,
      message: 'Full pipeline completed',
      triage: triageStats,
      scoring: scoringStats
    });
    
  } catch (error: any) {
    console.error('❌ Full pipeline failed:', error);
    next(error);
  }
});

export default router;

