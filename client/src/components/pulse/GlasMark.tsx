import { cn } from "@/lib/utils";

/** The Glas mark: a hexagon holding three linked rings. */
export function GlasMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("h-8 w-8 shrink-0", className)}>
      <path d="M16 1.5l12.5 7.25v14.5L16 30.5 3.5 23.25V8.75z" className="fill-primary" />
      <g fill="none" strokeWidth="2.4" className="stroke-primary-foreground">
        <circle cx="16" cy="11.6" r="4.2" />
        <circle cx="11.6" cy="19.2" r="4.2" />
        <circle cx="20.4" cy="19.2" r="4.2" />
      </g>
    </svg>
  );
}

/** Mark plus the lower-case wordmark. */
export function GlasLogo({ className, hideWordmark }: { className?: string; hideWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-foreground", className)}>
      <GlasMark />
      {hideWordmark ? (
        <span className="sr-only">Glas Politics</span>
      ) : (
        <span className="font-display text-2xl font-bold tracking-tight">glas</span>
      )}
    </span>
  );
}
