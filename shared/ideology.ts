/**
 * The eight ideology dimensions: the ONE definition, shared by server and client.
 *
 * Every dimension runs −10..+10, and on every dimension **+ is the right-coded pole**:
 * market, conservative, traditional, authoritarian, pro-business, less welfare,
 * nationalist, populist. Every source (quiz answers, news and debate analysis, policy vote
 * options) is stored in this convention. Before 2026-09-24 the quiz used the opposite sign
 * on four dimensions while every model prompt used this one, so the two cancelled out.
 */

export const IDEOLOGY_DIMENSIONS = [
  'economic',
  'social',
  'cultural',
  'authority',
  'environmental',
  'welfare',
  'globalism',
  'technocratic',
] as const;

export type IdeologyDimension = (typeof IDEOLOGY_DIMENSIONS)[number];

/** A full position: every dimension present. */
export type IdeologyVector = Record<IdeologyDimension, number>;

export const IDEOLOGY_LIMIT = 10;

export interface DimensionPoles {
  label: string;
  /** What −10 means. */
  negative: string;
  /** What +10 means. */
  positive: string;
}

export const DIMENSION_POLES: Record<IdeologyDimension, DimensionPoles> = {
  economic: { label: 'Economic', negative: 'Collective', positive: 'Market' },
  social: { label: 'Social', negative: 'Progressive', positive: 'Conservative' },
  cultural: { label: 'Cultural', negative: 'Multicultural', positive: 'Traditional' },
  authority: { label: 'Authority', negative: 'Libertarian', positive: 'Authoritarian' },
  environmental: { label: 'Environment', negative: 'Ecological', positive: 'Pro-growth' },
  welfare: { label: 'Welfare', negative: 'Expand welfare', positive: 'Self-reliance' },
  globalism: { label: 'Globalism', negative: 'Internationalist', positive: 'Nationalist' },
  technocratic: { label: 'Governance', negative: 'Expert-led', positive: 'Populist' },
};

export function emptyIdeologyVector(): IdeologyVector {
  return Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, 0])) as IdeologyVector;
}

/** Clamp to −10..+10; anything not a finite number becomes 0. */
export function clampIdeologyValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-IDEOLOGY_LIMIT, Math.min(IDEOLOGY_LIMIT, value));
}
