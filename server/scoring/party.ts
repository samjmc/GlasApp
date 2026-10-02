/**
 * Party aggregate: the mean overall score of the party's ranked members, computed on read.
 * Pure.
 *
 * An unranked member (the chair, or fewer than two measurable components) has no overall
 * score and says nothing about the party, so they are left out of the mean rather than
 * counted as 0. A party with no ranked member gets no score and no rank.
 */
import { sharedRanks } from './rollup';

export interface PartyInput {
  party: string | null;
  overallScore: number | null;
}

export interface PartyScore {
  /** Shared on ties; NULL when no member is ranked. */
  rank: number | null;
  party: string;
  /** Every active member. */
  memberCount: number;
  /** Members averaged. */
  rankedCount: number;
  overallScore: number | null;
}

export function computePartyScores(rows: PartyInput[]): PartyScore[] {
  const groups = new Map<string, { members: number; scores: number[] }>();
  for (const r of rows) {
    if (!r.party) continue;
    if (!groups.has(r.party)) groups.set(r.party, { members: 0, scores: [] });
    const g = groups.get(r.party)!;
    g.members += 1;
    if (r.overallScore !== null) g.scores.push(r.overallScore);
  }
  const parties = Array.from(groups.entries()).map(([party, g]) => ({
    party,
    memberCount: g.members,
    rankedCount: g.scores.length,
    overallScore: g.scores.length ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length) : null,
  }));
  const ranks = sharedRanks(
    parties.filter((p) => p.overallScore !== null).map((p): [string, number] => [p.party, p.overallScore as number]),
  );
  return parties
    .map((p) => ({ rank: ranks.get(p.party) ?? null, ...p }))
    .sort((a, b) => (b.overallScore ?? -1) - (a.overallScore ?? -1) || a.party.localeCompare(b.party));
}
