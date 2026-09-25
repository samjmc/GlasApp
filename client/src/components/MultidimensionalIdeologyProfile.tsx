import React, { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { DIMENSION_POLES, IDEOLOGY_DIMENSIONS, type IdeologyDimension, type IdeologyVector } from "@shared/ideology";
import { describePosition } from "@/lib/ideologyDisplay";
import { cn } from "@/lib/utils";

interface MultidimensionalIdeologyProfileProps {
  dimensions: IdeologyVector;
  ideology: string;
  description: string;
  /** Icon buttons shown in the hero band (download, share). */
  actions?: ReactNode;
}

// What each dimension measures. Pole names come from DIMENSION_POLES.
const DIMENSION_MEASURES: Record<IdeologyDimension, string> = {
  economic: "How much the state should shape the economy.",
  social: "Attitudes toward social norms, values and social change.",
  cultural: "Attitudes toward cultural identity, traditions, and heritage.",
  authority: "Attitudes toward authority, personal freedom, and social control.",
  environmental: "Priority given to environmental protection versus economic growth.",
  welfare: "How much support should come from the state versus individuals and families.",
  globalism: "Attitudes toward international cooperation, sovereignty, and borders.",
  technocratic: "Trust in expertise versus popular opinion in decision-making.",
};

export const formatDimensionValue = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}`;

/** −10..+10 → 0..100 (%). */
const toPercent = (value: number) => ((Math.min(Math.max(value, -10), 10) + 10) / 20) * 100;

/** The quiz result: a hero band with the ideology name, then the eight dimensions. */
const MultidimensionalIdeologyProfile: React.FC<MultidimensionalIdeologyProfileProps> = ({
  dimensions,
  ideology,
  description,
  actions,
}) => {
  const [expandedDimension, setExpandedDimension] = useState<IdeologyDimension | null>(null);
  const strongest = IDEOLOGY_DIMENSIONS.reduce((a, b) => (Math.abs(dimensions[b]) > Math.abs(dimensions[a]) ? b : a));

  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-3 rounded-2xl bg-hero p-5 text-hero-foreground sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <span className="pt-2 text-[13px] font-semibold text-hero-soft">Your political profile</span>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
        <h1 className="font-display text-[32px] font-extrabold leading-[1.04] tracking-tight sm:text-5xl">{ideology}</h1>
        {description && <p className="max-w-2xl text-[15px] leading-relaxed text-hero-soft sm:text-base">{description}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="inline-flex h-8 items-center rounded-full bg-hero-muted px-3 text-[13px] font-semibold">
            Strongest: {DIMENSION_POLES[strongest].label}
          </span>
          <span className="inline-flex h-8 items-center rounded-full bg-hero-muted px-3 text-[13px] font-semibold">
            {describePosition(strongest, dimensions[strongest])}
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-[22px] font-bold">Your 8 dimensions</h2>
          <p className="text-[13px] text-muted-foreground">Each runs from −10 to +10. Tap one to see what it means.</p>
        </div>
        <ul className="grid gap-1 md:grid-cols-2 md:gap-x-4">
          {IDEOLOGY_DIMENSIONS.map((dim) => {
            const value = dimensions[dim];
            const poles = DIMENSION_POLES[dim];
            const at = toPercent(value);
            const isOpen = expandedDimension === dim;
            return (
              <li key={dim}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setExpandedDimension(isOpen ? null : dim)}
                  className={cn(
                    "flex w-full flex-col gap-1.5 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isOpen && "bg-elevated"
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                      <span className="text-[15px] font-bold">{poles.label}</span>
                      <span className="text-[13px] text-muted-foreground">{describePosition(dim, value)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-display text-lg font-bold tabular-nums">{formatDimensionValue(value)}</span>
                      <ChevronDown
                        className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")}
                        aria-hidden="true"
                      />
                    </span>
                  </span>
                  <span className="relative block h-2.5 rounded-full bg-input" aria-hidden="true">
                    <span
                      className="absolute inset-y-0 bg-primary/30"
                      style={{ left: `${Math.min(at, 50)}%`, width: `${Math.abs(at - 50)}%` }}
                    />
                    <span className="absolute -top-[3px] left-1/2 h-4 w-0.5 bg-muted-foreground" />
                    <span
                      className="absolute -top-1 h-[18px] w-[18px] -translate-x-1/2 rounded-full border-[3px] border-card bg-primary transition-[left] duration-500"
                      style={{ left: `${at}%` }}
                    />
                  </span>
                  <span className="flex justify-between text-xs text-muted-foreground">
                    <span>{poles.negative}</span>
                    <span>{poles.positive}</span>
                  </span>
                  {isOpen && (
                    <span className="rounded-lg bg-background p-3 text-sm leading-relaxed">
                      Your score of {formatDimensionValue(value)}
                      {value === 0
                        ? " sits at the centre. "
                        : ` means you lean toward the ${value > 0 ? poles.positive : poles.negative} side. `}
                      {DIMENSION_MEASURES[dim]} −10 is {poles.negative}; +10 is {poles.positive}.
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};

export default MultidimensionalIdeologyProfile;
