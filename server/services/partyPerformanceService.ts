/**
 * Party Performance Service
 * Aggregates TD scores to produce party-level metrics for the home page.
 */

import { supabaseDb as supabase } from '../db.js';

interface PartyScoreAverages {
  partyName: string;
  partyId: number;
  tdCount: number;
  avgOverall: number;
  avgTransparency: number;
  avgEffectiveness: number;
  avgIntegrity: number;
  avgConsistency: number;
  avgService: number;
}

interface UpdateStats {
  partiesUpdated: number;
  errors: number;
  details: Array<{ party: string; error: string }>;
}

async function fetchActiveTDAggregates(): Promise<PartyScoreAverages[]> {
  if (!supabase) {
    throw new Error('Supabase client not initialised');
  }

  const { data: tds, error } = await supabase
    .from('td_scores')
    .select(
      'party, overall_elo, transparency_elo, effectiveness_elo, integrity_elo, consistency_elo, constituency_service_elo'
    )
    .eq('is_active', true)
    .not('party', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch TD scores: ${error.message}`);
  }

  if (!tds || tds.length === 0) {
    return [];
  }

  const groups = new Map<string, typeof tds>();
  for (const td of tds) {
    if (!td.party) continue;
    if (!groups.has(td.party)) {
      groups.set(td.party, []);
    }
    groups.get(td.party)!.push(td);
  }

  const aggregates: PartyScoreAverages[] = [];

  for (const [partyName, partyTDs] of groups) {
    const { data: partyRecord, error: partyError } = await supabase
      .from('parties')
      .select('id')
      .eq('name', partyName)
      .single();

    if (partyError || !partyRecord) {
      throw new Error(`Unable to resolve party ID for ${partyName}`);
    }

    const tdCount = partyTDs.length;
    const avg = (key: keyof (typeof partyTDs)[number]) =>
      Math.round(
        partyTDs.reduce((sum, td) => sum + Number(td[key] ?? 1500), 0) / tdCount
      );

    aggregates.push({
      partyName,
      partyId: partyRecord.id,
      tdCount,
      avgOverall: avg('overall_elo'),
      avgTransparency: avg('transparency_elo'),
      avgEffectiveness: avg('effectiveness_elo'),
      avgIntegrity: avg('integrity_elo'),
      avgConsistency: avg('consistency_elo'),
      avgService: avg('constituency_service_elo')
    });
  }

  return aggregates;
}

async function upsertPartyScoreAverages(aggregates: PartyScoreAverages[]): Promise<UpdateStats> {
  if (!supabase) {
    throw new Error('Supabase client not initialised');
  }
  const stats: UpdateStats = {
    partiesUpdated: 0,
    errors: 0,
    details: []
  };

  for (const aggregate of aggregates) {
    try {
      const { data: existing, error: existingError } = await supabase
        .from('party_performance_scores')
        .select('id')
        .eq('party_id', aggregate.partyId)
        .eq('score_type', 'news_impact')
        .single();

      if (existingError && existingError.code !== 'PGRST116') {
        throw new Error(existingError.message);
      }

      const payload = {
        party_id: aggregate.partyId,
        score_type: 'news_impact',
        overall_score: aggregate.avgOverall,
        transparency_score: aggregate.avgTransparency,
        integrity_score: aggregate.avgIntegrity,
        policy_consistency_score: aggregate.avgConsistency,
        public_accountability_score: aggregate.avgService,
        pledge_fulfillment_score: aggregate.avgEffectiveness,
        calculated_at: new Date().toISOString()
      };

      if (existing) {
        await supabase
          .from('party_performance_scores')
          .update(payload)
          .eq('id', existing.id);
      } else {
        await supabase.from('party_performance_scores').insert(payload);
      }

      stats.partiesUpdated += 1;
      console.log(
        `   ✅ ${aggregate.partyName}: updated news impact score (TDs: ${aggregate.tdCount}, overall: ${aggregate.avgOverall})`
      );
    } catch (error: any) {
      stats.errors += 1;
      stats.details.push({
        party: aggregate.partyName,
        error: error.message ?? 'Unknown error'
      });
      console.error(`   ❌ Failed to update party score for ${aggregate.partyName}:`, error.message ?? error);
    }
  }

  return stats;
}

export const PartyPerformanceService = {
  async updateAllPartyScores(): Promise<UpdateStats> {
    if (!supabase) {
      return {
        partiesUpdated: 0,
        errors: 1,
        details: [{ party: 'all', error: 'Supabase client not initialised' }]
      };
    }

    try {
      const aggregates = await fetchActiveTDAggregates();

      if (aggregates.length === 0) {
        console.log('   ℹ️  No active TD scores found for party aggregation');
        return { partiesUpdated: 0, errors: 0, details: [] };
      }

      return await upsertPartyScoreAverages(aggregates);
    } catch (error: any) {
      console.error('   ❌ Unable to update party scores:', error.message ?? error);
      return {
        partiesUpdated: 0,
        errors: 1,
        details: [{ party: 'all', error: error.message ?? 'Unknown error' }]
      };
    }
  }
};

export type PartyPerformanceUpdateStats = UpdateStats;

