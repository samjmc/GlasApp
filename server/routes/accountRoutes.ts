import { Router } from 'express';
import { isAuthenticated, supabaseAdmin } from '../auth/supabaseAuth';
import { supabaseDb } from '../db';

const router = Router();

const deletionPlan: Array<{ table: string; column: string; value?: string }> = [
  { table: 'idea_votes', column: 'user_id' },
  { table: 'problem_votes', column: 'user_id' },
  { table: 'solution_votes', column: 'user_id' },
  { table: 'user_td_ratings', column: 'user_id' },
  { table: 'party_sentiment_votes', column: 'user_id' },
  { table: 'user_category_rankings', column: 'user_id' },
  { table: 'user_category_votes', column: 'user_id' },
  { table: 'user_pledge_votes', column: 'user_id' },
  { table: 'user_td_policy_agreements', column: 'user_id' },
  { table: 'user_personal_rankings', column: 'user_id' },
  { table: 'user_quiz_results', column: 'user_id' },
  { table: 'quiz_results_history', column: 'user_id' },
  { table: 'quiz_results', column: 'user_id' },
  { table: 'political_evolution', column: 'user_id' },
  { table: 'engagement_points', column: 'user_id' },
  { table: 'activity_logs', column: 'user_id' },
  { table: 'user_locations', column: 'firebase_uid' },
  { table: 'ideas', column: 'user_id' },
  { table: 'solutions', column: 'user_id' },
  { table: 'problems', column: 'user_id' },
];

router.delete('/', isAuthenticated, async (req, res) => {
  try {
    if (!supabaseDb) {
      return res.status(500).json({
        success: false,
        message: 'Supabase client not configured on server. Cannot delete account.',
      });
    }

    const userId: string | undefined =
      req.user?.id || req.user?.user?.id || req.user?.sub || req.user?.claims?.sub;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Unable to determine user ID from session.',
      });
    }

    const deletionErrors: Array<{ table: string; error: string }> = [];

    for (const step of deletionPlan) {
      const columnValue = step.value ?? userId;
      const { error } = await supabaseDb.from(step.table).delete().eq(step.column, columnValue);
      if (error) {
        deletionErrors.push({ table: step.table, error: error.message });
      }
    }

    const { error: userTableError } = await supabaseDb.from('users').delete().eq('id', userId);
    if (userTableError) {
      deletionErrors.push({ table: 'users', error: userTableError.message });
    }

    let authDeletionError: string | null = null;
    try {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch (error: any) {
      authDeletionError = error?.message || 'Unknown Supabase Auth deletion error';
    }

    if (authDeletionError) {
      return res.status(500).json({
        success: false,
        message: 'Partial deletion completed, but failed to remove Supabase Auth account.',
        errors: [...deletionErrors, { table: 'supabase_auth.users', error: authDeletionError }],
      });
    }

    if (deletionErrors.length > 0) {
      return res.status(207).json({
        success: true,
        message:
          'Account deletion completed with warnings. Some ancillary data may require manual review.',
        errors: deletionErrors,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Account and associated data deleted successfully.',
    });
  } catch (error: any) {
    console.error('Account deletion failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete account. Please try again or contact support.',
      error: error?.message,
    });
  }
});

export default router;

