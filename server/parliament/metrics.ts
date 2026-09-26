/**
 * Pure maths over the parliament record. NULL means "not measurable" and is never 0:
 * a TD who holds the chair, or has not been a member long enough, is not scored on it.
 */
import type { DivisionVote, OfficeType } from '@shared/schema/parliament';
import { ATTENDANCE_BENCHMARK, QUESTIONS_BENCHMARK } from '../scoring/weights';

/** The API's own label for TDs with no party. "Independent Ireland" is a party and is NOT this. */
export const INDEPENDENT = 'Independent';
/** Below this, attendance is noise (a by-election TD's first week). */
export const MIN_DIVISIONS_FOR_ATTENDANCE = 10;
/** Below this, participation per sitting day is noise. */
export const MIN_SITTING_DAYS = 10;
/** The debate pillar is relative: this percentile of active TDs scores full marks. */
export const PARTICIPATION_BENCHMARK_PERCENTILE = 0.75;

export interface ParticipationInput {
  tdId: number;
  isPresiding: boolean;
  sittingDays: number;
  sectionsSpoken: number;
}

/** Votes cast / divisions held while a member, 0–100 to one decimal. */
export function attendancePct(votesCast: number, divisionsEligible: number, isPresiding: boolean): number | null {
  if (isPresiding || divisionsEligible < MIN_DIVISIONS_FOR_ATTENDANCE) return null;
  return Math.round((Math.min(votesCast, divisionsEligible) / divisionsEligible) * 1000) / 10;
}

/** Below this, committee attendance is noise (a TD who joined a committee last month). */
export const MIN_COMMITTEE_SITTINGS = 10;

/**
 * Sittings of the TD's own committees they are on the roll call for, 0–100 to one decimal.
 * NULL below MIN_COMMITTEE_SITTINGS: a minister sits on no committee, which is not 0%.
 */
export function committeeAttendancePct(attended: number, eligible: number): number | null {
  if (eligible < MIN_COMMITTEE_SITTINGS) return null;
  return Math.round((Math.min(attended, eligible) / eligible) * 1000) / 10;
}

/** Distinct debate sections spoken in per sitting day. NULL when not measurable. */
export function participationRate(p: ParticipationInput): number | null {
  if (p.isPresiding || p.sittingDays < MIN_SITTING_DAYS) return null;
  return p.sectionsSpoken / p.sittingDays;
}

// ---------------------------------------------------------------------------
// Fairness: what each TD was EXPECTED to do. A reason the record shows (an office, the
// chair) or a documented absence changes the expectation; it is never inferred.
// ---------------------------------------------------------------------------

/** A closed range of days, YYYY-MM-DD. `end` NULL = still running. */
export interface DayRange {
  start: string;
  end: string | null;
}

/** Offices whose holders answer parliamentary questions rather than ask them. */
export const QUESTION_EXEMPT_OFFICES: readonly OfficeType[] = ['cabinet', 'minister_of_state', 'ceann_comhairle'];
/**
 * Government office. With party leadership (server/parliament/partyLeaders.ts) it makes a
 * leadership role, whose duties take a member away from Dáil votes on both sides of the house.
 */
export const GOVERNMENT_OFFICES: readonly OfficeType[] = ['cabinet', 'minister_of_state'];
/** Below this much time expected to ask questions, the question count says nothing. */
export const MIN_QUESTION_DAYS = 90;
/**
 * Vote-attendance benchmark for divisions held in a leadership role (government office or
 * party leader), by the same rule as ATTENDANCE_BENCHMARK (the 75th percentile, rounded down
 * to 5), measured on role holders' in-role attendance after chaired divisions and documented
 * leave are left out. Measured 2026-09-26 with the party leaders: 47 role holders, median
 * 82.3%, 75th percentile 91.2%. (The same query gave ordinary time 95.9%, which is
 * ATTENDANCE_BENCHMARK's 95.)
 */
export const LEADERSHIP_ATTENDANCE_BENCHMARK = 90;

const dayNumber = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / 86_400_000);

/** Days in [from, to] (inclusive) covered by at least one range. */
export function daysCovered(from: string, to: string, ranges: DayRange[]): number {
  const lo = dayNumber(from);
  const hi = dayNumber(to);
  if (hi < lo) return 0;
  const clipped = ranges
    .map((r) => [Math.max(lo, dayNumber(r.start)), Math.min(hi, r.end ? dayNumber(r.end) : hi)] as const)
    .filter(([a, b]) => b >= a)
    .sort((x, y) => x[0] - y[0]);
  let covered = 0;
  let cursor = lo - 1;
  for (const [a, b] of clipped) {
    const start = Math.max(a, cursor + 1);
    if (b >= start) covered += b - start + 1;
    cursor = Math.max(cursor, b);
  }
  return covered;
}

/**
 * The question benchmark pro-rated to the days the TD was expected to ask questions: their
 * seat window, less exempt office and documented leave, over the term so far. A full-term
 * backbencher is expected QUESTIONS_BENCHMARK, exactly as before. NULL = not expected
 * (e.g. in cabinet the whole time).
 */
export function questionsExpected(p: { memberSince: string; termStart: string; today: string; excluded: DayRange[] }): number | null {
  const windowDays = dayNumber(p.today) - dayNumber(p.memberSince) + 1;
  const eligible = windowDays - daysCovered(p.memberSince, p.today, p.excluded);
  if (eligible < MIN_QUESTION_DAYS) return null;
  const termDays = dayNumber(p.today) - dayNumber(p.termStart) + 1;
  return Math.round((QUESTIONS_BENCHMARK * eligible * 10) / termDays) / 10;
}

/** The vote-attendance benchmark for a TD's mix of ordinary and leadership-role divisions. */
export function attendanceBenchmark(divisionsEligible: number, divisionsInLeadership: number): number | null {
  if (divisionsEligible <= 0) return null;
  const inRole = Math.min(divisionsInLeadership, divisionsEligible);
  const value = (ATTENDANCE_BENCHMARK * (divisionsEligible - inRole) + LEADERSHIP_ATTENDANCE_BENCHMARK * inRole) / divisionsEligible;
  return Math.round(value * 10) / 10;
}

/** Linear-interpolated percentile of a non-empty list, q in [0, 1]. */
export function percentile(values: number[], q: number): number {
  if (values.length === 0) throw new Error('percentile of an empty list');
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * The debate pillar: each TD's participation rate relative to the 75th percentile of
 * measurable TDs, as a 0–1 fraction (the rollup's `normalizePercent` reads ≤ 1 as a
 * fraction). TDs who are not measurable are absent from the map, so the pillar drops out
 * for them instead of scoring 0.
 */
export function debateScores(rows: ParticipationInput[]): Map<number, number> {
  const rates = new Map<number, number>();
  for (const r of rows) {
    const rate = participationRate(r);
    if (rate !== null) rates.set(r.tdId, rate);
  }
  const scores = new Map<number, number>();
  if (rates.size === 0) return scores;
  const benchmark = percentile(Array.from(rates.values()), PARTICIPATION_BENCHMARK_PERCENTILE);
  rates.forEach((rate, tdId) => {
    scores.set(tdId, benchmark > 0 ? Math.min(1, rate / benchmark) : 0);
  });
  return scores;
}

export type VoteCounts = Partial<Record<DivisionVote, number>>;

/** The vote most of a group cast. NULL on a tie or when nobody voted. */
export function majority(counts: VoteCounts): DivisionVote | null {
  let best: DivisionVote | null = null;
  let bestN = 0;
  let tied = false;
  for (const [vote, n] of Object.entries(counts) as Array<[DivisionVote, number]>) {
    if (!n) continue;
    if (n > bestN) {
      best = vote;
      bestN = n;
      tied = false;
    } else if (n === bestN) {
      tied = true;
    }
  }
  return tied ? null : best;
}

/** One party's votes in one division, as the repository returns them. */
export interface PartyVoteRow {
  divisionId: string;
  party: string;
  vote: DivisionVote;
  n: number;
}

const key = (divisionId: string, party: string) => `${divisionId}\u0000${party}`;

/**
 * Each party's majority in each division. Independents are not a party and never appear.
 * The member's own vote counts toward their party's majority (party cohesion, the usual
 * measure); it only matters for parties of one or two.
 */
export function partyMajorities(rows: PartyVoteRow[]): Map<string, DivisionVote | null> {
  const counts = new Map<string, VoteCounts>();
  for (const r of rows) {
    if (r.party === INDEPENDENT) continue;
    const k = key(r.divisionId, r.party);
    const c = counts.get(k) ?? {};
    c[r.vote] = (c[r.vote] ?? 0) + r.n;
    counts.set(k, c);
  }
  const out = new Map<string, DivisionVote | null>();
  counts.forEach((c, k) => out.set(k, majority(c)));
  return out;
}

export function majorityFor(majorities: Map<string, DivisionVote | null>, divisionId: string, party: string | null): DivisionVote | null {
  if (!party || party === INDEPENDENT) return null;
  return majorities.get(key(divisionId, party)) ?? null;
}

/** Share of votes cast with the party majority, 0–100 to one decimal; NULL when none is comparable. */
export function partyLinePct(pairs: Array<{ vote: DivisionVote; partyMajority: DivisionVote | null }>): number | null {
  const comparable = pairs.filter((p) => p.partyMajority !== null);
  if (comparable.length === 0) return null;
  const withParty = comparable.filter((p) => p.vote === p.partyMajority).length;
  return Math.round((withParty / comparable.length) * 1000) / 10;
}
