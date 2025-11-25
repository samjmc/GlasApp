/**
 * Policy Voting Routes
 * Allows users to vote on policies mentioned in news articles
 */

import express from 'express';
import { supabaseDb as supabase } from '../db.js';
import { PersonalizedScoringService } from '../services/personalizedScoringService.js';
import { UserIdeologyProfileService } from '../services/userIdeologyProfileService.js';
import { PersonalRankingsService } from '../services/personalRankingsService.js';
import { formatRankingsResponse, formatUserProfilePayload } from './personalRankingsRoutes.js';
import { isAuthenticated, optionalAuth } from '../auth/supabaseAuth.js';

const router = express.Router();

async function buildRealtimeUpdate(userId: string) {
  const profile = await PersonalRankingsService.getUserProfile(userId);
  const topMatchesRaw = await PersonalRankingsService.getPersonalRankings(userId, 5);

  return {
    updatedProfile: formatUserProfilePayload(profile),
    topMatches: formatRankingsResponse(topMatchesRaw),
  };
}

/**
 * GET /api/policy-votes/article/:articleId
 * Get vote statistics for a specific article
 */
router.get('/article/:articleId', async (req, res) => {
  try {
    const { articleId } = req.params;
    
    // Get vote statistics from view
    const { data: stats, error } = await supabase
      .from('article_vote_stats')
      .select('*')
      .eq('article_id', parseInt(articleId));
    
    if (error) throw error;

    res.json({
      success: true,
      stats: stats || []
    });
    
  } catch (error: any) {
    console.error('Error fetching article vote stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/policy-votes/opportunity/:policyVoteId
 * Fetch a single policy vote opportunity with aggregated option stats
 */
router.get('/opportunity/:policyVoteId', async (req, res) => {
  try {
    const policyVoteId = parseInt(req.params.policyVoteId, 10);
    if (Number.isNaN(policyVoteId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid policy vote ID'
      });
    }

    const { data: opportunity, error: opportunityError } = await supabase
      .from('policy_vote_opportunities')
      .select('id, article_id, policy_domain, policy_topic, question_text, answer_options, confidence, rationale, source_hint')
      .eq('id', policyVoteId)
      .single();

    if (opportunityError) throw opportunityError;
    if (!opportunity) {
      return res.status(404).json({
        success: false,
        error: 'Policy vote opportunity not found'
      });
    }

    const { data: stats, error: statsError } = await supabase
      .from('policy_vote_option_stats')
      .select('*')
      .eq('policy_vote_id', policyVoteId);

    if (statsError) throw statsError;

    res.json({
      success: true,
      opportunity,
      stats: stats || []
    });
  } catch (error: any) {
    console.error('Error fetching policy vote opportunity:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/policy-votes/opportunity/:policyVoteId/user
 * Get the authenticated user's response for a policy vote opportunity
 */
router.get('/opportunity/:policyVoteId/user', isAuthenticated, async (req, res) => {
  try {
    const policyVoteId = parseInt(req.params.policyVoteId, 10);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (Number.isNaN(policyVoteId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid policy vote ID'
      });
    }

    const { data: response, error } = await supabase
      .from('user_policy_vote_responses')
      .select('*')
      .eq('policy_vote_id', policyVoteId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    res.json({
      success: true,
      response
    });
  } catch (error: any) {
    console.error('Error fetching user policy vote response:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/policy-votes/user/me/article/:articleId
 * Get current user's vote on a specific article (protected)
 */
router.get('/user/me/article/:articleId', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { articleId } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found'
      });
    }
    
    const { data: votes, error } = await supabase
      .from('user_policy_votes')
      .select('*')
      .eq('user_id', userId)
      .eq('article_id', parseInt(articleId));
    
    if (error) throw error;
    
    res.json({
      success: true,
      votes: votes || []
    });
    
  } catch (error: any) {
    console.error('Error fetching user vote:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/policy-votes/user/:userId/article/:articleId
 * Get user's vote on a specific article (legacy - kept for backward compatibility)
 */
router.get('/user/:userId/article/:articleId', async (req, res) => {
  try {
    const { userId, articleId } = req.params;
    
    const { data: votes, error } = await supabase
      .from('user_policy_votes')
      .select('*')
      .eq('user_id', userId)
      .eq('article_id', parseInt(articleId));
    
    if (error) throw error;
    
    res.json({
      success: true,
      votes: votes || []
    });
    
  } catch (error: any) {
    console.error('Error fetching user vote:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/policy-votes/opportunity/:policyVoteId/respond
 * Submit or update the authenticated user's answer for a policy vote opportunity
 */
router.post('/opportunity/:policyVoteId/respond', isAuthenticated, async (req, res) => {
  try {
    const policyVoteId = parseInt(req.params.policyVoteId, 10);
    const userId = req.user?.id;
    const { selectedOption } = req.body ?? {};

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (Number.isNaN(policyVoteId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid policy vote ID'
      });
    }

    if (!selectedOption || typeof selectedOption !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'selectedOption is required'
      });
    }

    const { data: opportunity, error: opportunityError } = await supabase
      .from('policy_vote_opportunities')
      .select('id, article_id, answer_options')
      .eq('id', policyVoteId)
      .single();

    if (opportunityError) throw opportunityError;
    if (!opportunity) {
      return res.status(404).json({
        success: false,
        error: 'Policy vote opportunity not found'
      });
    }

    const options = opportunity.answer_options || {};
    if (!Object.prototype.hasOwnProperty.call(options, selectedOption)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid option key'
      });
    }

    const nowIso = new Date().toISOString();

    const { data: saved, error } = await supabase
      .from('user_policy_vote_responses')
      .upsert(
        {
          user_id: userId,
          policy_vote_id: policyVoteId,
          article_id: opportunity.article_id,
          selected_option: selectedOption,
          updated_at: nowIso
        },
        { onConflict: 'user_id,policy_vote_id' }
      )
      .select('*')
      .single();

    if (error) throw error;

    await UserIdeologyProfileService.recomputeUserProfile(userId);
    await PersonalRankingsService.recalculatePersonalRankings(userId);
    const realtime = await buildRealtimeUpdate(userId);

    res.json({
      success: true,
      response: saved,
      ...realtime,
    });
  } catch (error: any) {
    console.error('Error saving policy vote response:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/policy-votes
 * Submit or update a policy vote (protected)
 */
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { articleId, politicianName, supportRating, comment } = req.body;
    
    // Validate user
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    // Validate input
    if (!articleId || !politicianName || !supportRating) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    if (supportRating < 1 || supportRating > 5) {
      return res.status(400).json({
        success: false,
        error: 'support_rating must be between 1 and 5'
      });
    }
    
    // Check if user already voted on this article for this TD
    const { data: existing, error: checkError } = await supabase
      .from('user_policy_votes')
      .select('id')
      .eq('user_id', userId)
      .eq('article_id', articleId)
      .eq('politician_name', politicianName)
      .single();
    
    let result;
    
    if (existing) {
      // Update existing vote
      result = await supabase
        .from('user_policy_votes')
        .update({
          support_rating: supportRating,
          comment: comment || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert new vote
      result = await supabase
        .from('user_policy_votes')
        .insert({
          user_id: userId,
          article_id: articleId,
          politician_name: politicianName,
          support_rating: supportRating,
          comment: comment || null
        })
        .select()
        .single();
    }
    
    if (result.error) throw result.error;

    await PersonalRankingsService.updatePolicyAgreementFromVote(userId, Number(articleId), Number(supportRating));
    const realtime = await buildRealtimeUpdate(userId);
    
    res.json({
      success: true,
      vote: result.data,
      message: existing ? 'Vote updated' : 'Vote recorded',
      ...realtime,
    });
    
  } catch (error: any) {
    console.error('Error saving policy vote:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/policy-votes/user/:userId/personalized-scores
 * Get personalized TD scores for a user based on their votes
 */
router.get('/user/:userId/personalized-scores', async (req, res) => {
  try {
    const { userId } = req.params;
    const { constituency, party, limit } = req.query;
    
    const scores = await PersonalizedScoringService.getPersonalizedRankings(userId, {
      constituency: constituency as string,
      party: party as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({
      success: true,
      scores
    });
    
  } catch (error: any) {
    console.error('Error calculating personalized scores:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/policy-votes/user/:userId/td/:politicianName
 * Get single TD's personalized score for a user
 */
router.get('/user/:userId/td/:politicianName', async (req, res) => {
  try {
    const { userId, politicianName } = req.params;
    
    const score = await PersonalizedScoringService.getTDPersonalizedScore(
      userId,
      decodeURIComponent(politicianName)
    );
    
    if (!score) {
      return res.status(404).json({
        success: false,
        error: 'TD not found'
      });
    }
    
    res.json({
      success: true,
      score
    });
    
  } catch (error: any) {
    console.error('Error fetching personalized TD score:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/policy-votes/user/:userId/value-alignment
 * Get user's overall value alignment (left vs right)
 */
router.get('/user/:userId/value-alignment', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const alignment = await PersonalizedScoringService.getUserValueAlignment(userId);
    
    res.json({
      success: true,
      alignment
    });
    
  } catch (error: any) {
    console.error('Error calculating value alignment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/policy-votes/:voteId
 * Delete a policy vote
 */
router.delete('/:voteId', async (req, res) => {
  try {
    const { voteId } = req.params;
    const { userId } = req.body;
    
    // Verify user owns this vote
    const { data: vote, error: checkError } = await supabase
      .from('user_policy_votes')
      .select('user_id')
      .eq('id', parseInt(voteId))
      .single();
    
    if (checkError) throw checkError;
    
    if (vote.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this vote'
      });
    }
    
    // Delete vote
    const { error: deleteError } = await supabase
      .from('user_policy_votes')
      .delete()
      .eq('id', parseInt(voteId));
    
    if (deleteError) throw deleteError;
    
    res.json({
      success: true,
      message: 'Vote deleted'
    });
    
  } catch (error: any) {
    console.error('Error deleting vote:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
