/**
 * The one place a score is turned into a number a person sees.
 *
 * - `PILLAR_WEIGHTS` is the only weight table.
 * - `overallFromPillars` is the only way an overall score is produced.
 */
import type { ScoreLabel } from '@shared/scoresApi';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Only facts from the Oireachtas record count. News carried 0.45 until 2026-09-25; the
 * remaining 0.30 / 0.25 are renormalised to 0.55 / 0.45.
 */
export const PILLAR_WEIGHTS = {
  /** Questions, Dáil vote attendance and committee attendance, benchmark-relative. */
  parliamentary: 0.55,
  /** Debate participation from the Official Report. */
  debate: 0.45,
} as const;

/**
 * Fewer measurable components than this and a TD gets no overall score and no rank: one
 * number (say, vote attendance alone) is not enough to rank against TDs measured on four.
 * Counted over questions, attendance, committees and debate.
 */
export const MIN_COMPONENTS_FOR_RANK = 2;

export type Pillar = keyof typeof PILLAR_WEIGHTS;
export type PillarScores = Partial<Record<Pillar, number | null>>;

{
  const sum = Object.values(PILLAR_WEIGHTS).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) throw new Error(`PILLAR_WEIGHTS must sum to 1, got ${sum}`);
}

/**
 * Weighted overall from whichever pillars have data. Weights renormalise over the present
 * pillars, so a TD with no debate record is scored on the parliamentary pillar alone rather
 * than being dragged to 50 by a pillar that has nothing to say. NULL when no pillar has data.
 */
export function overallFromPillars(scores: PillarScores): number | null {
  let weighted = 0;
  let weightSum = 0;
  for (const pillar of Object.keys(PILLAR_WEIGHTS) as Pillar[]) {
    const score = scores[pillar];
    if (score === null || score === undefined || Number.isNaN(score)) continue;
    weighted += clamp(score, 0, 100) * PILLAR_WEIGHTS[pillar];
    weightSum += PILLAR_WEIGHTS[pillar];
  }
  if (weightSum === 0) return null;
  return Math.round(weighted / weightSum);
}

/** Top TDs ask 400–900 questions a term; 200 scores full marks on that component. */
export const QUESTIONS_BENCHMARK = 200;
/** The 75th percentile of attendance is ~96%; 95% scores full marks. */
export const ATTENDANCE_BENCHMARK = 95;
/**
 * Committee attendance by the same rule: the 75th percentile was 87.7% on 2026-09-25
 * (127 measurable TDs, median 78.4%), so 85% scores full marks.
 */
export const COMMITTEE_ATTENDANCE_BENCHMARK = 85;

/**
 * Weights inside the parliamentary pillar. They renormalise over the components that have
 * data: a TD with no committee measure (most ministers sit on none) is scored 62.5 / 37.5
 * on questions and votes, close to the 60 / 40 used before committees were measured.
 */
export const PARLIAMENTARY_WEIGHTS = {
  questions: 0.5,
  attendance: 0.3,
  committees: 0.2,
} as const;

{
  const sum = Object.values(PARLIAMENTARY_WEIGHTS).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) throw new Error(`PARLIAMENTARY_WEIGHTS must sum to 1, got ${sum}`);
}

/**
 * Parliamentary pillar, 0–100: questions, Dáil vote attendance and committee attendance,
 * each capped at its benchmark, weighted by PARLIAMENTARY_WEIGHTS over the ones present.
 * NULL when none exists.
 */
export function parliamentaryScore(
  questions: number | null | undefined,
  attendancePct: number | null | undefined,
  committeeAttendancePct: number | null | undefined = null,
  /**
   * Per-TD expectations from server/parliament, each replacing its constant when given:
   * `questionsExpected` for a TD expected to ask for only part of the term (a by-election TD,
   * a Minister of State appointed mid-term); `attendanceBenchmark` for a TD with time in a
   * leadership role (government office or party leader, on either side). Absent or NULL: the
   * constant.
   */
  opts: { questionsExpected?: number | null; attendanceBenchmark?: number | null } = {},
): number | null {
  const part = (v: number | null | undefined, benchmark: number) =>
    v === null || v === undefined || Number.isNaN(v) ? null : clamp(v / benchmark, 0, 1) * 100;
  const orConstant = (v: number | null | undefined, constant: number) => (v && v > 0 ? v : constant);
  const parts: Array<[number | null, number]> = [
    [part(questions, orConstant(opts.questionsExpected, QUESTIONS_BENCHMARK)), PARLIAMENTARY_WEIGHTS.questions],
    [part(attendancePct, orConstant(opts.attendanceBenchmark, ATTENDANCE_BENCHMARK)), PARLIAMENTARY_WEIGHTS.attendance],
    [part(committeeAttendancePct, COMMITTEE_ATTENDANCE_BENCHMARK), PARLIAMENTARY_WEIGHTS.committees],
  ];
  let weighted = 0;
  let weightSum = 0;
  for (const [score, weight] of parts) {
    if (score === null) continue;
    weighted += score * weight;
    weightSum += weight;
  }
  return weightSum === 0 ? null : Math.round(weighted / weightSum);
}

/**
 * Debate scores arrive either as 0–1 fractions or 0–100. Normalise to 0–100.
 * NULL stays NULL: a missing debate record is not a score of 0.
 */
export function normalizePercent(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const v = value <= 1 && value >= 0 ? value * 100 : value;
  return Math.round(clamp(v, 0, 100));
}

export function scoreLabel(score: number): ScoreLabel {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Average';
  if (score >= 40) return 'Below Average';
  return 'Poor';
}
