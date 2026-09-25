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

export function alignment(a: IdeologyVector, b: IdeologyVector, weights: DimensionWeights = {}): number {
  let distance = 0;
  let span = 0;
  for (const d of IDEOLOGY_DIMENSIONS) {
    const raw = weights[d];
    const w = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(MAX_DIMENSION_WEIGHT, raw)) : 1;
    distance += w * Math.abs(a[d] - b[d]);
    span += w * 2 * IDEOLOGY_LIMIT;
  }
  if (span === 0) return 0;
  return Math.round(100 * (1 - distance / span));
}

/** The dimensions two positions agree and disagree on most, for a one-line reason. */
export function closestAndFurthest(a: IdeologyVector, b: IdeologyVector, count = 2) {
  const gaps = IDEOLOGY_DIMENSIONS.map((d) => ({ dimension: d, gap: Math.abs(a[d] - b[d]) })).sort((x, y) => x.gap - y.gap);
  return {
    closest: gaps.slice(0, count).map((g) => g.dimension),
    furthest: gaps.slice(-count).reverse().map((g) => g.dimension),
  };
}
