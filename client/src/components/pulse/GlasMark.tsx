import glasMark from "@assets/glas-mark-192.png";
import { cn } from "@/lib/utils";

/** The Glas hexagon mark (from the real logo). */
export function GlasMark({ className }: { className?: string }) {
  return <img src={glasMark} alt="" aria-hidden="true" className={cn("h-8 w-8 shrink-0 select-none", className)} draggable={false} />;
}

/** The logo as shown in the app frame: the mark alone, named for screen readers. */
export function GlasLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <GlasMark className="h-10 w-10" />
      <span className="sr-only">Glas Politics</span>
    </span>
  );
}
