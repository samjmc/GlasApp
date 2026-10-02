/**
 * Rollup: the measured components → the stored 0–100 pillars, overall score and ranks.
 * Pure. The repository feeds it rows and writes its results back.
 *
 * Whether a TD was expected to produce an input (questions while in government office,
 * attendance during a documented absence) is decided upstream in server/parliament: it
 * arrives here as NULL. NULL means "not expected / not measurable", never 0.
 */
import type { ScoreComponents } from '@shared/scoresApi';
import { MIN_COMPONENTS_FOR_RANK, normalizePercent, overallFromPillars, parliamentaryScore } from './weights';

export interface RollupInput {
  tdId: number;
  party: string | null;
  constituency: string | null;
  /** Oral + written questions this term. */
  questions: number | null;
  /** Dáil vote attendance, 0–100. */
  attendancePct: number | null;
  /** Committee attendance, 0–100. NULL under 10 sittings, or with no committee. */
  committeeAttendancePct: number | null;
  /** Debate participation, 0–1 or 0–100. NULL = no debate record. */
  debateScore: number | null;
  /** Holds the chair (Ceann Comhairle). */
  isPresiding: boolean;
  /**
   * Questions this TD was expected to ask (server/parliament, pro-rated to their eligible
   * time). NULL = not expected, so the questions component is NULL. Absent = no expectation
   * computed yet: the whole-term benchmark applies.
   */
  questionsExpected?: number | null;
  /**
   * The attendance that scores full marks for this TD (lower for time in a leadership role).
   * Absent or NULL: ATTENDANCE_BENCHMARK.
   */
  attendanceBenchmark?: number | null;
}

export interface RollupResult {
  tdId: number;
  parliamentaryScore: number | null;
  debateScore: number | null;
  overallScore: number | null;
  nationalRank: number | null;
  partyRank: number | null;
  constituencyRank: number | null;
}

/** Oral + written questions; NULL when neither count is known. */
export function questionsAsked(oral: number | null, written: number | null): number | null {
  return oral === null && written === null ? null : (oral ?? 0) + (written ?? 0);
}

/**
 * The four components as the score uses them. The chair is expected to produce none of
 * them; server/parliament already NULLs most, and this is the backstop for the rest
 * (question counts default to 0, committee attendance is measured for anyone).
 */
export function scoredComponents(i: {
  questions: number | null;
  attendancePct: number | null;
  committeeAttendancePct: number | null;
  /** 0–100. */
  debate: number | null;
  isPresiding: boolean;
}): ScoreComponents {
  if (i.isPresiding) return { questions: null, attendance: null, committees: null, debate: null };
  return { questions: i.questions, attendance: i.attendancePct, committees: i.committeeAttendancePct, debate: i.debate };
}

/** Competition ranking, highest first: equal scores share a rank and the next one skips (1, 2, 2, 4). */
export function sharedRanks<K>(entries: Array<[K, number]>): Map<K, number> {
  const sorted = entries.slice().sort((a, b) => b[1] - a[1]);
  const ranks = new Map<K, number>();
  sorted.forEach(([key, score], i) => {
    const previous = sorted[i - 1];
    ranks.set(key, previous && previous[1] === score ? ranks.get(previous[0])! : i + 1);
  });
  return ranks;
}

export function computeRollup(rows: RollupInput[]): RollupResult[] {
  const scored = rows.map((r) => {
    const notExpected = r.questionsExpected === null;
    const c = scoredComponents({ ...r, questions: notExpected ? null : r.questions, debate: normalizePercent(r.debateScore) });
    const parliamentary = parliamentaryScore(c.questions, c.attendance, c.committees, {
      questionsExpected: r.questionsExpected,
      attendanceBenchmark: r.attendanceBenchmark,
    });
    const measured = [c.questions, c.attendance, c.committees, c.debate].filter((v) => v !== null).length;
    return {
      tdId: r.tdId,
      party: r.party,
      constituency: r.constituency,
      parliamentaryScore: parliamentary,
      debateScore: c.debate,
      overallScore: measured >= MIN_COMPONENTS_FOR_RANK ? overallFromPillars({ parliamentary, debate: c.debate }) : null,
    };
  });

  const rankable = scored.filter((r): r is (typeof scored)[number] & { overallScore: number } => r.overallScore !== null);

  const national = sharedRanks(rankable.map((r): [number, number] => [r.tdId, r.overallScore]));

  const groupRank = (key: (r: (typeof rankable)[number]) => string | null) => {
    const groups = new Map<string, Array<[number, number]>>();
    for (const r of rankable) {
      const k = key(r);
      if (k === null) continue;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push([r.tdId, r.overallScore]);
    }
    const ranks = new Map<number, number>();
    groups.forEach((members) => sharedRanks(members).forEach((rank, tdId) => ranks.set(tdId, rank)));
    return ranks;
  };
  const party = groupRank((r) => r.party);
  const constituency = groupRank((r) => r.constituency);

  return scored.map((r) => ({
    tdId: r.tdId,
    parliamentaryScore: r.parliamentaryScore,
    debateScore: r.debateScore,
    overallScore: r.overallScore,
    nationalRank: national.get(r.tdId) ?? null,
    partyRank: party.get(r.tdId) ?? null,
    constituencyRank: constituency.get(r.tdId) ?? null,
  }));
}
