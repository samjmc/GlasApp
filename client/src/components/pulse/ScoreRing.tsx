import { cn } from "@/lib/utils";
import { formatScore, scoreTone, TONE_STROKE } from "@/lib/score";

interface ScoreRingProps {
  /** 0–100, or null when there is no data. */
  value: number | null | undefined;
  /** Diameter in px. */
  size?: number;
  /** Ring thickness in px; defaults to ~8% of the size. */
  thickness?: number;
  /** What the score measures, for screen readers ("Overall score"). */
  label?: string;
  /** Small line under the number, e.g. "of 100". */
  caption?: string;
  /** Track colour class; pass `stroke-hero-muted` on the hero band. */
  trackClassName?: string;
  className?: string;
  numberClassName?: string;
}

/** A 0–100 score as a ring. Colour follows the one score rule in lib/score.ts. */
export function ScoreRing({
  value,
  size = 88,
  thickness,
  label = "Score",
  caption,
  trackClassName = "stroke-input",
  className,
  numberClassName,
}: ScoreRingProps) {
  const stroke = thickness ?? Math.max(5, Math.round(size * 0.08));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const tone = scoreTone(value);
  const clamped = tone ? Math.min(100, Math.max(0, value as number)) : 0;
  const text = formatScore(value);

  return (
    <div
      role="img"
      aria-label={tone ? `${label}: ${text} out of 100` : `${label}: no data yet`}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={tone ? undefined : "3 5"}
          className={trackClassName}
        />
        {tone && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(circumference * clamped) / 100} ${circumference}`}
            className={cn(TONE_STROKE[tone], "transition-[stroke-dasharray] duration-700 ease-out")}
          />
        )}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none" aria-hidden="true">
        <span
          className={cn("font-display font-extrabold tracking-tight", !tone && "text-muted-foreground", numberClassName)}
          style={{ fontSize: Math.round(size * 0.34) }}
        >
          {text}
        </span>
        {caption && <span className="mt-1 text-xs font-semibold opacity-75">{caption}</span>}
      </span>
    </div>
  );
}
