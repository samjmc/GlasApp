/**
 * Parliamentary Voting Routes
 * Handles policy voting and voting analysis data
 * Consolidated from policyVotingRoutes.ts
 */

import express from 'express';
import { supabaseDb as supabase } from '../../db.js';
import { PersonalizedScoringService } from '../../services/personalizedScoringService.js';
import { UserIdeologyProfileService } from '../../services/userIdeologyProfileService.js';
import { PersonalRankingsService } from '../../services/personalRankingsService.js';
import { formatRankingsResponse, formatUserProfilePayload } from '../personalRankingsRoutes.js';
import { isAuthenticated } from '../../auth/supabaseAuth.js';
import { asyncHandler } from '../../middleware/errorHandler';
import { formatSuccess, formatError, ErrorCodes } from '../../utils/responseFormatters';

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
 * GET /api/parliamentary/voting/article/:articleId - Get vote statistics for a specific article
 */
router.get('/article/:articleId', asyncHandler(async (req, res) => {
  const { articleId } = req.params;

  const { data: stats, error } = await supabase!
    .from('article_vote_stats')
    .select('*')
    .eq('article_id', parseInt(articleId));

  if (error) throw error;

  res.json(formatSuccess(stats || []));
}));

/**
 * GET /api/parliamentary/voting/opportunity/:policyVoteId - Fetch a single policy vote opportunity with aggregated option stats
 */
router.get('/opportunity/:policyVoteId', asyncHandler(async (req, res) => {
  const policyVoteId = parseInt(req.params.policyVoteId, 10);
  if (Number.isNaN(policyVoteId)) {
    return res.status(400).json(
      formatError('INVALID_INPUT', 'Invalid policy vote ID')
    );
  }

  const { data: opportunity, error: opportunityError } = await supabase!
    .from('policy_vote_opportunities')
    .select('id, article_id, policy_domain, policy_topic, question_text, answer_options, confidence, rationale, source_hint')
    .eq('id', policyVoteId)
    .single();

  if (opportunityError) throw opportunityError;
  if (!opportunity) {
    return res.status(404).json(
      formatError('ENTITY_NOT_FOUND', 'Policy vote opportunity not found')
    );
  }

  const { data: stats, error: statsError } = await supabase!
    .from('policy_vote_option_stats')
    .select('*')
    .eq('policy_vote_id', policyVoteId);

  if (statsError) throw statsError;

  res.json(formatSuccess({ opportunity, stats: stats || [] }));
}));

/**
 * GET /api/parliamentary/voting/opportunity/:policyVoteId/user - Get the authenticated user's response for a policy vote opportunity
 */
router.get('/opportunity/:policyVoteId/user', isAuthenticated, asyncHandler(async (req, res) => {
  const policyVoteId = parseInt(req.params.policyVoteId, 10);
  const userId = (req.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return res.status(401).json(
      formatError('UNAUTHORIZED', ErrorCodes.UNAUTHORIZED)
    );
  }

  if (Number.isNaN(policyVoteId)) {
    return res.status(400).json(
      formatError('INVALID_INPUT', 'Invalid policy vote ID')
    );
  }

  const { data: response, error } = await supabase!
    .from('user_policy_vote_responses')
    .select('*')
    .eq('policy_vote_id', policyVoteId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  res.json(formatSuccess(response));
}));

/**
 * GET /api/parliamentary/voting/user/me/article/:articleId - Get current user's vote on a specific article
 */
router.get('/user/me/article/:articleId', isAuthenticated, asyncHandler(async (req, res) => {
  const userId = (req.user as { id?: string } | undefined)?.id;
  const { articleId } = req.params;

  if (!userId) {
    return res.status(401).json(
      formatError('UNAUTHORIZED', ErrorCodes.UNAUTHORIZED)
    );
  }

  const { data: votes, error } = await supabase!
    .from('user_policy_votes')
    .select('*')
    .eq('user_id', userId)
    .eq('article_id', parseInt(articleId));

  if (error) throw error;

  res.json(formatSuccess(votes || []));
}));

/**
 * GET /api/parliamentary/voting/user/:userId/article/:articleId - Get user's vote on a specific article (legacy)
 */
router.get('/user/:userId/article/:articleId', asyncHandler(async (req, res) => {
  const { userId, articleId } = req.params;

  const { data: votes, error } = await supabase!
    .from('user_policy_votes')
    .select('*')
    .eq('user_id', userId)
    .eq('article_id', parseInt(articleId));

  if (error) throw error;

  res.json(formatSuccess(votes || []));
}));

/**
 * POST /api/parliamentary/voting/opportunity/:policyVoteId/respond - Submit or update the authenticated user's answer for a policy vote opportunity
 */
router.post('/opportunity/:policyVoteId/respond', isAuthenticated, asyncHandler(async (req, res) => {
  const policyVoteId = parseInt(req.params.policyVoteId, 10);
  const userId = (req.user as { id?: string } | undefined)?.id;
  const { selectedOption } = req.body ?? {};

  if (!userId) {
    return res.status(401).json(
      formatError('UNAUTHORIZED', ErrorCodes.UNAUTHORIZED)
    );
  }

  if (Number.isNaN(policyVoteId)) {
    return res.status(400).json(
      formatError('INVALID_INPUT', 'Invalid policy vote ID')
    );
  }

  if (!selectedOption || typeof selectedOption !== 'string') {
    return res.status(400).json(
      formatError('INVALID_INPUT', 'selectedOption is required')
    );
  }

  const { data: opportunity, error: opportunityError } = await supabase!
    .from('policy_vote_opportunities')
    .select('id, article_id, answer_options')
    .eq('id', policyVoteId)
    .single();

  if (opportunityError) throw opportunityError;
  if (!opportunity) {
    return res.status(404).json(
      formatError('ENTITY_NOT_FOUND', 'Policy vote opportunity not found')
    );
  }

  const options = opportunity.answer_options || {};
  if (!Object.prototype.hasOwnProperty.call(options, selectedOption)) {
    return res.status(400).json(
      formatError('INVALID_INPUT', 'Invalid option key')
    );
  }

  const nowIso = new Date().toISOString();

  const { data: saved, error } = await supabase!
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

  res.json(formatSuccess({
    response: saved,
    ...realtime,
  }));
}));

/**
 * POST /api/parliamentary/voting - Submit or update a policy vote
 */
router.post('/', isAuthenticated, asyncHandler(async (req, res) => {
  const userId = (req.user as { id?: string } | undefined)?.id;
  const { articleId, politicianName, supportRating, comment } = req.body;

  if (!userId) {
    return res.status(401).json(
      formatError('UNAUTHORIZED', ErrorCodes.UNAUTHORIZED)
    );
  }

  if (!articleId || !politicianName || !supportRating) {
    return res.status(400).json(
      formatError('INVALID_INPUT', 'Missing required fields')
    );
  }

  if (supportRating < 1 || supportRating > 5) {
    return res.status(400).json(
      formatError('INVALID_INPUT', 'support_rating must be between 1 and 5')
    );
  }

  const { data: existing, error: checkError } = await supabase!
    .from('user_policy_votes')
    .select('id')
    .eq('user_id', userId)
    .eq('article_id', articleId)
    .eq('politician_name', politicianName)
    .single();

  let result;

  if (existing) {
    result = await supabase!
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
    result = await supabase!
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

  res.json(formatSuccess({
    vote: result.data,
    message: existing ? 'Vote updated' : 'Vote recorded',
    ...realtime,
  }));
}));

/**
 * GET /api/parliamentary/voting/user/:userId/personalized-scores - Get personalized TD scores for a user
 */
router.get('/user/:userId/personalized-scores', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { constituency, party, limit } = req.query;

  const scores = await PersonalizedScoringService.getPersonalizedRankings(userId, {
    constituency: constituency as string,
    party: party as string,
    limit: limit ? parseInt(limit as string) : undefined
  });

  res.json(formatSuccess(scores));
}));

/**
 * GET /api/parliamentary/voting/user/:userId/td/:politicianName - Get single TD's personalized score for a user
 */
router.get('/user/:userId/td/:politicianName', asyncHandler(async (req, res) => {
  const { userId, politicianName } = req.params;

  const score = await PersonalizedScoringService.getTDPersonalizedScore(
    userId,
    decodeURIComponent(politicianName)
  );

  if (!score) {
    return res.status(404).json(
      formatError('ENTITY_NOT_FOUND', 'TD not found')
    );
  }

  res.json(formatSuccess(score));
}));

/**
 * GET /api/parliamentary/voting/user/:userId/value-alignment - Get user's overall value alignment
 */
router.get('/user/:userId/value-alignment', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const alignment = await PersonalizedScoringService.getUserValueAlignment(userId);

  res.json(formatSuccess(alignment));
}));

/**
 * DELETE /api/parliamentary/voting/:voteId - Delete a policy vote
 */
router.delete('/:voteId', asyncHandler(async (req, res) => {
  const { voteId } = req.params;
  const { userId } = req.body;

  const { data: vote, error: checkError } = await supabase!
    .from('user_policy_votes')
    .select('user_id')
    .eq('id', parseInt(voteId))
    .single();

  if (checkError) throw checkError;

  if (vote.user_id !== userId) {
    return res.status(403).json(
      formatError('FORBIDDEN', ErrorCodes.FORBIDDEN)
    );
  }

  const { error: deleteError } = await supabase!
    .from('user_policy_votes')
    .delete()
    .eq('id', parseInt(voteId));

  if (deleteError) throw deleteError;

  res.json(formatSuccess({ message: 'Vote deleted' }));
}));

export default router;
