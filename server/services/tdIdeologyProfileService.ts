import { supabaseDb as supabase } from '../db.js';
import {
  IDEOLOGY_DIMENSIONS,
  clampIdeologyValue,
  emptyIdeologyVector,
  type IdeologyDimension,
} from '../constants/ideology';
import { PersonalRankingsService } from './personalRankingsService.js';

interface IdeologyAdjustments {
  [dimension: string]: number;
}

interface AdjustmentMetadata {
  sourceType: 'article' | 'debate' | 'manual';
  sourceId?: number | null;
  policyTopic?: string | null;
  weight?: number;
  confidence?: number;
  sourceDate?: Date | string; // For time decay calculation
  sourceReliability?: number; // 0-1, for source quality weighting (RTÉ=0.9, tabloid=0.5, social=0.3)
}

interface TDProfile {
  politician_name: string;
  constituency: string | null;
  party: string | null;
  total_weight: number;
  [dimension: string]: any;
}

async function fetchTDMeta(politicianName: string): Promise<{ constituency: string | null; party: string | null }> {
  if (!supabase) {
    return { constituency: null, party: null };
  }

  const { data, error } = await supabase
    .from('td_scores')
    .select('politician_name, constituency, party')
    .eq('politician_name', politicianName)
    .maybeSingle();

  if (error) {
    console.warn(`⚠️ Unable to fetch TD metadata for ${politicianName}: ${error.message}`);
    return { constituency: null, party: null };
  }

  return {
    constituency: data?.constituency ?? null,
    party: data?.party ?? null,
  };
}

async function ensureTDProfile(politicianName: string): Promise<TDProfile | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('td_ideology_profiles')
    .select('*')
    .eq('politician_name', politicianName)
    .maybeSingle();

  if (error) {
    console.error('❌ Failed to load TD ideology profile:', error.message);
    return null;
  }

  if (data) {
    return data as TDProfile;
  }

  const meta = await fetchTDMeta(politicianName);

  // Initialize profile: Independents start at 0, others start from party baseline
  let initialVector = emptyIdeologyVector();
  
  // Check if this is an Independent (not "Independent Ireland" party)
  // "Independent Ireland" is a registered party and should get party baseline
  const isIndependent = !meta.party || 
    meta.party.toLowerCase() === 'independent' ||
    meta.party.toLowerCase() === 'independents' ||
    (meta.party.toLowerCase().includes('independent') && 
     !meta.party.toLowerCase().includes('ireland'));
  
  if (!isIndependent && meta.party) {
    // Fetch party baseline from parties table
    const { data: partyData, error: partyError } = await supabase
      .from('parties')
      .select('economic_score, social_score, cultural_score, globalism_score, environmental_score, authority_score, welfare_score, technocratic_score')
      .eq('name', meta.party)
      .maybeSingle();
    
    if (!partyError && partyData) {
      // Map party scores to ideology dimensions
      initialVector = {
        economic: clampIdeologyValue(Number(partyData.economic_score) || 0),
        social: clampIdeologyValue(Number(partyData.social_score) || 0),
        cultural: clampIdeologyValue(Number(partyData.cultural_score) || 0),
        globalism: clampIdeologyValue(Number(partyData.globalism_score) || 0),
        environmental: clampIdeologyValue(Number(partyData.environmental_score) || 0),
        authority: clampIdeologyValue(Number(partyData.authority_score) || 0),
        welfare: clampIdeologyValue(Number(partyData.welfare_score) || 0),
        technocratic: clampIdeologyValue(Number(partyData.technocratic_score) || 0),
      };
      console.log(`✅ Initialized ${politicianName} profile from ${meta.party} baseline:`, {
        economic: initialVector.economic,
        social: initialVector.social,
        welfare: initialVector.welfare,
      });
    } else {
      console.log(`⚠️  Could not find party baseline for ${meta.party}, starting at 0`);
      if (partyError) {
        console.error(`   Error: ${partyError.message}`);
      }
    }
  } else {
    console.log(`ℹ️  ${politicianName} is an Independent, starting profile at 0`);
  }

  const newProfile = {
    politician_name: politicianName,
    constituency: meta.constituency,
    party: meta.party,
    ...initialVector,
    total_weight: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: insertError } = await supabase.from('td_ideology_profiles').insert(newProfile);
  if (insertError) {
    console.error('❌ Failed to seed TD ideology profile:', insertError.message);
    return null;
  }

  return newProfile as TDProfile;
}

async function upsertTDProfile(profile: TDProfile): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from('td_ideology_profiles')
    .upsert({
      politician_name: profile.politician_name,
      constituency: profile.constituency,
      party: profile.party,
      total_weight: profile.total_weight,
      updated_at: new Date().toISOString(),
      ...IDEOLOGY_DIMENSIONS.reduce((acc, dimension) => {
        acc[dimension] = profile[dimension];
        return acc;
      }, {} as Record<IdeologyDimension, number>),
    })
    .eq('politician_name', profile.politician_name);

  if (error) {
    console.error('❌ Failed to upsert TD ideology profile:', error.message);
  }
}

async function logTDEvent(
  politicianName: string,
  adjustments: IdeologyAdjustments,
  metadata: AdjustmentMetadata,
): Promise<void> {
  if (!supabase) return;

  // Handle source_id - convert UUID strings to null for events table (which expects bigint)
  // We store the actual ID in the source-specific tables (debate_ideology_analysis, article_td_scores)
  let sourceIdForEvents: number | null = null;
  if (metadata.sourceId !== null && metadata.sourceId !== undefined) {
    // If it's a number, use it; if it's a UUID string, set to null (we track it elsewhere)
    if (typeof metadata.sourceId === 'number') {
      sourceIdForEvents = metadata.sourceId;
    } else {
      // UUID string - don't store in events table (bigint can't hold UUID)
      // The actual source ID is tracked in debate_ideology_analysis or article_td_scores
      sourceIdForEvents = null;
    }
  }

  const payload = {
    politician_name: politicianName,
    source_type: metadata.sourceType,
    source_id: sourceIdForEvents,
    policy_topic: metadata.policyTopic ?? null,
    weight: metadata.weight ?? 1,
    confidence: metadata.confidence ?? 1,
    created_at: new Date().toISOString(),
    ...emptyIdeologyVector(),
  };

  for (const dimension of IDEOLOGY_DIMENSIONS) {
    const value = adjustments[dimension];
    if (typeof value === 'number' && Number.isFinite(value)) {
      payload[dimension] = value;
    }
  }

  const { error } = await supabase.from('td_ideology_events').insert(payload);
  if (error) {
    console.error('⚠️ Failed to log TD ideology event:', error.message);
  }
}

async function recomputePartyProfile(party: string | null): Promise<void> {
  if (!supabase || !party) return;

  const { data, error } = await supabase
    .from('td_ideology_profiles')
    .select('*')
    .eq('party', party);

  if (error) {
    console.error('⚠️ Failed to fetch TD ideology profiles for party:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    await supabase
      .from('party_ideology_profiles')
      .upsert(
        {
          party,
          ...emptyIdeologyVector(),
          total_weight: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'party' },
      );
    return;
  }

  const totals = emptyIdeologyVector();
  let totalWeight = 0;

  for (const profile of data) {
    const weight = Number(profile.total_weight) > 0 ? Number(profile.total_weight) : 1;
    totalWeight += weight;
    for (const dimension of IDEOLOGY_DIMENSIONS) {
      const value = Number(profile[dimension]);
      if (Number.isFinite(value)) {
        totals[dimension] += value * weight;
      }
    }
  }

  const averages = emptyIdeologyVector();
  if (totalWeight > 0) {
    for (const dimension of IDEOLOGY_DIMENSIONS) {
      averages[dimension] = clampIdeologyValue(totals[dimension] / totalWeight);
    }
  }

  await supabase
    .from('party_ideology_profiles')
    .upsert(
      {
        party,
        ...averages,
        total_weight: totalWeight,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'party' },
    );
}

/**
 * Calculate time decay factor for article age
 * Recent articles have more weight than old ones
 * Half-life: 180 days (6 months)
 */
function calculateTimeDecayFactor(sourceDate?: Date | string): number {
  if (!sourceDate) return 1.0; // No date = assume recent
  
  const now = new Date();
  const articleDate = typeof sourceDate === 'string' ? new Date(sourceDate) : sourceDate;
  const daysSince = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60 * 24);
  
  // Exponential decay with 180-day half-life
  const halfLifeDays = 180;
  const decayFactor = Math.pow(0.5, daysSince / halfLifeDays);
  
  // Minimum of 0.05 (even very old articles retain some signal)
  return Math.max(0.05, decayFactor);
}

/**
 * Calculate minimal adaptive adjustment for TD ideology dimensions
 * 
 * Multi-layer scoring approach:
 * 1. LLM provides raw signal (±0.5 max)
 * 2. Confidence/evidence quality weighting (metadata.weight × metadata.confidence × sourceReliability)
 * 3. Time decay (older articles have less impact)
 * 4. Adaptive scaling (more evidence = smaller adjustments)
 * 5. Extremity penalty (harder to move at edges)
 * 6. Direction penalty (harder to move toward extremes)
 * 
 * Expected range: ±0.05 to ±0.15 per article typically
 */
function calculateMinimalAdaptiveAdjustment(
  currentValue: number,
  rawDelta: number,
  totalWeight: number,
  effectiveWeight: number = 1.0,
  timeDecayFactor: number = 1.0
): number {
  // rawDelta now comes from LLM at ±0.5 max (already calibrated)
  // effectiveWeight includes confidence × stance_strength × sourceReliability (0.2 to 1.0 typically)
  
  // Apply evidence quality weighting
  const weightedDelta = rawDelta * effectiveWeight;
  
  // Apply time decay (older = less impact)
  const timedDelta = weightedDelta * timeDecayFactor;
  
  // Adaptive scaling: Diminishing returns as evidence accumulates
  // Uses logarithmic scaling for smooth convergence
  const scalingFactor = 1 / (1 + Math.log10(1 + totalWeight));
  
  // Extremity penalty: Harder to move values at extreme positions
  // At ±0: penalty = 1.0 (easy to move)
  // At ±5: penalty = 0.75
  // At ±10: penalty = 0.5 (very hard to move)
  const extremityPenalty = 1 - (Math.abs(currentValue) / 10) * 0.5;
  
  // Direction-specific resistance (harder to move further from center)
  let directionPenalty = 1.0;
  if ((rawDelta > 0 && currentValue > 5) || (rawDelta < 0 && currentValue < -5)) {
    // Moving toward extreme: additional penalty
    directionPenalty = 0.7;
  }
  
  // Combine all factors
  const adjustedDelta = timedDelta * scalingFactor * extremityPenalty * directionPenalty;
  
  // Hard cap: no single article can move more than ±0.2
  return Math.max(-0.2, Math.min(0.2, adjustedDelta));
}

export const TDIdeologyProfileService = {
  async applyAdjustments(
    politicianName: string,
    adjustments: IdeologyAdjustments,
    metadata: AdjustmentMetadata,
  ): Promise<void> {
    if (!supabase) return;
    
    // Calculate effective weight: weight × confidence × sourceReliability
    const effectiveWeight = 
      (metadata.weight ?? 1) * 
      (metadata.confidence ?? 1) * 
      (metadata.sourceReliability ?? 1);
      
    if (!Number.isFinite(effectiveWeight) || effectiveWeight <= 0) {
      return;
    }

    const profile = await ensureTDProfile(politicianName);
    if (!profile) return;
    
    // Calculate time decay factor
    const timeDecayFactor = calculateTimeDecayFactor(metadata.sourceDate);

    // Apply minimal, adaptive adjustments to each dimension
    for (const dimension of IDEOLOGY_DIMENSIONS) {
      const rawDelta = Number(adjustments[dimension]);
      if (!Number.isFinite(rawDelta) || rawDelta === 0) {
        continue;
      }
      
      const current = Number(profile[dimension]) || 0;
      const totalWeight = Number(profile.total_weight) || 0;
      
      // Calculate minimal adaptive adjustment with all factors
      const minimalDelta = calculateMinimalAdaptiveAdjustment(
        current,
        rawDelta,
        totalWeight,
        effectiveWeight,
        timeDecayFactor
      );
      
      const adjusted = current + minimalDelta;
      profile[dimension] = clampIdeologyValue(adjusted);
      
      // Log if adjustment was significant
      if (Math.abs(minimalDelta) > 0.01) {
        const decayNote = timeDecayFactor < 0.9 ? ` [decay: ${timeDecayFactor.toFixed(2)}]` : '';
        console.log(`   📊 ${dimension}: ${current.toFixed(2)} → ${adjusted.toFixed(2)} (${minimalDelta >= 0 ? '+' : ''}${minimalDelta.toFixed(3)}) [weight: ${effectiveWeight.toFixed(2)}${decayNote}]`);
      }
    }

    profile.total_weight = Math.max(0, Number(profile.total_weight) + effectiveWeight);
    profile.updated_at = new Date().toISOString();

    await logTDEvent(politicianName, adjustments, metadata);
    await upsertTDProfile(profile);
    await recomputePartyProfile(profile.party ?? null);
    PersonalRankingsService.invalidateTDIdeologyCache(politicianName);
  },
};


