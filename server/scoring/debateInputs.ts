/**
 * The debate pillar's input: how often each TD spoke in Dáil debates, measured from the
 * Official Report and relative to the 75th percentile of active TDs (see
 * server/parliament/metrics.ts). TDs who are not measurable — the chair, or a member for
 * too few sitting days — are absent, so the pillar drops out for them instead of scoring 0.
 */
import { allStats } from '../parliament/repository';
import { debateScores } from '../parliament/metrics';

/** td id → participation as a 0–1 fraction (the rollup normalises). */
export async function loadDebateScores(): Promise<Map<number, number>> {
  return debateScores(await allStats());
}
