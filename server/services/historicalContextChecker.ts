/**
 * Historical Context Checker
 * Detects flip-flops by comparing article stance against:
 * 1. TD's party position on 8 quiz dimensions
 * 2. TD's voting history on related topics
 * 3. Political timing (riots, elections, polls)
 */

import { supabaseDb as supabase } from '../db.js';

export interface HistoricalContext {
  hasFlipFlop: boolean;
  flipFlopSeverity: 'none' | 'minor' | 'moderate' | 'major';
  flipFlopDetails?: string;
  dimensionViolated?: string;
  partyPosition?: number;
  articleStance?: number;
  deviation?: number;
  needsHumanReview: boolean;
  reviewReason?: string;
  suspiciousTiming?: boolean;
  timingDetails?: string;
}

// Map article topics to quiz dimensions
const TOPIC_TO_DIMENSION: Record<string, string> = {
  // Economic
  'tax': 'economic_score',
  'budget': 'economic_score',
  'spending': 'economic_score',
  'economy': 'economic_score',
  'fiscal': 'economic_score',
  
  // Social/Cultural
  'immigration': 'cultural_score',
  'asylum': 'cultural_score',
  'refugee': 'cultural_score',
  'abortion': 'social_score',
  'marriage': 'social_score',
  'lgbtq': 'social_score',
  'religion': 'cultural_score',
  
  // Globalism
  'eu': 'globalism_score',
  'europe': 'globalism_score',
  'brexit': 'globalism_score',
  'trade': 'globalism_score',
  'globalization': 'globalism_score',
  
  // Environmental
  'climate': 'environmental_score',
  'carbon': 'environmental_score',
  'environment': 'environmental_score',
  'renewable': 'environmental_score',
  'pollution': 'environmental_score',
  
  // Authority
  'law': 'authority_score',
  'police': 'authority_score',
  'garda': 'authority_score',
  'security': 'authority_score',
  'crime': 'authority_score',
  
  // Welfare
  'welfare': 'welfare_score',
  'benefits': 'welfare_score',
  'social protection': 'welfare_score',
  'housing': 'welfare_score',
  'healthcare': 'welfare_score',
  
  // Technocratic
  'expert': 'technocratic_score',
  'scientific': 'technocratic_score',
  'evidence': 'technocratic_score'
};

/**
 * Check if article represents a flip-flop from party position
 */
export async function checkHistoricalContext(
  article: any,
  politicianName: string,
  party: string,
  analysis: any
): Promise<HistoricalContext> {
  
  const context: HistoricalContext = {
    hasFlipFlop: false,
    flipFlopSeverity: 'none',
    needsHumanReview: false,
    suspiciousTiming: false
  };
  
  try {
    // Step 1: Determine which dimension this article relates to
    const dimension = detectDimension(article);
    
    if (!dimension) {
      return context; // Can't check if we don't know the dimension
    }
    
    context.dimensionViolated = dimension;
    
    // Step 2: Get party's position on this dimension
    const { data: partyData } = await supabase
      .from('parties')
      .select(dimension)
      .eq('name', party)
      .single();
    
    if (!partyData || partyData[dimension] === null) {
      return context; // No party position data
    }
    
    const partyPosition = Number(partyData[dimension]); // -10 to +10
    context.partyPosition = partyPosition;
    
    // Step 3: Determine article stance (-10 to +10)
    const articleStance = determineArticleStance(article, analysis, dimension);
    context.articleStance = articleStance;
    
    // Step 4: Calculate deviation
    const deviation = Math.abs(articleStance - partyPosition);
    context.deviation = deviation;
    
    // Step 5: Check for flip-flop (large deviation from party position)
    if (deviation >= 8) {
      context.hasFlipFlop = true;
      context.flipFlopSeverity = 'major';
      context.flipFlopDetails = `${politicianName} (${party}) took a position ${deviation.toFixed(1)} points away from their party's stance on ${dimension.replace('_score', '')}`;
      context.needsHumanReview = true;
      context.reviewReason = `MAJOR FLIP-FLOP: TD position contradicts party by ${deviation.toFixed(1)} points`;
    } else if (deviation >= 5) {
      context.hasFlipFlop = true;
      context.flipFlopSeverity = 'moderate';
      context.flipFlopDetails = `Position moderately different from ${party} party line`;
      context.needsHumanReview = true;
      context.reviewReason = `MODERATE DEVIATION: Check if this is a genuine shift or political opportunism`;
    } else if (deviation >= 3) {
      context.hasFlipFlop = true;
      context.flipFlopSeverity = 'minor';
      context.flipFlopDetails = `Slight deviation from typical ${party} position`;
    }
    
    // Step 6: Check for suspicious timing
    const timingCheck = checkSuspiciousTiming(article);
    if (timingCheck.isSuspicious) {
      context.suspiciousTiming = true;
      context.timingDetails = timingCheck.details;
      context.needsHumanReview = true;
      context.reviewReason = (context.reviewReason || '') + ` | SUSPICIOUS TIMING: ${timingCheck.details}`;
    }
    
    return context;
    
  } catch (error) {
    console.error('Error checking historical context:', error);
    return context;
  }
}

/**
 * Detect which quiz dimension this article relates to
 */
function detectDimension(article: any): string | null {
  const text = (article.title + ' ' + article.content).toLowerCase();
  
  for (const [topic, dimension] of Object.entries(TOPIC_TO_DIMENSION)) {
    if (text.includes(topic)) {
      return dimension;
    }
  }
  
  return null;
}

/**
 * Determine the article's stance on the dimension (-10 to +10)
 */
function determineArticleStance(article: any, analysis: any, dimension: string): number {
  const text = (article.title + ' ' + article.content).toLowerCase();
  
  // Map dimensions to positive/negative indicators
  const stanceIndicators: Record<string, { positive: string[], negative: string[] }> = {
    economic_score: {
      positive: ['increase spending', 'higher taxes', 'public investment', 'state intervention'],
      negative: ['cut spending', 'lower taxes', 'privatization', 'free market']
    },
    social_score: {
      positive: ['liberal', 'progressive', 'rights', 'equality', 'freedom'],
      negative: ['conservative', 'traditional', 'family values', 'restrict']
    },
  cultural_score: {
    positive: ['restrict immigration', 'border control', 'national identity', 'irish first', 
               'immigration numbers too high', 'migration numbers', 'control immigration',
               'limit immigration', 'reduce immigration', 'concerns about migration',
               'fragile', 'riots', 'arson', 'crisis'], // Anti-immigration = positive on cultural axis
    negative: ['welcoming', 'multicultural', 'diversity', 'open borders', 'refugee council',
               'compassionate', 'humanitarian', 'protect refugees', 'welcome asylum seekers']
  },
    globalism_score: {
      positive: ['pro-eu', 'international', 'cooperation', 'global'],
      negative: ['anti-eu', 'sovereignty', 'national', 'independence']
    },
    environmental_score: {
      positive: ['green', 'climate action', 'renewable', 'sustainability'],
      negative: ['delay climate', 'fossil', 'economic priority']
    },
    authority_score: {
      positive: ['law and order', 'police powers', 'security', 'tough on crime'],
      negative: ['civil liberties', 'reform gardai', 'accountability']
    },
    welfare_score: {
      positive: ['increase welfare', 'social protection', 'universal', 'support vulnerable'],
      negative: ['cut welfare', 'means testing', 'work requirements']
    },
    technocratic_score: {
      positive: ['expert advice', 'evidence-based', 'data-driven', 'scientific'],
      negative: ['common sense', 'people know best', 'elites']
    }
  };
  
  const indicators = stanceIndicators[dimension];
  if (!indicators) return 0;
  
  const positiveMatches = indicators.positive.filter(phrase => text.includes(phrase)).length;
  const negativeMatches = indicators.negative.filter(phrase => text.includes(phrase)).length;
  
  // Calculate stance based on matches
  if (positiveMatches > negativeMatches) {
    return Math.min(10, positiveMatches * 3);
  } else if (negativeMatches > positiveMatches) {
    return Math.max(-10, negativeMatches * -3);
  }
  
  return 0; // Neutral
}

/**
 * Check for suspicious timing (after elections, riots, polls)
 */
function checkSuspiciousTiming(article: any): { isSuspicious: boolean; details?: string } {
  const publishedDate = new Date(article.published_date);
  const now = new Date();
  const daysSincePublished = Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const text = (article.title + ' ' + article.content).toLowerCase();
  
  // Check for keywords indicating political pressure
  const pressureIndicators = [
    { keyword: 'riot', days: 14, message: 'Shortly after riots - potential knee-jerk reaction' },
    { keyword: 'spoiled vote', days: 30, message: 'After election protest - possible political opportunism' },
    { keyword: 'poll', days: 7, message: 'During polling period - may be responding to numbers' },
    { keyword: 'election', days: 90, message: 'During election period - possible pandering' }
  ];
  
  for (const indicator of pressureIndicators) {
    if (text.includes(indicator.keyword) && daysSincePublished <= indicator.days) {
      return {
        isSuspicious: true,
        details: indicator.message
      };
    }
  }
  
  return { isSuspicious: false };
}

/**
 * Get adjustment to consistency score based on flip-flop
 */
export function getFlipFlopPenalty(context: HistoricalContext): number {
  switch (context.flipFlopSeverity) {
    case 'major':
      return -40; // Massive penalty for major flip-flop
    case 'moderate':
      return -20; // Significant penalty
    case 'minor':
      return -5;  // Small penalty
    default:
      return 0;
  }
}

export const HistoricalContextChecker = {
  checkHistoricalContext,
  getFlipFlopPenalty
};

