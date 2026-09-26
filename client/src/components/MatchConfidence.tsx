/**
 * How much evidence is behind a match, on the match lists (quiz results, My rankings, My politics).
 * The words come from lib/ideologyConfidence, which is unit-tested.
 */
import { IDEOLOGY_DIMENSIONS, type IdeologyDimension } from "@shared/ideology";
import type { Confidence } from "@shared/ideologyMatch";
import { badgeVariants } from "@/components/ui/badge";
import { allPositionOnly, matchBadge } from "@/lib/ideologyConfidence";
import { cn } from "@/lib/utils";

/** A row's warning badge; nothing when there is enough own evidence. A span: the rows are spans. */
export function MatchConfidence({ kind, confidence, className }: { kind: "td" | "party"; confidence: Confidence; className?: string }) {
  const badge = matchBadge(kind, confidence);
  if (!badge) return null;
  return (
    <span
      data-testid="match-confidence"
      data-confidence={confidence}
      className={cn(badgeVariants({ variant: badge.variant }), "shrink-0 whitespace-nowrap", className)}
    >
      {badge.label}
    </span>
  );
}

const POSITION_ONLY_NOTE = {
  td: "We have no individual record for these TDs yet, so each one matches as their party's position.",
  party: "We have no individual record for these parties' TDs yet, so each party matches as its estimated position.",
};

/**
 * Once per list: the note that replaces a badge on every row when no item has its own evidence,
 * and, for a signed-in user, which dimensions the match uses. Rows show badges only when
 * `rowBadges(items)` is true.
 */
export function MatchListNote({
  kind,
  items,
  measured,
}: {
  kind: "td" | "party";
  items: readonly { confidence: Confidence }[];
  /** The user's measured dimensions (signed-in matches only). */
  measured?: readonly IdeologyDimension[];
}) {
  const positionOnly = allPositionOnly(items);
  const partial = measured !== undefined && measured.length > 0 && measured.length < IDEOLOGY_DIMENSIONS.length;
  if (!positionOnly && !partial) return null;
  return (
    <div className="flex flex-col gap-1 text-[13px] leading-relaxed text-muted-foreground">
      {positionOnly && <p>{POSITION_ONLY_NOTE[kind]}</p>}
      {partial && (
        <p>
          Matched on the {measured.length} {measured.length === 1 ? "dimension" : "dimensions"} you have answers on.
        </p>
      )}
    </div>
  );
}

/** Badges on each row, unless the list-level note already says it for all of them. */
export const rowBadges = (items: readonly { confidence: Confidence }[]) => !allPositionOnly(items);
