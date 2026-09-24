import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatScore, scoreTone, TONE_BG } from "@/lib/score";

/** A labelled number tile: "Votes cast · 159 / 413". */
export function StatTile({
  label,
  value,
  sub,
  children,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border bg-card p-4", className)}>
      <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
      <span className="font-display text-3xl font-bold leading-none tracking-tight">{value}</span>
      {sub && <span className="text-[13px] text-muted-foreground">{sub}</span>}
      {children}
    </div>
  );
}

/** A thin 0–100 bar, coloured by the score rule; null draws an empty dashed track. */
export function ScoreBar({
  value,
  className,
  tone,
}: {
  value: number | null | undefined;
  className?: string;
  /** Force a colour class instead of the score rule, e.g. "bg-foreground". */
  tone?: string;
}) {
  const t = scoreTone(value);
  if (!t) {
    return <div className={cn("h-1.5 rounded-full border border-dashed border-input", className)} aria-hidden="true" />;
  }
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-input", className)} aria-hidden="true">
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", tone ?? TONE_BG[t])}
        style={{ width: `${Math.min(100, Math.max(0, value as number))}%` }}
      />
    </div>
  );
}

/** Label, value and bar on one row: "Dáil record   73  ▬▬▬▬▬▬▬▭▭▭". */
export function ScoreRow({ label, value, hint }: { label: string; value: number | null | undefined; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">{label}</span>
        <span className={cn("font-display font-bold", scoreTone(value) ? "" : "text-muted-foreground")}>
          {scoreTone(value) ? formatScore(value) : "Not scored yet"}
        </span>
      </div>
      <ScoreBar value={value} />
      {hint && <span className="text-[13px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
