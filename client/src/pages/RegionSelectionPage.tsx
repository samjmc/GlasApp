import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowRight, Check } from "lucide-react";
import { useRegion } from "@/hooks/useRegion";
import { GlasLogo } from "@/components/pulse/GlasMark";
import { Button } from "@/components/ui/button";
import { REGION_LIST, type RegionCode } from "@shared/region-config";
import { cn } from "@/lib/utils";

/** Only same-app paths are followed after picking, never another site. */
function safeNext(search: string): string {
  const next = new URLSearchParams(search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/select-region") ? next : "/";
}

/** Where are you following politics? Shown once on a first visit, and any time from the menu. */
export default function RegionSelectionPage() {
  const { regionCode, selectRegion } = useRegion();
  const [, navigate] = useLocation();
  const search = useSearch();
  const [choice, setChoice] = useState<RegionCode>(regionCode ?? "IE");
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    await selectRegion(choice);
    navigate(safeNext(search));
  };

  return (
    // The chosen card's accent tints the whole page while you decide.
    <div className={cn("flex min-h-[100dvh] flex-col items-center px-4 py-8 sm:justify-center sm:py-12", `region-${choice.toLowerCase()}`)}>
      <div className="flex w-full max-w-3xl flex-col gap-8">
        <GlasLogo className="self-center" />

        <header className="flex flex-col gap-3 text-center">
          <h1 className="font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
            Where are you following <span className="text-primary">politics?</span>
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Pick your parliament. You can change this any time from the menu.
          </p>
        </header>

        <div role="radiogroup" aria-label="Region" className="grid gap-3 sm:grid-cols-3">
          {REGION_LIST.map((region) => {
            const selected = region.code === choice;
            const { legislature } = region;
            return (
              <button
                key={region.code}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setChoice(region.code)}
                className={cn(
                  `region-${region.code.toLowerCase()}`,
                  "group relative flex flex-col gap-4 overflow-hidden rounded-2xl border-2 bg-card p-5 text-left transition-[border-color,transform] active:scale-[0.98]",
                  selected ? "border-primary" : "border-transparent hover:border-input"
                )}
              >
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-primary" />
                <span className="flex items-center justify-between gap-2 pt-1">
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary">
                    {region.status === "live" ? "Live" : "Preview"}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border-2",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                    )}
                  >
                    {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                </span>
                <span className="flex flex-col gap-1">
                  <span className="font-display text-2xl font-bold tracking-tight">{region.name}</span>
                  <span className="text-sm font-semibold text-muted-foreground">{legislature.chamber}</span>
                </span>
                <span className="grid grid-cols-2 gap-2">
                  <span className="flex flex-col rounded-xl bg-elevated p-3">
                    <span className="font-display text-xl font-bold leading-none">{legislature.members}</span>
                    <span className="mt-1 text-xs text-muted-foreground">{legislature.memberTitlePlural}</span>
                  </span>
                  <span className="flex flex-col rounded-xl bg-elevated p-3">
                    <span className="font-display text-xl font-bold leading-none">{legislature.seats}</span>
                    <span className="mt-1 text-xs text-muted-foreground">{legislature.seatNamePlural}</span>
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">{region.tagline}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-3">
          <Button size="lg" onClick={confirm} disabled={saving} className="w-full sm:w-72">
            Continue with {REGION_LIST.find((r) => r.code === choice)?.shortName} <ArrowRight />
          </Button>
          <p className="text-xs text-muted-foreground">Previews show what is coming. They contain no real scores yet.</p>
        </div>
      </div>
    </div>
  );
}
