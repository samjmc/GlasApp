/**
 * /api/consent — the signed-in user's consent to store their political opinions.
 * `{ success, data }` envelope throughout.
 *
 *   GET    /   { granted, version, grantedAt }
 *   POST   /   { version }   give consent to the current text
 *   DELETE /                 withdraw it, deleting the political data it covered
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth';
import { asyncHandler } from '../middleware/errorHandler';
import { formatError, formatSuccess } from '../utils/responseFormatters';
import { ConsentVersionError, consentStatus, grantConsent, withdrawConsent } from './index';

const grantBody = z.object({ version: z.string().min(1).max(32) });

export const consentRouter = Router();

consentRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(formatSuccess(await consentStatus(req.user!.id)));
  }),
);

consentRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = grantBody.safeParse(req.body);
    if (!body.success) return res.status(400).json(formatError('VALIDATION_ERROR', 'Invalid consent'));
    try {
      res.json(formatSuccess(await grantConsent(req.user!.id, body.data.version)));
    } catch (error) {
      if (error instanceof ConsentVersionError) return res.status(409).json(formatError('CONFLICT', error.message));
      throw error;
    }
  }),
);

consentRouter.delete(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(formatSuccess({ deleted: await withdrawConsent(req.user!.id) }));
  }),
);
