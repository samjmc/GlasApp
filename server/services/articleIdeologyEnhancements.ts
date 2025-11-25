/**
 * Article Ideology Enhancements Service
 * 
 * Applies political science enhancements to news article ideology scoring:
 * - Party discipline detection
 * - Issue salience weighting
 * - Advanced consistency tracking
 * - Rhetorical vs substantive classification
 * - Opposition advocacy detection
 * - Government vs opposition context
 */

import { supabaseDb as supabase } from '../db.js';
import { IDEOLOGY_DIMENSIONS } from '../constants/ideology.js';

// Issue salience mapping - same as debates
export const ISSUE_SALIENCE: Record<string, Record<string, number>> = {
  welfare: {
    welfare: 1.0,
    social: 0.8,
    economic: 0.6,
    cultural: 0.2,
    authority: 0.3,
    environmental: 0.2,
    globalism: 0.3,
    technocratic: 0.4,
  },
  immigration: {
    cultural: 1.0,
    globalism: 0.9,
    welfare: 0.5,
    social: 0.4,
    economic: 0.3,
    authority: 0.7,
    environmental: 0.2,
    technocratic: 0.3,
  },
  taxation: {
    economic: 1.0,
    welfare: 0.7,
    social: 0.3,
    cultural: 0.2,
    authority: 0.3,
    environmental: 0.3,
    globalism: 0.4,
    technocratic: 0.5,
  },
  housing: {
    economic: 0.8,
    welfare: 0.7,
    social: 0.6,
    cultural: 0.2,
    authority: 0.4,
    environmental: 0.5,
    globalism: 0.2,
    technocratic: 0.4,
  },
  healthcare: {
    welfare: 0.9,
    social: 0.8,
    economic: 0.6,
    cultural: 0.2,
    authority: 0.4,
    environmental: 0.2,
    globalism: 0.3,
    technocratic: 0.6,
  },
  education: {
    social: 0.9,
    economic: 0.6,
    welfare: 0.5,
    cultural: 0.4,
    authority: 0.5,
    environmental: 0.2,
    globalism: 0.3,
    technocratic: 0.7,
  },
  environment: {
    environmental: 1.0,
    economic: 0.7,
    technocratic: 0.8,
    globalism: 0.6,
    social: 0.4,
    cultural: 0.3,
    authority: 0.4,
    welfare: 0.3,
  },
  justice: {
    authority: 1.0,
    social: 0.7,
    cultural: 0.5,
    economic: 0.3,
    welfare: 0.4,
    environmental: 0.2,
    globalism: 0.3,
    technocratic: 0.5,
  },
  default: {
    economic: 0.5,
    social: 0.5,
    cultural: 0.5,
    authority: 0.5,
    environmental: 0.5,
    welfare: 0.5,
    globalism: 0.5,
    technocratic: 0.5,
  },
};

interface PartyDisciplineContext {
  isGovernmentTD: boolean;
  isOppositionTD: boolean;
  isDefendingPartyPolicy: boolean;
  isOpposingPartyPolicy: boolean;
  isRebellion: boolean;
  isCrossParty: boolean;
}

interface ConsistencyCheck {
  hasContradiction: boolean;
  penalty: number;
  reason: string;
}

/**
 * Determine party discipline context for article
 */
export async function determinePartyDisciplineContext(
  politicianName: string,
  tdParty: string | null,
  tdRole: string | null,
  stance: 'support' | 'oppose' | 'neutral' | 'unclear',
  policyTopic: string,
  policyDirection?: 'progressive' | 'conservative' | 'centrist' | 'technical',
): Promise<PartyDisciplineContext> {
  if (!supabase || !tdParty) {
    return {
      isGovernmentTD: false,
      isOppositionTD: false,
      isDefendingPartyPolicy: false,
      isOpposingPartyPolicy: false,
      isRebellion: false,
      isCrossParty: false,
    };
  }

  // Determine if TD is in government (check for Minister role or government party)
  const isGovernmentTD = tdRole?.toLowerCase().includes('minister') ||
                        tdRole?.toLowerCase().includes('taoiseach') ||
                        tdRole?.toLowerCase().includes('tánaiste') ||
                        ['Fine Gael', 'Fianna Fáil', 'Green Party'].includes(tdParty);

  const isOppositionTD = !isGovernmentTD &&
                        !['Fine Gael', 'Fianna Fáil', 'Green Party'].includes(tdParty);

  // Determine if this is government policy (simplified - would need policy database)
  // For now, use heuristics: government TDs supporting policy = likely government policy
  const isDefendingPartyPolicy = isGovernmentTD && stance === 'support';
  const isOpposingPartyPolicy = isOppositionTD && stance === 'oppose';

  // Rebellion: Government TD opposing government policy
  const isRebellion = isGovernmentTD && stance === 'oppose';

  // Cross-party: Opposition TD supporting government policy
  const isCrossParty = isOppositionTD && stance === 'support';

  return {
    isGovernmentTD,
    isOppositionTD,
    isDefendingPartyPolicy,
    isOpposingPartyPolicy,
    isRebellion,
    isCrossParty,
  };
}

/**
 * Check consistency with previous statements on same topic
 */
export async function checkArticleConsistency(
  politicianName: string,
  policyTopic: string,
  currentDelta: Record<string, number>,
  articleDate: string | Date,
): Promise<ConsistencyCheck> {
  if (!supabase) {
    return { hasContradiction: false, penalty: 1.0, reason: '' };
  }

  // Get TD's current ideology profile
  const { data: profile } = await supabase
    .from('td_ideology_profiles')
    .select('*')
    .eq('politician_name', politicianName)
    .maybeSingle();

  if (!profile) {
    return { hasContradiction: false, penalty: 1.0, reason: '' };
  }

  // Check recent statements on same topic (within 180 days)
  const articleDateObj = new Date(articleDate);
  const cutoffDate = new Date(articleDateObj.getTime() - 180 * 24 * 60 * 60 * 1000);

  // Check in td_ideology_events (articles)
  const { data: recentEvents } = await supabase
    .from('td_ideology_events')
    .select('*')
    .eq('politician_name', politicianName)
    .eq('policy_topic', policyTopic)
    .eq('source_type', 'article')
    .gte('created_at', cutoffDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  if (!recentEvents || recentEvents.length === 0) {
    return { hasContradiction: false, penalty: 1.0, reason: '' };
  }

  // Check for contradictions in each dimension
  let hasContradiction = false;
  let contradictionSeverity = 0;
  let contradictionReason = '';

  for (const dimension of IDEOLOGY_DIMENSIONS) {
    const currentDeltaValue = currentDelta[dimension] || 0;

    for (const prevEvent of recentEvents) {
      const prevDelta = prevEvent[dimension] || 0;

      // Check if contradiction (opposite direction)
      if (Math.sign(currentDeltaValue) !== Math.sign(prevDelta) &&
          Math.abs(currentDeltaValue) > 0.1 &&
          Math.abs(prevDelta) > 0.1) {
        hasContradiction = true;
        const daysSince = (articleDateObj.getTime() - new Date(prevEvent.created_at).getTime()) / (24 * 60 * 60 * 1000);

        if (daysSince < 180) {
          contradictionSeverity += 1;
          if (daysSince < 30) {
            contradictionReason = `Recent contradiction (${Math.round(daysSince)} days ago) on ${dimension}`;
          } else {
            contradictionReason = `Contradiction (${Math.round(daysSince)} days ago) on ${dimension}`;
          }
        }
      }
    }
  }

  // Calculate penalty based on severity
  let penalty = 1.0;
  if (hasContradiction) {
    if (contradictionSeverity >= 3) {
      penalty = 0.4; // Strong contradiction - heavy penalty
    } else if (contradictionSeverity >= 2) {
      penalty = 0.5; // Moderate contradiction
    } else {
      penalty = 0.7; // Mild contradiction
    }
  }

  return {
    hasContradiction,
    penalty,
    reason: contradictionReason || '',
  };
}

/**
 * Apply issue salience weighting per dimension
 */
export function applyIssueSalienceWeighting(
  rawDelta: Record<string, number>,
  policyTopic: string,
): Record<string, number> {
  const salienceAdjustedDeltas: Record<string, number> = {};
  const topicSalience = ISSUE_SALIENCE[policyTopic.toLowerCase()] || ISSUE_SALIENCE.default;

  for (const dimension of IDEOLOGY_DIMENSIONS) {
    const rawDeltaValue = rawDelta[dimension] || 0;
    const salienceWeight = topicSalience[dimension] || 0.5;
    salienceAdjustedDeltas[dimension] = rawDeltaValue * salienceWeight;
  }

  return salienceAdjustedDeltas;
}

/**
 * Calculate enhanced effective weight with all political science adjustments
 */
export async function calculateEnhancedArticleWeight(
  politicianName: string,
  tdParty: string | null,
  tdRole: string | null,
  analysis: {
    stance: 'support' | 'oppose' | 'neutral' | 'unclear';
    strength: number;
    policy_topic: string;
    is_opposition_advocacy?: boolean;
    is_ideological_policy?: boolean;
    speech_classification?: 'rhetorical' | 'substantive' | 'mixed';
  },
  baseWeight: number,
): Promise<{ effectiveWeight: number; adjustments: string[] }> {
  let effectiveWeight = baseWeight;
  const adjustments: string[] = [];

  // Step 1: Rhetorical vs Substantive classification
  if (analysis.speech_classification === 'rhetorical') {
    effectiveWeight *= 0.3; // 70% reduction for rhetoric
    adjustments.push('rhetorical: 0.3×');
  } else if (analysis.speech_classification === 'substantive') {
    effectiveWeight *= 1.2; // 20% increase for substance
    adjustments.push('substantive: 1.2×');
  }

  // Step 2: Party Discipline Detection (CRITICAL)
  const partyContext = await determinePartyDisciplineContext(
    politicianName,
    tdParty,
    tdRole,
    analysis.stance,
    analysis.policy_topic,
  );

  if (partyContext.isRebellion) {
    effectiveWeight *= 1.5; // 50% increase - rebellion is significant!
    adjustments.push('rebellion: 1.5×');
  } else if (partyContext.isCrossParty) {
    effectiveWeight *= 1.3; // 30% increase - cross-party support
    adjustments.push('cross-party: 1.3×');
  } else if (partyContext.isDefendingPartyPolicy && partyContext.isGovernmentTD) {
    effectiveWeight *= 0.6; // 40% reduction - party discipline
    adjustments.push('party discipline: 0.6×');
  } else if (partyContext.isOpposingPartyPolicy && partyContext.isOppositionTD) {
    effectiveWeight *= 0.7; // 30% reduction - expected opposition
    adjustments.push('expected opposition: 0.7×');
  }

  // Step 3: Opposition Advocacy Detection
  if (analysis.is_opposition_advocacy && analysis.stance === 'oppose') {
    // Distinguish between advocacy (criticism) and substantive proposal
    if (analysis.is_ideological_policy && analysis.strength >= 4) {
      // Substantive opposition proposal - full weight
      adjustments.push('substantive opposition proposal: 1.0×');
    } else {
      // Opposition advocacy (criticism/calling out) - reduced weight
      effectiveWeight *= 0.6; // 40% reduction - expected behavior
      adjustments.push('opposition advocacy: 0.6×');
    }
  }

  // Step 4: Government vs Opposition Context (small adjustment)
  if (partyContext.isGovernmentTD) {
    effectiveWeight *= 0.95; // 5% reduction - institutional constraints
    adjustments.push('government context: 0.95×');
  }

  return { effectiveWeight, adjustments };
}

