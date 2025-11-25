import { supabaseDb as supabase } from '../db.js';
import {
  IDEOLOGY_DIMENSIONS,
  type IdeologyDimension,
  emptyIdeologyVector,
  clampIdeologyValue,
} from '../constants/ideology';

interface PolicyVoteVector {
  policy_vote_id: number;
  option_key: string;
  weight: number;
  confidence: number;
  [key: string]: number | string;
}

export const UserIdeologyProfileService = {
  /**
   * Recalculate a user's ideological profile from their recorded policy vote responses.
   * Falls back to zeros if no vote vectors are available yet.
   */
  async recomputeUserProfile(userId: string): Promise<void> {
    if (!supabase) {
      console.error('❌ Supabase client not available for recomputeUserProfile');
      return;
    }

    const { data: responses, error: responseError } = await supabase
      .from('user_policy_vote_responses')
      .select('policy_vote_id, selected_option')
      .eq('user_id', userId);

    if (responseError) {
      console.error('❌ Failed to load user policy vote responses:', responseError.message);
      return;
    }

    if (!responses || responses.length === 0) {
      console.log(`📊 No policy vote responses found for user ${userId}, resetting to baseline`);
      await supabase.from('user_ideology_profiles').upsert(
        {
          user_id: userId,
          ...emptyIdeologyVector(),
          total_weight: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      return;
    }

    console.log(`🔄 Recomputing ideology profile for user ${userId} from ${responses.length} vote responses`);

    const policyVoteIds = Array.from(new Set(responses.map((response) => response.policy_vote_id)));
    if (policyVoteIds.length === 0) {
      console.warn(`⚠️ No unique policy vote IDs found for user ${userId}`);
      return;
    }

    const { data: vectors, error: vectorError } = await supabase
      .from('policy_vote_option_vectors')
      .select('*')
      .in('policy_vote_id', policyVoteIds);

    if (vectorError) {
      console.error('❌ Failed to load policy vote ideology vectors:', vectorError.message);
      return;
    }

    if (!vectors || vectors.length === 0) {
      console.warn(`⚠️ No ideology vectors found for policy votes: ${policyVoteIds.join(', ')}`);
      return;
    }

    const vectorMap = new Map<string, PolicyVoteVector>();
    vectors.forEach((vector) => {
      const key = `${vector.policy_vote_id}:${vector.option_key}`;
      vectorMap.set(key, vector as PolicyVoteVector);
    });

    const totals = emptyIdeologyVector();
    let totalWeight = 0;
    let matchedResponses = 0;

    for (const response of responses) {
      const key = `${response.policy_vote_id}:${response.selected_option}`;
      const vector = vectorMap.get(key);
      if (!vector) {
        console.warn(`⚠️ No vector found for ${key}`);
        continue;
      }

      const weight = Number(vector.weight ?? 1) * Number(vector.confidence ?? 1);
      if (!Number.isFinite(weight) || weight <= 0) {
        console.warn(`⚠️ Invalid weight for ${key}: ${weight}`);
        continue;
      }

      matchedResponses++;
      totalWeight += weight;

      for (const dimension of IDEOLOGY_DIMENSIONS) {
        const value = Number(vector[dimension]);
        if (Number.isFinite(value)) {
          totals[dimension] += value * weight;
        }
      }
    }

    console.log(`✅ Matched ${matchedResponses}/${responses.length} responses with vectors, total weight: ${totalWeight}`);

    const hasData = totalWeight > 0;
    const averages = emptyIdeologyVector();

    if (hasData) {
      for (const dimension of IDEOLOGY_DIMENSIONS) {
        averages[dimension] = clampIdeologyValue(totals[dimension] / totalWeight);
      }
      console.log(`📊 Computed ideology averages:`, averages);
    } else {
      console.warn(`⚠️ No valid data to compute averages for user ${userId}`);
    }

    const { error: upsertError } = await supabase
      .from('user_ideology_profiles')
      .upsert(
        {
          user_id: userId,
          ...averages,
          total_weight: hasData ? totalWeight : 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    if (upsertError) {
      console.error('❌ Failed to upsert user ideology profile:', upsertError.message);
    } else {
      console.log(`✅ Successfully updated ideology profile for user ${userId}`);
    }
  },
};

