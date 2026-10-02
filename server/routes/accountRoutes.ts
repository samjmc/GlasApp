import { requireAuth } from '../auth';
import { deleteAuthUser } from '../auth/supabase';
import { Router } from 'express';
import { deleteUserData } from '../account/deleteUserData';
import { removeProfileImages } from '../account/profileImages';
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

export default router;
