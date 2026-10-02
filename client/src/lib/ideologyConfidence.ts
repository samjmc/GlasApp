/**
 * How much evidence stands behind a TD's or party's position, in words. Pure, so it is
 * unit-tested; the components that show it stay thin.
 */
import type { IdeologyDimension } from "@shared/ideology";
import type { Confidence, EvidenceCounts } from "@shared/ideologyMatch";
import type { EvidenceSource } from "@shared/schema/quiz";

/** Every evidence source, in display order. A new source is a type error here until it has a label. */
export const EVIDENCE_LABELS: Record<EvidenceSource, readonly [one: string, many: string]> = {
  stance: ["stance", "stances"],
  debate: ["debate speech", "debate speeches"],
  // Rows of the deleted news scoring panel, kept until `npm run stances -- --rebuild` purges them.
  article: ["news analysis", "news analyses"],
};

/** "3 stances · 1 debate speech"; null when there is no evidence. */
export function evidenceSummary(counts: EvidenceCounts): string | null {
  const parts = (Object.keys(EVIDENCE_LABELS) as EvidenceSource[])
    .filter((source) => (counts[source] ?? 0) > 0)
    .map((source) => {
      const n = counts[source]!;
      return `${n} ${EVIDENCE_LABELS[source][n === 1 ? 0 : 1]}`;
    });
  return parts.length > 0 ? parts.join(" · ") : null;
}

export interface MatchBadge {
  label: string;
  variant: "warn";
}

/** The warning a match row carries; null when there is enough own evidence to say nothing. */
export function matchBadge(kind: "td" | "party", confidence: Confidence): MatchBadge | null {
  if (confidence === "none") return { label: kind === "td" ? "Party position only" : "Estimated party position", variant: "warn" };
  if (confidence === "low") return { label: "Little evidence yet", variant: "warn" };
  return null;
}

/** Every item matches on position alone: one note for the list instead of a badge on each row. */
export function allPositionOnly(items: readonly { confidence: Confidence }[]): boolean {
  return items.length > 0 && items.every((item) => item.confidence === "none");
}

export type DimensionState = "measured" | "party" | "not-measured";

/** Own evidence, else the party baseline, else nothing: 0 there means "unknown", not "centrist". */
export function dimensionState(
  dimension: IdeologyDimension,
  subject: { measured: readonly IdeologyDimension[]; hasPartyBaseline: boolean },
): DimensionState {
  if (subject.measured.includes(dimension)) return "measured";
  return subject.hasPartyBaseline ? "party" : "not-measured";
}
