import { requireAuth } from '../auth';
import { deleteAuthUser } from '../auth/supabase';
import { Router } from 'express';
import { deleteUserData } from '../account/deleteUserData';
import { formatError, formatSuccess } from '../utils/responseFormatters';

const router = Router();

/**
 * DELETE /api/account — erase the caller's GlasApp data, then their sign-in.
 * Data goes first, in one transaction: if it fails, the sign-in is kept so the user can
 * sign back in and try again, rather than being left with data they can no longer reach.
 */
router.delete('/', requireAuth, async (req, res) => {
  const userId = req.user!.id;

  let deleted;
  try {
    deleted = await deleteUserData(userId);
  } catch (error) {
    console.error('Account data deletion failed:', error);
    return res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to delete your data. Nothing was deleted; please try again.'));
  }

  try {
    await deleteAuthUser(userId);
  } catch (error) {
    console.error('Auth user deletion failed:', error);
    return res
      .status(500)
      .json(formatError('INTERNAL_ERROR', 'Your data was deleted, but your sign-in could not be removed. Please try again or contact privacy@glaspolitics.ie.'));
  }

  return res.json(formatSuccess({ deleted }));
});

export default router;
