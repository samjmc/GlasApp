import { cn } from "@/lib/utils";

const VOTES = {
  ta: { label: "Tá", title: "Voted yes", className: "bg-score-high text-primary-foreground" },
  nil: { label: "Níl", title: "Voted no", className: "bg-warn text-background" },
  staon: { label: "Staon", title: "Abstained", className: "bg-elevated text-foreground" },
  absent: { label: "Absent", title: "Did not vote", className: "border border-dashed border-input text-muted-foreground" },
} as const;

export type VoteValue = keyof typeof VOTES;

function normalise(vote: string | null | undefined): VoteValue {
  const key = (vote ?? "").toLowerCase();
  return key === "ta" || key === "tá" ? "ta" : key === "nil" || key === "níl" ? "nil" : key === "staon" ? "staon" : "absent";
}

/** How a TD voted in a Dáil division: Tá / Níl / Staon / Absent. */
export function VoteChip({ vote, className }: { vote: string | null | undefined; className?: string }) {
  const v = VOTES[normalise(vote)];
  return (
    <span
      title={v.title}
      className={cn(
        "inline-flex h-8 min-w-12 shrink-0 items-center justify-center rounded-full px-3 text-[13px] font-extrabold",
        v.className,
        className
      )}
    >
      {v.label}
    </span>
  );
}

/** A Tá / Níl split bar with counts. */
export function DivisionBar({ ta, nil, className }: { ta: number; nil: number; className?: string }) {
  const total = ta + nil;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex justify-between text-sm font-bold">
        <span className="text-score-high">Tá {ta}</span>
        <span className="text-warn">Níl {nil}</span>
      </div>
      <div className="flex h-3 gap-[3px]" role="img" aria-label={`Tá ${ta}, Níl ${nil}`}>
        <div className="rounded-l-full bg-score-high" style={{ flexGrow: total ? ta : 1 }} />
        <div className="rounded-r-full bg-warn" style={{ flexGrow: total ? nil : 1 }} />
      </div>
    </div>
  );
}
