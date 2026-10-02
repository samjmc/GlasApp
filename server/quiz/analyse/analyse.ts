/**
 * The item analysis: answer distributions, item quality, per-dimension reliability and
 * inter-dimension correlations. Pure. Every number sits behind a gate with a named unit, and
 * below its gate a section carries only the gate: never a number, never a flag.
 *
 * Only BASE exposures feed a flag. The base comes from the seed alone (shared/quizPlan.ts), so
 * base exposures are missing completely at random and pairwise statistics over them are
 * unbiased. Follow-ups go only to users whose base answers were mixed: pooled in, a pure-noise
 * question reads as reversed and good ones look weak. Users never share one item set, so
 * reliability is a standardised alpha from pooled pairwise r, not Cronbach's alpha on complete
 * cases. Raw answer values throughout: r and standardised alpha do not depend on scale.
 */
import { IDEOLOGY_DIMENSIONS, type IdeologyDimension } from '@shared/ideology';
import type { QuizQuestion } from '@shared/quiz';
import { DEFAULT_PLAN_CONFIG } from '@shared/quizPlan';
import type { ExclusionReason, Respondent } from './exposures';
import { disattenuate, pearson, poolCorrelations, standardisedAlpha } from './stats';
import {
  DOMINANT_SHARE,
  LOW_ALPHA,
  MIN_BASE_EXPOSURES_ITEM,
  MIN_PAIRS_PER_ITEM,
  MIN_PAIR_COEXPOSURES,
  MIN_USERS_DIMENSION_CORR,
  ONE_CONSTRUCT_R,
  WEAK_ITEM_R,
} from './thresholds';

export type GateUnit = 'base exposures' | 'qualifying pairs' | 'respondents';
export type Gated<T> = { ok: true; value: T } | { ok: false; n: number; need: number; unit: GateUnit };

export interface QuestionAnalysis {
  id: number;
  dimension: IdeologyDimension;
  /** The answers' values, for labels. */
  values: number[];
  baseExposures: number;
  /** Per answer index, how many base exposures chose it. */
  base: Gated<number[]>;
  followUpExposures: number;
  /** Per answer index, among follow-up exposures. Descriptive only; never gated, never flagged. */
  followUp: number[];
  /** Pooled r with the other questions on its dimension, over qualifying pairs. */
  quality: Gated<{ r: number; lo: number; hi: number; pairs: number }>;
}

export interface DimensionAnalysis {
  dimension: IdeologyDimension;
  /** Standardised alpha of the base form every user gets (basePerDimension questions). */
  alpha: Gated<{ alpha: number; pairs: number; possible: number }>;
}

export interface DimensionCorrelation {
  a: IdeologyDimension;
  b: IdeologyDimension;
  observed: number | null;
  /** observed / √(αa·αb); null when either alpha is missing or ≤ 0. */
  disattenuated: number | null;
}

/** Worst first. The last two are info: they describe the dimensions, not a broken question. */
export const FLAG_ORDER = ['reversed', 'weak', 'dead', 'dominant', 'lowAlpha', 'oneConstruct'] as const;
export type FlagKind = (typeof FLAG_ORDER)[number];

export type Finding =
  | { kind: 'reversed' | 'weak'; questionId: number; r: number; lo: number; hi: number }
  | { kind: 'dominant' | 'dead'; questionId: number; answerIndex: number; share: number }
  | { kind: 'lowAlpha'; dimension: IdeologyDimension; alpha: number }
  | { kind: 'oneConstruct'; a: IdeologyDimension; b: IdeologyDimension; observed: number; disattenuated: number };

export interface AnalysisResult {
  included: number;
  excluded: Record<ExclusionReason, number>;
  questions: QuestionAnalysis[];
  dimensions: DimensionAnalysis[];
  correlations: Gated<DimensionCorrelation[]>;
  findings: Finding[];
}

function gate<T>(n: number, need: number, unit: GateUnit, value: () => T): Gated<T> {
  return n >= need ? { ok: true, value: value() } : { ok: false, n, need, unit };
}

/** The ONE choice of which exposures feed the statistics. */
const exposed = (r: Respondent) => r.base;

const DIMENSION_PAIRS = IDEOLOGY_DIMENSIONS.flatMap((a, i) => IDEOLOGY_DIMENSIONS.slice(i + 1).map((b) => [a, b] as const));

export function analyse(
  respondents: readonly Respondent[],
  bank: readonly QuizQuestion[],
  excluded: Record<ExclusionReason, number>,
): AnalysisResult {
  const valuesOf = new Map(bank.map((q) => [q.id, q.answers.map((a) => a.value)]));

  // Every pair of questions on a dimension, over respondents with both as base.
  const qualifying: Array<{ dimension: IdeologyDimension; a: number; b: number; n: number; r: number }> = [];
  for (const d of IDEOLOGY_DIMENSIONS) {
    const ids = bank.filter((q) => q.dimension === d).map((q) => q.id);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = [ids[i], ids[j]];
        const xs: number[] = [];
        const ys: number[] = [];
        for (const r of respondents) {
          const x = exposed(r).get(a);
          const y = exposed(r).get(b);
          if (x === undefined || y === undefined) continue;
          xs.push(valuesOf.get(a)![x]);
          ys.push(valuesOf.get(b)![y]);
        }
        const r = xs.length >= MIN_PAIR_COEXPOSURES ? pearson(xs, ys) : null;
        if (r !== null) qualifying.push({ dimension: d, a, b, n: xs.length, r });
      }
    }
  }

  const questions: QuestionAnalysis[] = bank.map((q) => {
    const base = q.answers.map(() => 0);
    const followUp = q.answers.map(() => 0);
    for (const r of respondents) {
      const b = exposed(r).get(q.id);
      if (b !== undefined) base[b] += 1;
      const f = r.followUp.get(q.id);
      if (f !== undefined) followUp[f] += 1;
    }
    const baseExposures = base.reduce((s, c) => s + c, 0);
    const pairs = qualifying.filter((p) => p.a === q.id || p.b === q.id);
    return {
      id: q.id,
      dimension: q.dimension,
      values: valuesOf.get(q.id)!,
      baseExposures,
      base: gate(baseExposures, MIN_BASE_EXPOSURES_ITEM, 'base exposures', () => base),
      followUpExposures: followUp.reduce((s, c) => s + c, 0),
      followUp,
      quality: gate(pairs.length, MIN_PAIRS_PER_ITEM, 'qualifying pairs', () => {
        const { r, lo, hi } = poolCorrelations(pairs);
        return { r, lo, hi, pairs: pairs.length };
      }),
    };
  });

  const dimensions: DimensionAnalysis[] = IDEOLOGY_DIMENSIONS.map((d) => {
    const items = questions.filter((q) => q.dimension === d && q.baseExposures > 0).length;
    const possible = (items * (items - 1)) / 2;
    const pairs = qualifying.filter((p) => p.dimension === d);
    return {
      dimension: d,
      alpha: gate(pairs.length, Math.max(1, Math.ceil((2 * possible) / 3)), 'qualifying pairs', () => ({
        alpha: standardisedAlpha(poolCorrelations(pairs).r, DEFAULT_PLAN_CONFIG.basePerDimension),
        pairs: pairs.length,
        possible,
      })),
    };
  });

  const alphaOf = new Map(dimensions.map((d) => [d.dimension, d.alpha.ok ? d.alpha.value.alpha : 0]));
  const correlations = gate(respondents.length, MIN_USERS_DIMENSION_CORR, 'respondents', () =>
    DIMENSION_PAIRS.map(([a, b]): DimensionCorrelation => {
      const observed = pearson(respondents.map((r) => r.vector[a]), respondents.map((r) => r.vector[b]));
      return { a, b, observed, disattenuated: observed === null ? null : disattenuate(observed, alphaOf.get(a)!, alphaOf.get(b)!) };
    }),
  );

  const findings: Finding[] = [];
  for (const q of questions) {
    if (q.quality.ok) {
      const { r, lo, hi } = q.quality.value;
      if (hi < 0) findings.push({ kind: 'reversed', questionId: q.id, r, lo, hi });
      else if (r < WEAK_ITEM_R) findings.push({ kind: 'weak', questionId: q.id, r, lo, hi });
    }
    if (q.base.ok) {
      q.base.value.forEach((count, answerIndex) => {
        const share = count / q.baseExposures;
        if (share >= DOMINANT_SHARE) findings.push({ kind: 'dominant', questionId: q.id, answerIndex, share });
        if (count === 0) findings.push({ kind: 'dead', questionId: q.id, answerIndex, share });
      });
    }
  }
  for (const d of dimensions) {
    if (d.alpha.ok && d.alpha.value.alpha < LOW_ALPHA) findings.push({ kind: 'lowAlpha', dimension: d.dimension, alpha: d.alpha.value.alpha });
  }
  if (correlations.ok) {
    for (const { a, b, observed, disattenuated } of correlations.value) {
      // Either sign: two dimensions that move together or exactly against each other measure one thing.
      if (observed !== null && disattenuated !== null && Math.abs(disattenuated) >= ONE_CONSTRUCT_R) {
        findings.push({ kind: 'oneConstruct', a, b, observed, disattenuated });
      }
    }
  }
  findings.sort((x, y) => FLAG_ORDER.indexOf(x.kind) - FLAG_ORDER.indexOf(y.kind));

  return { included: respondents.length, excluded, questions, dimensions, correlations, findings };
}
