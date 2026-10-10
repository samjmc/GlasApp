import { requireAuth } from '../auth';
import { deleteAuthUser } from '../auth/supabase';
import { Router } from 'express';
import { z } from 'zod';
import { POLITICAL_CONSENT_VERSION } from '@shared/consent';
import { grantPoliticalConsent, withdrawPoliticalConsent } from '../account/consent';
import { deleteUserData } from '../account/deleteUserData';
import { exportUserData } from '../account/exportUserData';
import { removeProfileImages } from '../account/profileImages';
import { exportRateLimit } from '../middleware/rateLimit';
import { formatError, formatSuccess } from '../utils/responseFormatters';
import { requestLogger } from '../utils/logger';

const router = Router();

/**
 * DELETE /api/account — erase the caller's GlasApp data, then their sign-in.
 * Data goes first, in one transaction: if it fails, the sign-in is kept so the user can
 * sign back in and try again, rather than being left with data they can no longer reach.
 * Their profile pictures are personal data too, so they go before the sign-in.
 */
router.delete('/', requireAuth, async (req, res) => {
  const log = requestLogger(req);
  const userId = req.user!.id;

  let deleted;
  try {
    deleted = await deleteUserData(userId);
    await removeProfileImages(userId);
  } catch (error) {
    log.error({ err: error }, 'Account data deletion failed');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to delete your data. Please try again.'));
  }

  try {
    await deleteAuthUser(userId);
  } catch (error) {
    log.error({ err: error }, 'Auth user deletion failed');
    return res
      .status(500)
      .json(formatError('INTERNAL_ERROR', 'Your data was deleted, but your sign-in could not be removed. Please try again or contact privacy@glaspolitics.ie.'));
  }

  return res.json(formatSuccess({ deleted }));
});

/**
 * GET /api/account/export — a copy of everything GlasApp holds about the caller (GDPR Art. 15 and
 * 20), as the `{ success, data }` envelope; the page saves `data` as a JSON file. Never cached.
 */
router.get('/export', requireAuth, exportRateLimit, async (req, res) => {
  try {
    const data = await exportUserData(req.user!.id, { email: req.user!.email });
    res.setHeader('Cache-Control', 'no-store');
    return res.json(formatSuccess(data));
  } catch (error) {
    requestLogger(req).error({ err: error }, 'Data export failed');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Could not prepare your data. Please try again.'));
  }
});

/**
 * PUT /api/account/consent/political — agree to us keeping the user's political opinions
 * (GDPR Art. 9(2)(a)). The client names the wording it showed; only the current one is accepted,
 * so a stale page cannot record agreement to text the user never saw.
 */
router.put('/consent/political', requireAuth, async (req, res) => {
  const body = z.object({ version: z.number().int() }).safeParse(req.body);
  if (!body.success) return res.status(400).json(formatError('VALIDATION_ERROR', 'Say which wording you are agreeing to'));
  if (body.data.version !== POLITICAL_CONSENT_VERSION) {
    return res.status(409).json(formatError('CONFLICT', 'The wording has changed. Reload the page and read it again.'));
  }
  try {
    await grantPoliticalConsent(req.user!.id);
    return res.json(formatSuccess({ version: POLITICAL_CONSENT_VERSION }));
  } catch (error) {
    requestLogger(req).error({ err: error }, 'Recording consent failed');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Could not record your choice. Please try again.'));
  }
});

/** DELETE /api/account/consent/political — withdraw consent and erase the political data, keeping the account. */
router.delete('/consent/political', requireAuth, async (req, res) => {
  try {
    return res.json(formatSuccess({ erased: await withdrawPoliticalConsent(req.user!.id) }));
  } catch (error) {
    requestLogger(req).error({ err: error }, 'Withdrawing consent failed');
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Could not withdraw consent. Please try again.'));
  }
});

export default router;
