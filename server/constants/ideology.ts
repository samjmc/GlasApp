/** The eight ideology dimensions used across the app. */
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

/** Create an empty ideology vector with all dimensions set to 0. */
export function emptyIdeologyVector(): Record<IdeologyDimension, number> {
  return IDEOLOGY_DIMENSIONS.reduce(
    (acc, dimension) => {
      acc[dimension] = 0;
      return acc;
    },
    {} as Record<IdeologyDimension, number>,
  );
}

/** Clamp an ideology value to the valid -10..10 range. */
export function clampIdeologyValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-10, Math.min(10, value));
}


