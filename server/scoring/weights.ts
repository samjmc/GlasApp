/**
 * The one place a score is turned into a number a person sees.
 *
 * - `eloToPercent` is the only ELO → 0–100 conversion in the codebase.
 * - `PILLAR_WEIGHTS` is the only weight table.
 * - `overallFromPillars` is the only way an overall score is produced.
 */

export const ELO_FLOOR = 1000;
export const ELO_CEILING = 2000;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 1000 → 0, 1500 → 50, 2000 → 100. NULL/NaN → 50 (baseline). */
export function eloToPercent(elo: number | null | undefined): number {
  if (elo === null || elo === undefined || Number.isNaN(elo)) return 50;
  return Math.round(clamp((elo - ELO_FLOOR) / ((ELO_CEILING - ELO_FLOOR) / 100), 0, 100));
}

export const PILLAR_WEIGHTS = {
  /** eloToPercent(overall_elo): every scored article, credibility-weighted and decayed. */
  news: 0.45,
  /** Questions asked and vote attendance, benchmark-relative. */
  parliamentary: 0.3,
  /** Debate performance from the debate subsystem. */
  debate: 0.25,
} as const;

export type Pillar = keyof typeof PILLAR_WEIGHTS;
export type PillarScores = Partial<Record<Pillar, number | null>>;

{
  const sum = Object.values(PILLAR_WEIGHTS).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) throw new Error(`PILLAR_WEIGHTS must sum to 1, got ${sum}`);
}

/**
 * Weighted overall from whichever pillars have data. Weights renormalise over the present
 * pillars, so a TD with no debate record is scored on news and parliament alone rather than
 * being dragged to 50 by a pillar that has nothing to say. NULL when no pillar has data.
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
 * Parliamentary pillar, 0–100: 60% questions, 40% attendance, each capped at the benchmark.
 * NULL when neither input exists. If only one exists it carries the whole pillar.
 */
export function parliamentaryScore(
  questions: number | null | undefined,
  attendancePct: number | null | undefined,
): number | null {
  const q = questions === null || questions === undefined ? null : clamp(questions / QUESTIONS_BENCHMARK, 0, 1) * 100;
  const a =
    attendancePct === null || attendancePct === undefined ? null : clamp(attendancePct / ATTENDANCE_BENCHMARK, 0, 1) * 100;
  if (q === null && a === null) return null;
  if (q === null) return Math.round(a as number);
  if (a === null) return Math.round(q);
  return Math.round(q * 0.6 + a * 0.4);
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

export type ScoreLabel = 'Excellent' | 'Good' | 'Average' | 'Below Average' | 'Poor';

export function scoreLabel(score: number): ScoreLabel {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Average';
  if (score >= 40) return 'Below Average';
  return 'Poor';
}
