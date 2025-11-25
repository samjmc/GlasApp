/**
 * Personal Rankings API Routes
 * Handles quiz, policy voting, and personalized TD rankings
 */

import { Router, Request, Response } from 'express';
import { PersonalRankingsService } from '../services/personalRankingsService.js';
import { IDEOLOGY_DIMENSIONS } from '../constants/ideology.js';
import { supabaseDb } from '../db.js';

const router = Router();

export function formatUserProfilePayload(profile: any) {
  if (!profile) return null;

  const ideology = IDEOLOGY_DIMENSIONS.reduce<Record<string, number>>((acc, dimension) => {
    acc[dimension] = profile[dimension] ?? 0;
    return acc;
  }, {});

  const averageMagnitude =
    IDEOLOGY_DIMENSIONS.reduce((sum, dimension) => sum + Math.abs(ideology[dimension]), 0) /
    IDEOLOGY_DIMENSIONS.length;

  const avgScore = Math.round((averageMagnitude / 10) * 100);

  // Nuanced multi-dimensional ideology labeling
  // Consider all 8 dimensions to create more accurate and varied labels
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

    // Identify primary characteristics (strongest positions)
    const characteristics: string[] = [];
    
    // Economic dimension
    if (economic <= -6) characteristics.push('Left-Wing');
    else if (economic >= 6) characteristics.push('Right-Wing');
    else if (economic <= -3) characteristics.push('Center-Left');
    else if (economic >= 3) characteristics.push('Center-Right');
    
    // Social dimension
    if (social <= -6) characteristics.push('Progressive');
    else if (social >= 6) characteristics.push('Social Conservative');
    
    // Cultural dimension
    if (cultural <= -6) characteristics.push('Multicultural');
    else if (cultural >= 6) characteristics.push('Traditional');
    
    // Globalism dimension (scale: +10 = Ultranationalist, -10 = Internationalist)
    if (globalism >= 6) characteristics.push('Nationalist');
    else if (globalism <= -6) characteristics.push('Internationalist');
    
    // Environmental dimension (scale: +10 = Ecological, -10 = Industrial)
    if (environmental >= 6) characteristics.push('Ecological');
    else if (environmental <= -6) characteristics.push('Industrial');
    
    // Authority dimension
    if (authority <= -6) characteristics.push('Libertarian');
    else if (authority >= 6) characteristics.push('Authoritarian');
    
    // Welfare dimension (scale: +10 = Communitarian, -10 = Individual)
    if (welfare >= 6) characteristics.push('Communitarian');
    else if (welfare <= -6) characteristics.push('Individualist');
    
    // Governance dimension (scale: +10 = Technocratic, -10 = Populist)
    if (technocratic >= 6) characteristics.push('Technocratic');
    else if (technocratic <= -6) characteristics.push('Populist');
    
    // Build nuanced label based on combinations
    // Priority: Most extreme positions first, then combinations
    
    // Special combinations that create distinct ideologies
    // Check most specific combinations first
    // Note: globalism scale: +10 = Ultranationalist, -10 = Internationalist
    // Note: environmental scale: +10 = Ecological, -10 = Industrial
    
    // Traditional + Nationalist + Ecological = Traditional nationalist who prioritizes environment
    if (globalism >= 6 && cultural >= 6 && environmental >= 6) {
      return 'Traditional Nationalist';
    }
    
    // Ecological + Internationalist + Left = Environmental globalist
    if (globalism <= -6 && environmental >= 6 && economic <= -3) {
      return 'Green Internationalist';
    }
    
    // Nationalist + Traditional + Right = National conservative
    if (globalism >= 6 && cultural >= 6 && economic >= 3) {
      return 'National Conservative';
    }
    
    // Nationalist + Industrial + Right = Economic nationalist
    if (globalism >= 6 && environmental <= -6 && economic >= 3) {
      return 'Industrial Nationalist';
    }
    
    // Traditional + Social Conservative + Authoritarian = Social conservative
    if (cultural >= 6 && social >= 6 && authority >= 3) {
      return 'Traditional Conservative';
    }
    
    // Progressive + Multicultural + Left = Progressive multiculturalist
    if (cultural <= -6 && social <= -6 && economic <= -3) {
      return 'Progressive Multiculturalist';
    }
    
    // Ecological + Left + Communitarian = Eco-socialist
    if (environmental >= 6 && economic <= -3 && welfare >= 3) {
      return 'Eco-Socialist';
    }
    
    // Industrial + Right + Authoritarian = Industrial authoritarian
    if (environmental <= -6 && economic >= 6 && authority >= 3) {
      return 'Industrial Authoritarian';
    }
    
    // Technocratic + Authoritarian + Right = Technocratic conservative
    if (technocratic >= 6 && authority >= 3 && economic >= 3) {
      return 'Technocratic Conservative';
    }
    
    // Populist + Libertarian + Progressive = Libertarian progressive
    if (technocratic <= -6 && authority <= -3 && social <= -3) {
      return 'Libertarian Progressive';
    }
    
    // Communitarian + Left + Progressive = Social democrat
    if (welfare >= 6 && economic <= -3 && social <= -3) {
      return 'Social Democrat';
    }
    
    // Individualist + Right + Libertarian = Libertarian right
    if (welfare <= -6 && economic >= 6 && authority <= -3) {
      return 'Libertarian Right';
    }
    
    // Traditional + Nationalist (without strong environmental) = Cultural traditionalist who prioritizes nation
    if (globalism >= 6 && cultural >= 6 && Math.abs(environmental) < 6) {
      return 'Traditional Nationalist';
    }
    
    // Ecological + Nationalist = Green nationalist
    if (globalism >= 6 && environmental >= 6 && economic >= 0) {
      return 'Green Nationalist';
    }
    
    // Industrial + Internationalist = Business globalist (supports global trade)
    if (globalism <= -6 && environmental <= -6 && economic >= 0) {
      return 'Industrial Internationalist';
    }
    
    // Internationalist + Traditional = Cultural traditionalist who supports global cooperation
    if (globalism <= -6 && cultural >= 6) {
      return 'Traditional Internationalist';
    }
    
    // Ecological + Right = Green conservative
    if (environmental >= 6 && economic >= 3 && social >= 0) {
      return 'Green Conservative';
    }
    
    // Populist + Traditional = Traditional populist
    if (technocratic <= -6 && cultural >= 6) {
      return 'Traditional Populist';
    }
    
    // Technocratic + Progressive = Technocratic progressive
    if (technocratic >= 6 && social <= -3 && economic <= 0) {
      return 'Technocratic Progressive';
    }
    
    // If we have characteristics, combine the top 2-3 most relevant
    if (characteristics.length > 0) {
      // Sort by absolute value of corresponding dimension
      const sortedChars = characteristics
        .map(char => {
          let value = 0;
          if (char.includes('Left') || char.includes('Right')) value = Math.abs(economic);
          else if (char.includes('Progressive') || char.includes('Conservative')) value = Math.abs(social);
          else if (char.includes('Multicultural') || char.includes('Traditional')) value = Math.abs(cultural);
          else if (char.includes('Nationalist') || char.includes('Internationalist')) value = Math.abs(globalism);
          // Note: For globalism, higher positive = more nationalist, higher negative = more internationalist
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
    
    // Fallback: use traditional left-right spectrum if nothing else fits
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

export function formatRankingsResponse(rankings: any[]) {
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
 * POST /api/personal/quiz - Submit quiz results
 */
router.post('/quiz', async (req: Request, res: Response) => {
  try {
    const { userId, answers } = req.body;
    
    if (!userId || !answers) {
      return res.status(400).json({
        success: false,
        message: 'userId and answers are required'
      });
    }
    
    // Validate answers (all dimensions 1-5)
    const dimensions = ['immigration', 'healthcare', 'housing', 'economy', 'environment', 'social_issues', 'justice', 'education'];
    for (const dim of dimensions) {
      if (!answers[dim] || answers[dim] < 1 || answers[dim] > 5) {
        return res.status(400).json({
          success: false,
          message: `Invalid answer for ${dim}. Must be 1-5.`
        });
      }
    }
    
    // Save quiz results and calculate initial rankings
    await PersonalRankingsService.saveQuizResults(userId, answers, {
      asyncRecalculation: true
    });
    
    // Provide latest known matches while recalculation completes
    const existingMatches = await PersonalRankingsService.getPersonalRankings(userId, 5);
    
    res.json({
      success: true,
      message: 'Quiz results saved',
      processing: true,
      estimatedWaitSeconds: 30,
      topMatches: existingMatches.map(r => ({
        name: r.politician_name,
        party: r.td_scores?.party,
        constituency: r.td_scores?.constituency,
        compatibility: Math.round(r.overall_compatibility),
        ideologyMatch: Math.round(r.ideology_match),
        policyAgreement: Math.round(r.policy_agreement),
        rank: r.personal_rank
      }))
    });
    
  } catch (error: any) {
    console.error('Quiz submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save quiz results',
      error: error.message
    });
  }
});

/**
 * GET /api/personal/rankings/:userId - Get personal rankings
 */
router.get('/rankings/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;

    const hasEnhancedQuiz = await PersonalRankingsService.hasCompletedEnhancedQuiz(userId);
    if (!hasEnhancedQuiz) {
      return res.status(403).json({
        success: false,
        requiresEnhancedQuiz: true,
        message: 'Complete the enhanced quiz to unlock personalized rankings.',
      });
    }
    
    const rankings = await PersonalRankingsService.getPersonalRankings(userId, Number(limit));
    
    res.json({
      success: true,
      rankings: formatRankingsResponse(rankings)
    });
    
  } catch (error: any) {
    console.error('Personal rankings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch personal rankings'
    });
  }
});

/**
 * POST /api/personal/vote - Submit policy vote (updates personal rankings)
 */
router.post('/vote', async (req: Request, res: Response) => {
  try {
    const { userId, articleId, rating } = req.body;
    
    if (!userId || !articleId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'userId, articleId, and rating are required'
      });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be 1-5'
      });
    }
    
    // Note: The vote itself is already saved by the /api/policy-votes endpoint
    // This endpoint just updates personal rankings based on that vote
    // No need to save again, just process the ranking update
    
    // Update policy agreements and recalculate rankings
    await PersonalRankingsService.updatePolicyAgreementFromVote(userId, articleId, rating);
    
    // Get updated rankings changes
    const { data: affectedTDs } = await supabaseDb
      ?.from('td_policy_stances')
      .select('politician_name, stance')
      .eq('article_id', articleId) || { data: null };
    
    const userStance = PersonalRankingsService.ratingToStance(rating);
    
    const rankingChanges = (affectedTDs || []).map(td => ({
      td: td.politician_name,
      agreed: PersonalRankingsService.stancesMatch(userStance, td.stance)
    }));
    
    res.json({
      success: true,
      message: 'Vote recorded and rankings updated',
      yourStance: userStance,
      affectedTDs: rankingChanges.length,
      rankingChanges
    });
    
  } catch (error: any) {
    console.error('Policy vote error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record vote'
    });
  }
});

/**
 * GET /api/personal/profile/:userId - Get user's ideological profile
 */
router.get('/profile/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    console.log(`[Profile API] Checking quiz completion for userId: ${userId} (type: ${typeof userId})`);
    
    const hasEnhancedQuiz = await PersonalRankingsService.hasCompletedEnhancedQuiz(userId);
    
    console.log(`[Profile API] hasCompletedEnhancedQuiz result: ${hasEnhancedQuiz}`);
    
    if (!hasEnhancedQuiz) {
      return res.json({
        success: true,
        hasCompletedQuiz: false,
        requiresEnhancedQuiz: true,
        profile: null,
      });
    }
    
    const profile = await PersonalRankingsService.getUserProfile(userId);
    
    console.log(`[Profile API] getUserProfile result:`, profile ? 'found' : 'not found');
    
    if (!profile) {
      return res.json({
        success: true,
        hasCompletedQuiz: false,
        requiresEnhancedQuiz: true,
        profile: null,
      });
    }

    res.json({
      success: true,
      hasCompletedQuiz: true,
      requiresEnhancedQuiz: false,
      profile: formatUserProfilePayload(profile),
    });
    
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

/**
 * GET /api/personal/top-matches/:userId - Get top 5 personal matches
 */
router.get('/top-matches/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const hasEnhancedQuiz = await PersonalRankingsService.hasCompletedEnhancedQuiz(userId);
    if (!hasEnhancedQuiz) {
      return res.status(403).json({
        success: false,
        requiresEnhancedQuiz: true,
        message: 'Complete the enhanced quiz to unlock personalized rankings.',
      });
    }
    
    const topMatches = await PersonalRankingsService.getPersonalRankings(userId, 5);
    
    res.json({
      success: true,
      topMatches: formatRankingsResponse(topMatches),
    });
    
  } catch (error: any) {
    console.error('Top matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top matches'
    });
  }
});

/**
 * GET /api/personal/party-matches/:userId - Get party alignment matches
 */
router.get('/party-matches/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 8 } = req.query;

    const hasEnhancedQuiz = await PersonalRankingsService.hasCompletedEnhancedQuiz(userId);
    if (!hasEnhancedQuiz) {
      return res.status(403).json({
        success: false,
        requiresEnhancedQuiz: true,
        message: 'Complete the enhanced quiz to unlock personalized rankings.',
      });
    }

    const matches = await PersonalRankingsService.getPartyMatches(userId, Number(limit));

    res.json({
      success: true,
      matches: matches.map((match) => ({
        party: match.party,
        match: Math.round(match.match),
        ideology: match.ideology,
        confidence: match.total_weight,
      })),
    });
  } catch (error: any) {
    console.error('Party matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch party matches',
    });
  }
});

/**
 * GET /api/personal/friends/:userId - Get friend leaderboard + streak insights
 */
router.get('/friends/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const insights = await PersonalRankingsService.getFriendInsights(userId);

    res.json({
      success: true,
      summary: insights.summary,
      leaderboard: insights.leaderboard,
      streaks: insights.streaks,
      pendingInvites: insights.pendingInvites
    });
  } catch (error: any) {
    console.error('Friend insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch friend insights'
    });
  }
});

/**
 * GET /api/personal/profile/:userId - Get user's ideological profile
 */
router.get('/profile/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    console.log(`[Profile API] Checking quiz completion for userId: ${userId} (type: ${typeof userId})`);
    
    const hasEnhancedQuiz = await PersonalRankingsService.hasCompletedEnhancedQuiz(userId);
    
    console.log(`[Profile API] hasCompletedEnhancedQuiz result: ${hasEnhancedQuiz}`);
    
    if (!hasEnhancedQuiz) {
      return res.json({
        success: true,
        hasCompletedQuiz: false,
        requiresEnhancedQuiz: true,
        profile: null,
      });
    }
    
    const profile = await PersonalRankingsService.getUserProfile(userId);
    
    console.log(`[Profile API] getUserProfile result:`, profile ? 'found' : 'not found');
    
    if (!profile) {
      return res.json({
        success: true,
        hasCompletedQuiz: false,
        requiresEnhancedQuiz: true,
        profile: null,
      });
    }

    res.json({
      success: true,
      hasCompletedQuiz: true,
      requiresEnhancedQuiz: false,
      profile: formatUserProfilePayload(profile),
    });
    
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

/**
 * GET /api/personal/top-matches/:userId - Get top 5 personal matches
 */
router.get('/top-matches/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const hasEnhancedQuiz = await PersonalRankingsService.hasCompletedEnhancedQuiz(userId);
    if (!hasEnhancedQuiz) {
      return res.status(403).json({
        success: false,
        requiresEnhancedQuiz: true,
        message: 'Complete the enhanced quiz to unlock personalized rankings.',
      });
    }
    
    const topMatches = await PersonalRankingsService.getPersonalRankings(userId, 5);
    
    res.json({
      success: true,
      topMatches: formatRankingsResponse(topMatches),
    });
    
  } catch (error: any) {
    console.error('Top matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top matches'
    });
  }
});

/**
 * GET /api/personal/party-matches/:userId - Get party alignment matches
 */
router.get('/party-matches/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 8 } = req.query;

    const hasEnhancedQuiz = await PersonalRankingsService.hasCompletedEnhancedQuiz(userId);
    if (!hasEnhancedQuiz) {
      return res.status(403).json({
        success: false,
        requiresEnhancedQuiz: true,
        message: 'Complete the enhanced quiz to unlock personalized rankings.',
      });
    }

    const matches = await PersonalRankingsService.getPartyMatches(userId, Number(limit));

    res.json({
      success: true,
      matches: matches.map((match) => ({
        party: match.party,
        match: Math.round(match.match),
        ideology: match.ideology,
        confidence: match.total_weight,
      })),
    });
  } catch (error: any) {
    console.error('Party matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch party matches',
    });
  }
});

/**
 * GET /api/personal/friends/:userId - Get friend leaderboard + streak insights
 */
router.get('/friends/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const insights = await PersonalRankingsService.getFriendInsights(userId);

    res.json({
      success: true,
      summary: insights.summary,
      leaderboard: insights.leaderboard,
      streaks: insights.streaks,
      pendingInvites: insights.pendingInvites
    });
  } catch (error: any) {
    console.error('Friend insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch friend insights'
    });
  }
});

export default router;

