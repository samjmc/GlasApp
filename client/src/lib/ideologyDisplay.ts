/**
 * Display-only styling for the eight dimensions. Names and pole labels come from
 * DIMENSION_POLES in shared/ideology.ts; this file adds only an icon and a colour.
 */
import { DIMENSION_POLES, type IdeologyDimension } from "@shared/ideology";

export const DIMENSION_STYLE: Record<IdeologyDimension, { icon: string; color: string }> = {
  economic: { icon: "💰", color: "#ff5757" },
  social: { icon: "👥", color: "#5271ff" },
  cultural: { icon: "🏛️", color: "#8b5cf6" },
  authority: { icon: "⚖️", color: "#f59e0b" },
  environmental: { icon: "🌱", color: "#10b981" },
  welfare: { icon: "🤲", color: "#ec4899" },
  globalism: { icon: "🌐", color: "#22c55e" },
  technocratic: { icon: "🗳️", color: "#06b6d4" },
};

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
