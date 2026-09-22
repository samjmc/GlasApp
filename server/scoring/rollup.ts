/**
 * Rollup: ELOs and raw inputs → the stored 0–100 pillars, overall score and ranks.
 * Pure. The repository feeds it rows and writes its results back.
 */
import { eloToPercent, normalizePercent, overallFromPillars, parliamentaryScore } from './weights';

export interface RollupInput {
  tdId: number;
  party: string | null;
  constituency: string | null;
  overallElo: number;
  /** Oral + written questions this term. NULL = no data. */
  questions: number | null;
  attendancePct: number | null;
  /** Debate subsystem performance score, 0–1 or 0–100. NULL = no debate record. */
  debateScore: number | null;
}

export interface RollupResult {
  tdId: number;
  newsScore: number;
  parliamentaryScore: number | null;
  debateScore: number | null;
  overallScore: number | null;
  nationalRank: number | null;
  partyRank: number | null;
  constituencyRank: number | null;
}

/** Sort key: overall score desc, then ELO desc, then id asc so ranks are stable. */
function byRank(a: { overallScore: number | null; overallElo: number; tdId: number }, b: typeof a): number {
  return (b.overallScore ?? -1) - (a.overallScore ?? -1) || b.overallElo - a.overallElo || a.tdId - b.tdId;
}

export function computeRollup(rows: RollupInput[]): RollupResult[] {
  const scored = rows.map((r) => {
    const news = eloToPercent(r.overallElo);
    const parliamentary = parliamentaryScore(r.questions, r.attendancePct);
    const debate = normalizePercent(r.debateScore);
    return {
      ...r,
      newsScore: news,
      parliamentaryScore: parliamentary,
      debateScore: debate,
      overallScore: overallFromPillars({ news, parliamentary, debate }),
    };
  });

  const rankable = scored.filter((r) => r.overallScore !== null);

  const national = new Map<number, number>();
  [...rankable].sort(byRank).forEach((r, i) => national.set(r.tdId, i + 1));

  const groupRank = (key: (r: (typeof rankable)[number]) => string | null) => {
    const ranks = new Map<number, number>();
    const groups = new Map<string, typeof rankable>();
    for (const r of rankable) {
      const k = key(r);
      if (k === null) continue;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
    groups.forEach((members) => {
      members.sort(byRank).forEach((r, i) => ranks.set(r.tdId, i + 1));
    });
    return ranks;
  };
  const party = groupRank((r) => r.party);
  const constituency = groupRank((r) => r.constituency);

  return scored.map((r) => ({
    tdId: r.tdId,
    newsScore: r.newsScore,
    parliamentaryScore: r.parliamentaryScore,
    debateScore: r.debateScore,
    overallScore: r.overallScore,
    nationalRank: national.get(r.tdId) ?? null,
    partyRank: party.get(r.tdId) ?? null,
    constituencyRank: constituency.get(r.tdId) ?? null,
  }));
}
