/**
 * Party aggregate: mean member ELO, converted with the one ELO → percent function.
 * Pure. Replaces the two identical copies that used to live in newsToTDScoringService
 * and partyPerformanceService.
 */
import { eloToPercent } from './weights';

export interface PartyInput {
  party: string | null;
  overallElo: number;
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
    if (!r.party) continue;
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
