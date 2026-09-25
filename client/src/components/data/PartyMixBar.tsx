import { partyStyle } from "@/lib/parties";
import { cn } from "@/lib/utils";

/** A stacked bar of seats by party, in party colours. Used by the constituency pages. */
export function PartyMixBar({
  parties,
  className,
}: {
  parties: { party: string; count: number }[];
  className?: string;
}) {
  const total = parties.reduce((sum, p) => sum + p.count, 0);
  if (total === 0) {
    return <div className={cn("h-2 rounded-full border border-dashed border-input", className)} aria-hidden="true" />;
  }
  return (
    <div
      role="img"
      aria-label={parties.map((p) => `${partyStyle(p.party).name} ${p.count}`).join(", ")}
      className={cn("flex h-2 gap-0.5 overflow-hidden rounded-full", className)}
    >
      {parties.map((p) => (
        <span
          key={p.party}
          className="h-full first:rounded-l-full last:rounded-r-full"
          style={{ width: `${(p.count / total) * 100}%`, backgroundColor: partyStyle(p.party).dot }}
        />
      ))}
    </div>
  );
}
