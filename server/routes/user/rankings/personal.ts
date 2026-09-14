/**
 * Personal Rankings Routes
 * Handles personal TD rankings, quiz results, user profiles
 */

import { Router, Request, Response } from 'express';
import { PersonalRankingsService } from '../../../services/personalRankingsService.js';
import { IDEOLOGY_DIMENSIONS } from '../../../constants/ideology.js';
import { asyncHandler } from '../../../middleware/errorHandler.js';
import { formatSuccess, formatError, ErrorCodes } from '../../../utils/responseFormatters.js';

const router = Router();

/**
 * Format user profile with ideology labels and engagement metrics
 */
/** Format a user profile with ideology and engagement metrics. */
export function formatUserProfilePayload(profile: unknown) {
  if (!profile) return null;

  const ideology = IDEOLOGY_DIMENSIONS.reduce<Record<string, number>>((acc, dimension) => {
    acc[dimension] = profile[dimension] ?? 0;
    return acc;
  }, {});

  const averageMagnitude =
    IDEOLOGY_DIMENSIONS.reduce((sum, dimension) => sum + Math.abs(ideology[dimension]), 0) /
    IDEOLOGY_DIMENSIONS.length;

  const avgScore = Math.round((averageMagnitude / 10) * 100);

  const getNuancedIdeologyLabel = (ideology: Record<string, number>): string => {
    const {
      economic = 0,
      social = 0,
      cultural = 0,
      globalism = 0,
      environmental = 0,
      authority = 0,
      welfare = 0,
      technocratic = 0
    } = ideology;

    const characteristics: string[] = [];

    if (economic <= -6) characteristics.push('Left-Wing');
    else if (economic >= 6) characteristics.push('Right-Wing');
    else if (economic <= -3) characteristics.push('Center-Left');
    else if (economic >= 3) characteristics.push('Center-Right');

    if (social <= -6) characteristics.push('Progressive');
    else if (social >= 6) characteristics.push('Social Conservative');

    if (cultural <= -6) characteristics.push('Multicultural');
    else if (cultural >= 6) characteristics.push('Traditional');

    if (globalism >= 6) characteristics.push('Nationalist');
    else if (globalism <= -6) characteristics.push('Internationalist');

    if (environmental >= 6) characteristics.push('Ecological');
    else if (environmental <= -6) characteristics.push('Industrial');

    if (authority <= -6) characteristics.push('Libertarian');
    else if (authority >= 6) characteristics.push('Authoritarian');

    if (welfare >= 6) characteristics.push('Communitarian');
    else if (welfare <= -6) characteristics.push('Individualist');

    if (technocratic >= 6) characteristics.push('Technocratic');
    else if (technocratic <= -6) characteristics.push('Populist');

    // Special combinations
    if (globalism >= 6 && cultural >= 6 && environmental >= 6) {
      return 'Traditional Nationalist';
    }

    if (globalism <= -6 && environmental >= 6 && economic <= -3) {
      return 'Green Internationalist';
    }

    if (globalism >= 6 && cultural >= 6 && economic >= 3) {
      return 'National Conservative';
    }

    if (globalism >= 6 && environmental <= -6 && economic >= 3) {
      return 'Industrial Nationalist';
    }

    if (cultural >= 6 && social >= 6 && authority >= 3) {
      return 'Traditional Conservative';
    }

    if (cultural <= -6 && social <= -6 && economic <= -3) {
      return 'Progressive Multiculturalist';
    }

    if (environmental >= 6 && economic <= -3 && welfare >= 3) {
      return 'Eco-Socialist';
    }

    if (environmental <= -6 && economic >= 6 && authority >= 3) {
      return 'Industrial Authoritarian';
    }

    if (technocratic >= 6 && authority >= 3 && economic >= 3) {
      return 'Technocratic Conservative';
    }

    if (technocratic <= -6 && authority <= -3 && social <= -3) {
      return 'Libertarian Progressive';
    }

    if (welfare >= 6 && economic <= -3 && social <= -3) {
      return 'Social Democrat';
    }

    if (welfare <= -6 && economic >= 6 && authority <= -3) {
      return 'Libertarian Right';
    }

    if (globalism >= 6 && cultural >= 6 && Math.abs(environmental) < 6) {
      return 'Traditional Nationalist';
    }

    if (globalism >= 6 && environmental >= 6 && economic >= 0) {
      return 'Green Nationalist';
    }

    if (globalism <= -6 && environmental <= -6 && economic >= 0) {
      return 'Industrial Internationalist';
    }

    if (globalism <= -6 && cultural >= 6) {
      return 'Traditional Internationalist';
    }

    if (environmental >= 6 && economic >= 3 && social >= 0) {
      return 'Green Conservative';
    }

    if (technocratic <= -6 && cultural >= 6) {
      return 'Traditional Populist';
    }

    if (technocratic >= 6 && social <= -3 && economic <= 0) {
      return 'Technocratic Progressive';
    }

    if (characteristics.length > 0) {
      const sortedChars = characteristics
        .map(char => {
          let value = 0;
          if (char.includes('Left') || char.includes('Right')) value = Math.abs(economic);
          else if (char.includes('Progressive') || char.includes('Conservative')) value = Math.abs(social);
          else if (char.includes('Multicultural') || char.includes('Traditional')) value = Math.abs(cultural);
          else if (char.includes('Nationalist') || char.includes('Internationalist')) value = Math.abs(globalism);
          else if (char.includes('Industrial') || char.includes('Ecological')) value = Math.abs(environmental);
          else if (char.includes('Libertarian') || char.includes('Authoritarian')) value = Math.abs(authority);
          else if (char.includes('Individualist') || char.includes('Communitarian')) value = Math.abs(welfare);
          else if (char.includes('Populist') || char.includes('Technocratic')) value = Math.abs(technocratic);
          return { char, value };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 2)
        .map(item => item.char);

      if (sortedChars.length === 2) {
        return `${sortedChars[0]} ${sortedChars[1]}`;
      } else if (sortedChars.length === 1) {
        return sortedChars[0];
      }
    }

    const leanScore = (economic + social + welfare) / 3;
    if (leanScore <= -5) return 'Strongly Progressive';
    if (leanScore <= -2) return 'Progressive';
    if (leanScore >= 5) return 'Strongly Conservative';
    if (leanScore >= 2) return 'Conservative';

    return 'Centrist';
  };

  const ideologyLabel = getNuancedIdeologyLabel(ideology);

  const engagementLabel =
    profile.total_weight >= 25
      ? 'Highly engaged'
      : profile.total_weight >= 10
      ? 'Engaged'
      : profile.total_weight > 0
      ? 'Getting started'
      : 'No votes yet';

  const intensityScore = Math.round(averageMagnitude);

  return {
    ideology,
    totalWeight: profile.total_weight || 0,
    avgScore,
    ideologyLabel,
    intensity: intensityScore,
    engagement: engagementLabel,
  };
}

/**
 * Format rankings response - standardized ranking output
 */
/** Format personal rankings into a standardized response shape. */
export function formatRankingsResponse(rankings: unknown[]) {
  return rankings.map((r) => ({
    name: r.politician_name,
    party: r.td_scores?.party,
    constituency: r.td_scores?.constituency,
    compatibility: Math.round(r.overall_compatibility),
    ideologyMatch: Math.round(r.ideology_match),
    policyAgreement: Math.round(r.policy_agreement),
    policiesCompared: r.policies_compared,
    rank: r.personal_rank,
    publicRank: r.public_rank,
    overallScore: r.td_scores?.overall_score,
    image_url: r.td_scores?.image_url,
    rankDifference: r.public_rank ? (r.public_rank || 0) - (r.personal_rank || 0) : null,
  }));
}

/**
 * POST /api/user/rankings/personal/quiz - Submit quiz results
 * Legacy: POST /api/personal/quiz
 */
router.post('/quiz', asyncHandler(async (req: Request, res: Response) => {
  const { userId, answers } = req.body;

  if (!userId || !answers) {
    return res.status(400).json(
      formatError('MISSING_REQUIRED_FIELD', 'userId and answers are required')
    );
  }

  const dimensions = ['immigration', 'healthcare', 'housing', 'economy', 'environment', 'social_issues', 'justice', 'education'];
  for (const dim of dimensions) {
    if (!answers[dim] || answers[dim] < 1 || answers[dim] > 5) {
      return res.status(400).json(
        formatError('VALIDATION_ERROR', `Invalid answer for ${dim}. Must be 1-5.`)
      );
    }
  }

  await PersonalRankingsService.saveQuizResults(userId, answers, {
    asyncRecalculation: true
  });

  const existingMatches = await PersonalRankingsService.getPersonalRankings(userId, 5);

  res.json(formatSuccess({
    processing: true,
    estimatedWaitSeconds: 30,
    topMatches: formatRankingsResponse(existingMatches)
  }, { message: 'Quiz results saved' }));
}));

/**
 * GET /api/user/rankings/personal/:userId - Get personal rankings
 */
router.get('/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { limit = 20 } = req.query;

  const hasEnhancedQuiz = await PersonalRankingsService.hasCompletedEnhancedQuiz(userId);
  if (!hasEnhancedQuiz) {
    return res.status(403).json(
      formatError('FORBIDDEN', 'Complete the enhanced quiz to unlock personalized rankings.')
    );
  }

  const rankings = await PersonalRankingsService.getPersonalRankings(userId, Number(limit));

  res.json(formatSuccess(formatRankingsResponse(rankings)));
}));

/**
 * GET /api/user/rankings/personal/profile/:userId - Get user's ideological profile
 */
router.get('/profile/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  const hasEnhancedQuiz = await PersonalRankingsService.hasCompletedEnhancedQuiz(userId);

  if (!hasEnhancedQuiz) {
    return res.json(formatSuccess({
      hasCompletedQuiz: false,
      requiresEnhancedQuiz: true,
      profile: null,
    }));
  }

  const profile = await PersonalRankingsService.getUserProfile(userId);

  if (!profile) {
    return res.json(formatSuccess({
      hasCompletedQuiz: false,
      requiresEnhancedQuiz: true,
      profile: null,
    }));
  }

  res.json(formatSuccess({
    hasCompletedQuiz: true,
    requiresEnhancedQuiz: false,
    profile: formatUserProfilePayload(profile),
  }));
}));

/**
 * GET /api/user/rankings/personal/top-matches/:userId - Get top 5 personal matches
 */
router.get('/top-matches/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  const hasEnhancedQuiz = await PersonalRankingsService.hasCompletedEnhancedQuiz(userId);
  if (!hasEnhancedQuiz) {
    return res.status(403).json(
      formatError('FORBIDDEN', 'Complete the enhanced quiz to unlock personalized rankings.')
    );
  }

  const topMatches = await PersonalRankingsService.getPersonalRankings(userId, 5);

  res.json(formatSuccess(formatRankingsResponse(topMatches)));
}));

/**
 * GET /api/user/rankings/personal/party-matches/:userId - Get party alignment matches
 */
router.get('/party-matches/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { limit = 8 } = req.query;

  const hasEnhancedQuiz = await PersonalRankingsService.hasCompletedEnhancedQuiz(userId);
  if (!hasEnhancedQuiz) {
    return res.status(403).json(
      formatError('FORBIDDEN', 'Complete the enhanced quiz to unlock personalized rankings.')
    );
  }

  const matches = await PersonalRankingsService.getPartyMatches(userId, Number(limit));

  res.json(formatSuccess(
    matches.map((match) => ({
      party: match.party,
      match: Math.round(match.match),
      ideology: match.ideology,
      confidence: match.total_weight,
    }))
  ));
}));

/**
 * GET /api/user/rankings/personal/friends/:userId - Get friend leaderboard + streak insights
 */
router.get('/friends/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const insights = await PersonalRankingsService.getFriendInsights(userId);

  res.json(formatSuccess(insights));
}));

export default router;
