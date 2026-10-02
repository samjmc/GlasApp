/**
 * How close two positions are: the ONE formula for user↔TD, user↔party and TD↔party.
 * Replaces three that disagreed (one divided party scores by 2, one did not, one was cosine).
 *
 * 100 = identical, 0 = opposite ends of every weighted dimension. Linear in distance, so
 * "70%" means the same thing everywhere.
 */
import { IDEOLOGY_DIMENSIONS, IDEOLOGY_LIMIT, type IdeologyDimension, type IdeologyVector } from '@shared/ideology';

export type DimensionWeights = Partial<Record<IdeologyDimension, number>>;

export const MAX_DIMENSION_WEIGHT = 3;

/** A dimension's weight as the formula uses it: missing or not finite = 1, else clamped to 0..MAX. */
function weightOf(raw: number | undefined): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(MAX_DIMENSION_WEIGHT, raw)) : 1;
}

export function alignment(a: IdeologyVector, b: IdeologyVector, weights: DimensionWeights = {}): number {
  let distance = 0;
  let span = 0;
  for (const d of IDEOLOGY_DIMENSIONS) {
    const w = weightOf(weights[d]);
    distance += w * Math.abs(a[d] - b[d]);
    span += w * 2 * IDEOLOGY_LIMIT;
  }
  if (span === 0) return 0;
  return Math.round(100 * (1 - distance / span));
}

/**
 * The weighted dimensions two positions agree and disagree on most, for a one-line reason.
 * A dimension is named at most once, so with few weighted dimensions `furthest` is shorter.
 */
export function closestAndFurthest(a: IdeologyVector, b: IdeologyVector, weights: DimensionWeights = {}, count = 2) {
  const gaps = IDEOLOGY_DIMENSIONS.filter((d) => weightOf(weights[d]) > 0)
    .map((d) => ({ dimension: d, gap: Math.abs(a[d] - b[d]) }))
    .sort((x, y) => x.gap - y.gap);
  return {
    closest: gaps.slice(0, count).map((g) => g.dimension),
    furthest: gaps.slice(count).slice(-count).reverse().map((g) => g.dimension),
  };
}

/** A TD or party with no party baseline must be measured on this many dimensions to be matched. */
export const MIN_MEASURED_DIMS = 4;

/**
 * The weights to match one TD or party on. null = do not list it.
 *
 * With a party baseline every dimension has a position (the prior), so the user's weights apply
 * as they are. Without one, a dimension the subject has no evidence on is 0 = "unknown", not
 * "centrist": it gets weight 0, and a subject measured on too few dimensions is not matched.
 */
export function subjectWeights(
  user: DimensionWeights,
  subject: { hasPartyBaseline: boolean; measured: readonly IdeologyDimension[] },
): DimensionWeights | null {
  if (subject.hasPartyBaseline) return user;
  if (subject.measured.length < MIN_MEASURED_DIMS) return null;
  const weights: DimensionWeights = {};
  for (const d of IDEOLOGY_DIMENSIONS) weights[d] = subject.measured.includes(d) ? user[d] : 0;
  // No dimension both measured and weighted: alignment would be 0 and list it at 0%.
  return IDEOLOGY_DIMENSIONS.some((d) => weightOf(weights[d]) > 0) ? weights : null;
}
