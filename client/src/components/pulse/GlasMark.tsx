import glasMark from "@assets/glas-mark-192.png";
import glasLogo from "@assets/glas-logo-640.png";
import { cn } from "@/lib/utils";

/** The Glas hexagon mark on its own, for small spaces (icon rail, loaders). */
export function GlasMark({ className }: { className?: string }) {
  return <img src={glasMark} alt="" aria-hidden="true" className={cn("h-8 w-8 shrink-0 select-none", className)} draggable={false} />;
}

/** The full Glas logo (mark + wordmark), or just the mark when space is tight. */
export function GlasLogo({ className, hideWordmark }: { className?: string; hideWordmark?: boolean }) {
  if (hideWordmark) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <GlasMark className="h-9 w-9" />
        <span className="sr-only">Glas Politics</span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center", className)}>
      <img src={glasLogo} alt="Glas Politics" className="h-9 w-auto select-none" draggable={false} />
    </span>
  );
}
