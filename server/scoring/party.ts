/**
 * Party aggregate: mean ELO of the members who have been scored, converted with the one
 * ELO → percent function. Pure.
 *
 * A member with no scored article still sits at the 1500 baseline, so counting them
 * would pull every party toward 50 and give a party with no evidence at all a score of
 * exactly 50. Unscored members are left out, and a party with none gets no aggregate.
 * `memberCount` is the number of members averaged, not the party's size.
 */
import { eloToPercent } from './weights';

export interface PartyInput {
  party: string | null;
  overallElo: number;
  /** Articles scored for this member; 0 = never scored. */
  newsStories: number;
}

export interface PartyScore {
  party: string;
  memberCount: number;
  avgElo: number;
  overallScore: number;
}

export function computePartyScores(rows: PartyInput[]): PartyScore[] {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.party || r.newsStories <= 0) continue;
    if (!groups.has(r.party)) groups.set(r.party, []);
    groups.get(r.party)!.push(r.overallElo);
  }
  return Array.from(groups.entries())
    .map(([party, elos]) => {
      const avgElo = Math.round(elos.reduce((a, b) => a + b, 0) / elos.length);
      return { party, memberCount: elos.length, avgElo, overallScore: eloToPercent(avgElo) };
    })
    .sort((a, b) => b.avgElo - a.avgElo || a.party.localeCompare(b.party));
}
