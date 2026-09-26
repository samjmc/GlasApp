/**
 * /api/stances — what TDs said in the news, with the quote and the link. Public. Every
 * response is `{ success, data }` via formatSuccess; the shapes are in shared/stancesApi.ts.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler';
import { formatError, formatSuccess } from '../utils/responseFormatters';
import { stancesForTd, tdExists } from './repository';
import { groupTdStances } from './view';

export const stancesRouter = Router();

/** GET /api/stances/td/:id — the TD's stances grouped by policy domain, newest first. */
stancesRouter.get(
  '/td/:id',
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) return res.status(400).json(formatError('VALIDATION_ERROR', 'Invalid TD id'));
    const [exists, rows] = await Promise.all([tdExists(id.data), stancesForTd(id.data)]);
    if (!exists) return res.status(404).json(formatError('NOT_FOUND', 'TD not found'));
    res.json(formatSuccess(groupTdStances(id.data, rows)));
  }),
);
