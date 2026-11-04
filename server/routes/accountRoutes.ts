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
import { AppError } from '../utils/errors';
import { formatError, formatSuccess } from '../utils/responseFormatters';

const router = Router();

/**
 * DELETE /api/account — erase the caller's GlasApp data, then their sign-in.
 * Data goes first, in one transaction: if it fails, the sign-in is kept so the user can
 * sign back in and try again, rather than being left with data they can no longer reach.
 * Their profile pictures are personal data too, so they go before the sign-in.
 */
router.delete('/', requireAuth, async (req, res) => {
  const userId = req.user!.id;

  // A failure here is a plain 500 from the error handler: nothing was deleted that the user cannot retry.
  const deleted = await deleteUserData(userId);
  await removeProfileImages(userId);

  try {
    await deleteAuthUser(userId);
  } catch (error) {
    // The data is gone and the sign-in is not, so say exactly that rather than "something went wrong".
    throw new AppError(
      500,
      'INTERNAL_ERROR',
      'Your data was deleted, but your sign-in could not be removed. Please try again or contact privacy@glaspolitics.ie.',
      { cause: error },
    );
  }

  res.json(formatSuccess({ deleted }));
});

/**
 * GET /api/account/export — a copy of everything GlasApp holds about the caller (GDPR Art. 15 and
 * 20), as the `{ success, data }` envelope; the page saves `data` as a JSON file. Never cached.
 */
router.get('/export', requireAuth, exportRateLimit, async (req, res) => {
  const data = await exportUserData(req.user!.id, { email: req.user!.email, userMetadata: req.user!.userMetadata });
  res.setHeader('Cache-Control', 'no-store');
  res.json(formatSuccess(data));
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
  await grantPoliticalConsent(req.user!.id);
  res.json(formatSuccess({ version: POLITICAL_CONSENT_VERSION }));
});

/** DELETE /api/account/consent/political — withdraw consent and erase the political data, keeping the account. */
router.delete('/consent/political', requireAuth, async (req, res) => {
  res.json(formatSuccess({ erased: await withdrawPoliticalConsent(req.user!.id) }));
});

export default router;
