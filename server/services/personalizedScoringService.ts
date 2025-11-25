/**
 * Personalized Scoring Service
 * Calculates TD scores personalized to user's policy votes
 * 
 * Combines:
 * - Objective process scores (transparency, integrity, etc.) - 60% weight
 * - User's policy alignment (their votes on policies) - 40% weight
 */

import { supabaseDb as supabase } from '../db.js';

interface PersonalizedTDScore {
  politician_name: string;
  constituency: string;
  party: string;
  
  // Objective scores (same for all users)
  objective_score: number;
  transparency_score: number;
  effectiveness_score: number;
  integrity_score: number;
  consistency_score: number;
  
  // User-specific
  policy_alignment: number;      // -10 to +10 average
  personalized_score: number;    // Final combined score
  policies_voted_on: number;
  
  // Comparison
  platform_average: number;
  difference_from_average: number;
}

/**
 * Calculate personalized TD scores for a user
 */
export async function calculatePersonalizedScores(
  userId: string
): Promise<PersonalizedTDScore[]> {
  
  // Step 1: Get all active TDs with their objective scores
  const { data: tds, error: tdError } = await supabase
    .from('td_scores')
    .select(`
      politician_name,
      constituency,
      party,
      transparency_elo,
      effectiveness_elo,
      integrity_elo,
      consistency_elo,
      is_active
    `)
    .eq('is_active', true);
  
  if (tdError) throw tdError;
  if (!tds) return [];
  
  // Step 2: Get user's policy votes
  const { data: userVotes, error: votesError } = await supabase
    .from('user_policy_votes')
    .select('politician_name, support_rating')
    .eq('user_id', userId);
  
  if (votesError) throw votesError;
  
  // Step 3: Get platform averages for comparison
  const { data: allVotes, error: allVotesError } = await supabase
    .from('user_policy_votes')
    .select('politician_name, support_rating');
  
  if (allVotesError) throw allVotesError;
  
  // Calculate platform averages by TD
  const platformAverages = new Map<string, number>();
  const votesByTD = new Map<string, number[]>();
  
  allVotes?.forEach(vote => {
    if (!votesByTD.has(vote.politician_name)) {
      votesByTD.set(vote.politician_name, []);
    }
    votesByTD.get(vote.politician_name)!.push(vote.support_rating);
  });
  
  votesByTD.forEach((votes, tdName) => {
    const avg = votes.reduce((sum, v) => sum + starToImpact(v), 0) / votes.length;
    platformAverages.set(tdName, avg);
  });
  
  // Step 4: Calculate personalized scores for each TD
  const personalizedScores: PersonalizedTDScore[] = tds.map(td => {
    // Convert ELO (1200-1800) to 0-100 scale
    const transparencyNormalized = eloToScore(td.transparency_elo);
    const effectivenessNormalized = eloToScore(td.effectiveness_elo);
    const integrityNormalized = eloToScore(td.integrity_elo);
    const consistencyNormalized = eloToScore(td.consistency_elo);
    
    const objectiveScore = Math.round(
      (transparencyNormalized + effectivenessNormalized + 
       integrityNormalized + consistencyNormalized) / 4
    );
    
    // Calculate user's policy alignment for this TD
    const tdVotes = userVotes?.filter(v => v.politician_name === td.politician_name) || [];
    
    let policyAlignment = 0;
    let personalizedScore = objectiveScore; // Default to objective if no votes
    
    if (tdVotes.length > 0) {
      // Average user's votes: 1-5 stars → -10 to +10
      policyAlignment = tdVotes.reduce((sum, vote) => 
        sum + starToImpact(vote.support_rating), 0
      ) / tdVotes.length;
      
      // Convert -10 to +10 → 0 to 100 scale
      const policyScore = 50 + (policyAlignment * 2); // -10 = 30, 0 = 50, +10 = 70
      
      // Combine: 60% objective + 40% policy
      personalizedScore = Math.round(
        (objectiveScore * 0.6) + (policyScore * 0.4)
      );
    }
    
    // Get platform average
    const platformAvg = platformAverages.get(td.politician_name) || 0;
    const platformScore = 50 + (platformAvg * 2);
    const platformPersonalized = Math.round(
      (objectiveScore * 0.6) + (platformScore * 0.4)
    );
    
    return {
      politician_name: td.politician_name,
      constituency: td.constituency,
      party: td.party,
      
      objective_score: objectiveScore,
      transparency_score: transparencyNormalized,
      effectiveness_score: effectivenessNormalized,
      integrity_score: integrityNormalized,
      consistency_score: consistencyNormalized,
      
      policy_alignment: Math.round(policyAlignment * 10) / 10,
      personalized_score: personalizedScore,
      policies_voted_on: tdVotes.length,
      
      platform_average: platformPersonalized,
      difference_from_average: personalizedScore - platformPersonalized
    };
  });
  
  return personalizedScores;
}

/**
 * Convert ELO rating to 0-100 score
 */
function eloToScore(elo: number | null): number {
  if (!elo) return 50; // Default
  
  // ELO range: 1200 (poor) to 1800 (excellent)
  // Convert to 0-100 scale
  const normalized = ((elo - 1200) / 600) * 100;
  return Math.min(100, Math.max(0, Math.round(normalized)));
}

/**
 * Convert 5-star rating to -10 to +10 impact
 */
function starToImpact(stars: number): number {
  const mapping: Record<number, number> = {
    5: 10,   // Strongly support
    4: 5,    // Support
    3: 0,    // Neutral
    2: -5,   // Oppose
    1: -10   // Strongly oppose
  };
  return mapping[stars] || 0;
}

/**
 * Get TD rankings sorted by personalized score
 */
export async function getPersonalizedRankings(
  userId: string,
  filters?: {
    constituency?: string;
    party?: string;
    limit?: number;
  }
): Promise<PersonalizedTDScore[]> {
  
  let scores = await calculatePersonalizedScores(userId);
  
  // Apply filters
  if (filters?.constituency) {
    scores = scores.filter(s => s.constituency === filters.constituency);
  }
  if (filters?.party) {
    scores = scores.filter(s => s.party === filters.party);
  }
  
  // Sort by personalized score
  scores.sort((a, b) => b.personalized_score - a.personalized_score);
  
  // Limit results
  if (filters?.limit) {
    scores = scores.slice(0, filters.limit);
  }
  
  return scores;
}

/**
 * Get single TD's personalized score for a user
 */
export async function getTDPersonalizedScore(
  userId: string,
  politicianName: string
): Promise<PersonalizedTDScore | null> {
  
  const scores = await calculatePersonalizedScores(userId);
  return scores.find(s => s.politician_name === politicianName) || null;
}

/**
 * Calculate how user's values compare to platform average
 */
export async function getUserValueAlignment(
  userId: string
): Promise<{
  overall_alignment: number;  // -10 to +10, how left/right compared to average
  progressive_tds_preference: number;  // Higher = prefers progressive TDs
  conservative_tds_preference: number;  // Higher = prefers conservative TDs
  votes_cast: number;
}> {
  
  const { data: userVotes } = await supabase
    .from('user_policy_votes')
    .select(`
      support_rating,
      politician_name,
      article_id
    `)
    .eq('user_id', userId);
  
  if (!userVotes || userVotes.length === 0) {
    return {
      overall_alignment: 0,
      progressive_tds_preference: 50,
      conservative_tds_preference: 50,
      votes_cast: 0
    };
  }
  
  // Get policy directions for voted articles
  const articleIds = [...new Set(userVotes.map(v => v.article_id))];
  
  const { data: articles } = await supabase
    .from('news_articles')
    .select('id, policy_direction')
    .in('id', articleIds);
  
  const articlePolicyMap = new Map(
    articles?.map(a => [a.id, a.policy_direction]) || []
  );
  
  // Calculate preference for progressive vs conservative policies
  let progressiveSupport = 0;
  let conservativeSupport = 0;
  let progressiveCount = 0;
  let conservativeCount = 0;
  
  userVotes.forEach(vote => {
    const direction = articlePolicyMap.get(vote.article_id);
    const support = starToImpact(vote.support_rating);
    
    if (direction === 'progressive') {
      progressiveSupport += support;
      progressiveCount++;
    } else if (direction === 'conservative') {
      conservativeSupport += support;
      conservativeCount++;
    }
  });
  
  const avgProgressiveSupport = progressiveCount > 0 
    ? progressiveSupport / progressiveCount 
    : 0;
    
  const avgConservativeSupport = conservativeCount > 0
    ? conservativeSupport / conservativeCount
    : 0;
  
  // Overall alignment: negative = left-leaning, positive = right-leaning
  const overallAlignment = (avgConservativeSupport - avgProgressiveSupport) / 2;
  
  return {
    overall_alignment: Math.round(overallAlignment * 10) / 10,
    progressive_tds_preference: 50 + Math.round(avgProgressiveSupport * 2),
    conservative_tds_preference: 50 + Math.round(avgConservativeSupport * 2),
    votes_cast: userVotes.length
  };
}

export const PersonalizedScoringService = {
  calculatePersonalizedScores,
  getPersonalizedRankings,
  getTDPersonalizedScore,
  getUserValueAlignment
};























