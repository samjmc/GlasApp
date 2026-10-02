/**
 * News → TD pipeline admin routes. The URLs keep their old `td-scoring` name because an
 * external cron (cronjob.org) may call them; the pipeline no longer scores anyone.
 *
 * - POST /run            link new articles to the TDs they name, make daily-vote questions
 * - GET  /status         article counts by pipeline status
 * - POST /full-pipeline  ingest, then /run
 */

import { Router } from 'express';
import { ingest } from '../../news/ingest.js';
import { statusCounts } from '../../news/repository.js';
import { runTdPipeline } from '../../news/tdPipeline.js';

const router = Router();

function pipelineOptions(body: { batchSize?: number; topPercentile?: number; minImportance?: number }) {
  return {
    batchSize: body.batchSize || 50,
    topPercentile: body.topPercentile || 25,
    minImportanceScore: body.minImportance || 40,
  };
}

/** POST /api/admin/td-scoring/run */
router.post('/run', async (req, res, next) => {
  try {
    console.log('News → TD pipeline triggered via API...');
    const stats = await runTdPipeline(pipelineOptions(req.body));
    res.json({ success: true, message: 'News → TD pipeline completed', stats });
  } catch (error: unknown) {
    console.error('News → TD pipeline failed:', error);
    next(error);
  }
});

/** GET /api/admin/td-scoring/status: article counts by pipeline status. */
router.get('/status', async (req, res, next) => {
  try {
    const counts = await statusCounts();
    res.json({
      success: true,
      status: {
        ...counts,
        message: counts.pending === 0 && counts.claimed === 0
          ? 'All caught up!'
          : `${counts.pending} articles waiting, ${counts.claimed} being processed`
      }
    });
  } catch (error: unknown) {
    console.error('Status check failed:', error);
    next(error);
  }
});

/** POST /api/admin/td-scoring/full-pipeline: ingest, then the news → TD pipeline. */
router.post('/full-pipeline', async (req, res, next) => {
  try {
    console.log('Full news pipeline triggered via API...');
    const ingestStats = await ingest();
    const scoringStats = await runTdPipeline(pipelineOptions(req.body));
    res.json({
      success: true,
      message: 'Full pipeline completed',
      ingest: ingestStats,
      scoring: scoringStats
    });
  } catch (error: unknown) {
    console.error('Full pipeline failed:', error);
    next(error);
  }
});

export default router;
