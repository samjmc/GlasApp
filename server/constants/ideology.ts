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

export function emptyIdeologyVector(): Record<IdeologyDimension, number> {
  return IDEOLOGY_DIMENSIONS.reduce(
    (acc, dimension) => {
      acc[dimension] = 0;
      return acc;
    },
    {} as Record<IdeologyDimension, number>,
  );
}

export function clampIdeologyValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-10, Math.min(10, value));
}


