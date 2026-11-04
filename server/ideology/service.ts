/**
 * TD and party profiles, recomputed from evidence. Each write drops the shared match inputs
 * (matches.ts). Users' profiles are in userProfile.ts, the full rebuild in rebuild.ts.
 */
import { IDEOLOGY_DIMENSIONS } from '@shared/ideology';
import type { IdeologyProfileRow } from '@shared/schema/quiz';
import { forgetMatchInputs } from './matches';
import { computeProfile, meanProfile, type Observation } from './model';
import { partyBaseline, partyKey } from './partyBaselines';
import * as repo from './repository';
import { PARTY_PRIOR_WEIGHT, TD_HALF_LIFE_DAYS } from './sources';

function tdPrior(party: string | null) {
  const baseline = partyBaseline(party);
  return baseline ? { vector: baseline, weight: PARTY_PRIOR_WEIGHT } : null;
}

export async function recomputeTdProfile(tdId: number, now = new Date()): Promise<repo.TdRef | null> {
  const td = await repo.findTd(tdId);
  if (!td) return null;
  const evidence = await repo.listTdEvidence(tdId);
  const observations: Observation[] = evidence.map((e) => ({
    vector: Object.fromEntries(IDEOLOGY_DIMENSIONS.filter((d) => e[d] !== null).map((d) => [d, e[d] as number])),
    weight: e.weight,
    observedAt: e.observedAt,
  }));
  await repo.upsertProfile('td', String(tdId), computeProfile(tdPrior(td.party), observations, { now, halfLifeDays: TD_HALF_LIFE_DAYS }));
  forgetMatchInputs();
  return td;
}

/** A party = the weighted mean of its TDs' profiles; its baseline when it has no TD profile. */
export async function recomputePartyProfile(party: string): Promise<void> {
  const key = partyKey(party);
  const [tds, profiles] = await Promise.all([repo.listActiveTds(), repo.listProfiles('td')]);
  const byId = new Map(profiles.map((p) => [p.subjectId, p]));
  const members = tds
    .filter((t) => t.party && partyKey(t.party) === key)
    .map((t) => byId.get(String(t.id)))
    .filter((p): p is IdeologyProfileRow => Boolean(p))
    .map((p) => ({ vector: repo.vectorOf(p), weight: PARTY_PRIOR_WEIGHT + p.totalWeight }));
  const vector = meanProfile(members) ?? partyBaseline(party);
  if (!vector) return;
  const totalWeight = members.reduce((s, m) => s + m.weight - PARTY_PRIOR_WEIGHT, 0);
  await repo.upsertProfile('party', party, { vector, totalWeight: Math.round(totalWeight * 100) / 100, evidenceCount: members.length });
  forgetMatchInputs();
}
