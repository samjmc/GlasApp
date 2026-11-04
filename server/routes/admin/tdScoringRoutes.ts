/**
 * News → TD pipeline admin routes. The URLs keep their old `td-scoring` name because an
 * external cron (cronjob.org) may call them; the pipeline no longer scores anyone.
 *
 * - POST /run            link new articles to the TDs they name, make daily-vote questions
 * - GET  /status         article counts by pipeline status
 * - POST /full-pipeline  ingest, then /run
 *
 * The body is optional: { batchSize 1..100, topPercentile 1..50 }. A run is synchronous in the
 * request and every article in it may cost model calls, so both are capped.
 */

import { Router } from 'express';
import { z } from 'zod';
import { ingest } from '../../news/ingest.js';
import { statusCounts } from '../../news/repository.js';
import { runTdPipeline } from '../../news/tdPipeline.js';
import { formatError } from '../../utils/responseFormatters';

const router = Router();

/** Numbers may arrive as strings from a cron service's form; other fields (the old minImportance) are ignored. */
export const pipelineBody = z.object({
  batchSize: z.coerce.number().int().min(1).max(100).default(50),
  topPercentile: z.coerce.number().int().min(1).max(50).default(25),
});

/** The pipeline options from the request body, or null when it is out of range. */
function pipelineOptions(body: unknown): z.infer<typeof pipelineBody> | null {
  const parsed = pipelineBody.safeParse(body ?? {});
  return parsed.success ? parsed.data : null;
}

const BAD_BODY = formatError('VALIDATION_ERROR', 'Body must be { batchSize?: 1..100, topPercentile?: 1..50 }');

/** POST /api/admin/td-scoring/run */
router.post('/run', async (req, res, next) => {
  try {
    const options = pipelineOptions(req.body);
    if (!options) return res.status(400).json(BAD_BODY);
    console.log('News → TD pipeline triggered via API...');
    const stats = await runTdPipeline(options);
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
    const options = pipelineOptions(req.body);
    if (!options) return res.status(400).json(BAD_BODY);
    console.log('Full news pipeline triggered via API...');
    const ingestStats = await ingest();
    const scoringStats = await runTdPipeline(options);
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
