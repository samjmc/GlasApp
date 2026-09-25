/**
 * /api/admin/news — run ingest, add one article by URL (`force` to add an event already shown), see pipeline state.
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireJob } from '../../auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { addUrl, ingest } from '../../news/ingest';
import * as repo from '../../news/repository';
import { formatError, formatSuccess } from '../../utils/responseFormatters';

const router = Router();
router.use(requireJob);

router.post(
  '/ingest',
  asyncHandler(async (_req, res) => {
    res.json(formatSuccess(await ingest()));
  }),
);

const addBody = z.object({ url: z.string().url(), force: z.boolean().optional() });

router.post(
  '/articles',
  asyncHandler(async (req, res) => {
    const body = addBody.safeParse(req.body);
    if (!body.success) return res.status(400).json(formatError('VALIDATION_ERROR', 'Body must be { url, force? }'));
    const result = await addUrl(body.data.url, { force: body.data.force });
    if (!result.ok) {
      if (result.reason === 'same event') return res.status(409).json(formatError('OPERATION_FAILED', `Same event as article #${result.of}`));
      const status = result.reason === 'already stored' ? 409 : 422;
      return res.status(status).json(formatError('OPERATION_FAILED', result.reason));
    }
    res.status(201).json(formatSuccess({ id: result.id }));
  }),
);

router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json(formatSuccess(await repo.statusCounts()));
  }),
);

export default router;
