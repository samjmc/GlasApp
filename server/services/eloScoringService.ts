/**
 * ELO Scoring Service
 * Calculates and updates TD scores based on news impact
 */

import type { ArticleAnalysis } from './aiNewsAnalysisService';

const K_FACTOR = 32; // How much scores can change (standard ELO)
const TIME_DECAY_FACTOR = 0.5; // Older stories have less impact
const TIME_DECAY_DAYS = 90; // Stories lose impact after 90 days

export interface TDScore {
  overall_elo: number;
  transparency_elo: number;
  effectiveness_elo: number;
  integrity_elo: number;
  consistency_elo: number;
  constituency_service_elo: number;
}

export interface ELOUpdate {
  oldScore: number;
  newScore: number;
  change: number;
  reasoning: string;
}

/**
 * Calculate ELO change based on impact score
 */
export function calculateELOChange(
  impactScore: number, // -10 to +10
  credibilityScore: number, // 0 to 1
  articleAge: number = 0 // days since published
): number {
  
  // Base calculation: impact × K-factor × credibility
  let eloChange = (impactScore / 10) * K_FACTOR * credibilityScore;
  
  // Apply time decay for older articles
  if (articleAge > TIME_DECAY_DAYS) {
    const decayMultiplier = Math.pow(TIME_DECAY_FACTOR, (articleAge - TIME_DECAY_DAYS) / 30);
    eloChange *= decayMultiplier;
  }
  
  // Round to nearest integer
  return Math.round(eloChange);
}

/**
 * Update TD scores based on analysis
 */
export function updateTDScores(
  currentScores: TDScore,
  analysis: ArticleAnalysis,
  credibilityScore: number,
  articleAge: number = 0
): { updated: TDScore; changes: Record<string, ELOUpdate> } {
  
  const changes: Record<string, ELOUpdate> = {};
  
  // Calculate overall ELO change
  const overallChange = calculateELOChange(
    analysis.impact_score,
    credibilityScore,
    articleAge
  );
  
  changes.overall = {
    oldScore: currentScores.overall_elo,
    newScore: currentScores.overall_elo + overallChange,
    change: overallChange,
    reasoning: `${analysis.story_type} story with impact ${analysis.impact_score}`
  };
  
  // Calculate dimensional ELO changes
  const dimensions = [
    'transparency',
    'effectiveness',
    'integrity',
    'consistency',
    'constituency_service'
  ] as const;
  
  const updated: TDScore = {
    overall_elo: currentScores.overall_elo + overallChange,
    transparency_elo: currentScores.transparency_elo,
    effectiveness_elo: currentScores.effectiveness_elo,
    integrity_elo: currentScores.integrity_elo,
    consistency_elo: currentScores.consistency_elo,
    constituency_service_elo: currentScores.constituency_service_elo,
  };
  
  dimensions.forEach(dimension => {
    const impactKey = `${dimension}_impact` as keyof ArticleAnalysis;
    const eloKey = `${dimension}_elo` as keyof TDScore;
    const impact = (analysis[impactKey] as number | null) ?? null;
    
    if (impact !== null && impact !== 0) {
      const dimensionChange = calculateELOChange(impact, credibilityScore, articleAge);
      const oldScore = currentScores[eloKey] as number;
      const newScore = oldScore + dimensionChange;
      
      updated[eloKey] = newScore as any;
      
      changes[dimension] = {
        oldScore,
        newScore,
        change: dimensionChange,
        reasoning: `${dimension} impact: ${impact}`
      };
    }
  });
  
  return { updated, changes };
}

/**
 * Calculate TD rankings
 */
export function calculateRankings(allScores: TDScore[]): Map<string, { national: number; percentile: number }> {
  // Sort by overall ELO
  const sorted = [...allScores].sort((a, b) => b.overall_elo - a.overall_elo);
  
  const rankings = new Map();
  
  sorted.forEach((score, index) => {
    const rank = index + 1;
    const percentile = ((sorted.length - rank) / sorted.length) * 100;
    
    rankings.set((score as any).politician_name, {
      national: rank,
      percentile: Math.round(percentile)
    });
  });
  
  return rankings;
}

/**
 * Get score rating category
 */
export function getScoreRating(elo: number): {
  rating: string;
  color: string;
  description: string;
} {
  if (elo >= 1700) {
    return {
      rating: 'Excellent',
      color: 'emerald',
      description: 'Outstanding performance across all dimensions'
    };
  } else if (elo >= 1600) {
    return {
      rating: 'Very Good',
      color: 'green',
      description: 'Consistently positive performance'
    };
  } else if (elo >= 1500) {
    return {
      rating: 'Good',
      color: 'blue',
      description: 'Above average performance'
    };
  } else if (elo >= 1400) {
    return {
      rating: 'Average',
      color: 'yellow',
      description: 'Mixed record with room for improvement'
    };
  } else if (elo >= 1300) {
    return {
      rating: 'Below Average',
      color: 'orange',
      description: 'Several concerning issues'
    };
  } else {
    return {
      rating: 'Poor',
      color: 'red',
      description: 'Significant performance concerns'
    };
  }
}

/**
 * Calculate article age in days
 */
export function getArticleAge(publishedDate: Date): number {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - publishedDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export const ELOScoringService = {
  calculateELOChange,
  updateTDScores,
  calculateRankings,
  getScoreRating,
  getArticleAge
};



