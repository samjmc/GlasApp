/**
 * Derived scores: pillars, overall and ranks, recomputed from the Oireachtas facts. Runs
 * after every parliament sync and pipeline batch, and on the admin trigger. Party scores
 * are not stored: the API computes them on read from the members' overall scores.
 */
import { loadDebateScores } from './debateInputs';
import { computePartyScores } from './party';
import * as repo from './repository';
import { computeRollup } from './rollup';

export interface RecalculateSummary {
  tds: number;
  /** Parties with at least one ranked member. */
  parties: number;
}

export async function recalculateAll(): Promise<RecalculateSummary> {
  const inputs = await repo.rollupInputs(await loadDebateScores());
  const results = computeRollup(inputs);
  await repo.writeRollup(results);
  const partyOf = new Map(inputs.map((i) => [i.tdId, i.party]));
  const parties = computePartyScores(results.map((r) => ({ party: partyOf.get(r.tdId) ?? null, overallScore: r.overallScore })));
  return { tds: results.length, parties: parties.filter((p) => p.overallScore !== null).length };
}
