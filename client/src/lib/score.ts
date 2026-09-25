/** How a 0–100 score is shown: one rule for every ring, number and bar in the app. */
export type ScoreTone = "high" | "mid" | "low";

export function scoreTone(score: number | null | undefined): ScoreTone | null {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  if (score >= 80) return "high";
  if (score >= 50) return "mid";
  return "low";
}

/** Tailwind classes per tone. Kept as literals so Tailwind's scanner sees them. */
export const TONE_TEXT: Record<ScoreTone, string> = {
  high: "text-score-high",
  mid: "text-score-mid",
  low: "text-score-low",
};

export const TONE_BG: Record<ScoreTone, string> = {
  high: "bg-score-high",
  mid: "bg-score-mid",
  low: "bg-score-low",
};

export const TONE_STROKE: Record<ScoreTone, string> = {
  high: "stroke-score-high",
  mid: "stroke-score-mid",
  low: "stroke-score-low",
};

/** A missing value is shown as an em dash, never as 0. */
export function formatScore(score: number | null | undefined): string {
  return score === null || score === undefined || Number.isNaN(score) ? "—" : String(Math.round(score));
}
