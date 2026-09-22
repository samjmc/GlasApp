/**
 * Derived scores: pillars, overall, ranks, trends and party aggregates, recomputed from
 * the stored ELOs. Runs after every pipeline batch and on the admin trigger.
 */
import { loadDebateScores } from './debateInputs';
import { computePartyScores } from './party';
import * as repo from './repository';
import { computeRollup } from './rollup';

export interface RecalculateSummary {
  tds: number;
  parties: number;
}

export async function recalculateAll(): Promise<RecalculateSummary> {
  const inputs = await repo.rollupInputs(await loadDebateScores());
  const results = computeRollup(inputs);
  await repo.writeRollup(results);
  await repo.writeTrends();
  const parties = computePartyScores(inputs);
  await repo.replacePartyScores(parties);
  return { tds: results.length, parties: parties.length };
}
