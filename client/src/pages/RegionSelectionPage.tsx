import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRegion } from "@/hooks/useRegion";
import { REGION_CONFIGS } from "@shared/region-config";

export default function RegionSelectionPage() {
  const { regionCode, status, availableRegions, selectRegion, isMockRegion } = useRegion();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (status === "ready" && regionCode && location === "/select-region") {
      navigate("/", { replace: true });
    }
  }, [status, regionCode, location, navigate]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Preparing regions…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10 sm:py-16">
        <div className="flex flex-col gap-3 text-center sm:text-left">
          <span className="text-[13px] font-bold uppercase tracking-wide text-primary">
            Multi-region preview
          </span>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Choose your political landscape
          </h1>
          <p className="text-base text-muted-foreground">
            Glas keeps the accountability loop identical everywhere. Pick your region to load
            local politicians, sentiment feeds, and retention streaks. You can switch anytime
            from the header.
          </p>
        </div>

        <div role="radiogroup" aria-label="Region" className="flex flex-col gap-3">
          {availableRegions.map((region) => {
            const config = REGION_CONFIGS[region.code];
            const isSelected = regionCode === region.code;
            const isPreview = Boolean(region.code === "US");

            return (
              <button
                key={region.code}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => selectRegion(region.code)}
                className={`flex w-full flex-col gap-3 rounded-2xl border-2 bg-card p-4 text-left transition-colors sm:p-5 ${
                  isSelected ? "border-primary" : "border-border hover:border-input"
                }`}
              >
                <span className="flex w-full items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-base font-extrabold tracking-wide ${
                      isSelected ? "bg-primary text-primary-foreground" : "bg-elevated text-foreground"
                    }`}
                  >
                    {region.code}
                  </span>
                  <span className="flex min-w-0 flex-grow flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-xl font-bold tracking-tight">{config.name}</span>
                      {isSelected && <Badge variant="success">Active</Badge>}
                      {!isSelected && isPreview && <Badge variant="outline">Preview</Badge>}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {isPreview
                        ? "Mock data enabled – final integrations coming soon."
                        : "Live Irish dataset with TD tracking."}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 ${
                      isSelected ? "border-primary bg-primary" : "border-input"
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
                  </span>
                </span>
                <span className="text-sm leading-relaxed">{config.home.tagline}</span>
              </button>
            );
          })}
        </div>

        {isMockRegion && (
          <div role="status" className="flex items-start gap-3 rounded-2xl border border-input bg-elevated p-4 text-sm leading-relaxed">
            Mock data is active for this region. Core loops, streaks, and routing work exactly as
            production; real datasets will plug in next.
          </div>
        )}

        <Button size="lg" className="w-full gap-2" onClick={() => navigate("/", { replace: true })}>
          {regionCode === "US" ? "Use United States" : "Use Ireland"}
        </Button>
      </div>
    </div>
  );
}
