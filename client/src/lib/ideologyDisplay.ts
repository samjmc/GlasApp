/**
 * Display text for the eight dimensions. Names and pole labels come from DIMENSION_POLES in
 * shared/ideology.ts.
 */
import { DIMENSION_POLES, type IdeologyDimension } from "@shared/ideology";

/** "Strongly Market", "Leaning Ecological", "Centrist on Economic issues". */
export function describePosition(dimension: IdeologyDimension, value: number): string {
  const { label, negative, positive } = DIMENSION_POLES[dimension];
  const pole = value < 0 ? negative : positive;
  const size = Math.abs(value);
  if (size < 0.5) return `Centrist on ${label} issues`;
  if (size < 3) return `Leaning ${pole}`;
  if (size < 7) return `Moderately ${pole}`;
  return `Strongly ${pole}`;
}
