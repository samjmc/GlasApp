import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRegion } from "@/hooks/useRegion";
import { REGION_CONFIGS } from "@shared/region-config";
import { Loader2 } from "lucide-react";

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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <p className="text-sm text-gray-500">Preparing regions…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <p className="text-sm uppercase tracking-wide text-emerald-500 font-semibold">
            Multi-region preview
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choose your political landscape
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Glas keeps the accountability loop identical everywhere. Pick your region to load
            local politicians, sentiment feeds, and retention streaks. You can switch anytime
            from the header.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {availableRegions.map((region) => {
            const config = REGION_CONFIGS[region.code];
            const isSelected = regionCode === region.code;
            const isPreview = Boolean(region.code === "US");

            return (
              <Card
                key={region.code}
                className={`p-6 border-2 transition-shadow ${
                  isSelected
                    ? "border-emerald-400 shadow-lg"
                    : "border-transparent hover:shadow-lg"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-3xl mb-2" aria-hidden>
                      {config.assets.flagEmoji}
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {config.name}
                    </h2>
                  </div>
                  {isSelected && (
                    <span className="px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">
                      Active
                    </span>
                  )}
                  {!isSelected && isPreview && (
                    <span className="px-3 py-1 text-xs font-semibold bg-sky-100 text-sky-700 rounded-full">
                      Preview
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {config.home.tagline}
                </p>
                {config.home.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    {config.home.description}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {isPreview
                      ? "Mock data enabled – final integrations coming soon."
                      : "Live Irish dataset with TD tracking."}
                  </div>
                  <Button
                    variant={isSelected ? "secondary" : "default"}
                    onClick={() => selectRegion(region.code)}
                    disabled={status === "loading"}
                  >
                    {isSelected ? "Selected" : `Use ${region.shortName}`}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {isMockRegion && (
          <div className="mt-10 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-sm text-blue-800 dark:text-blue-200">
            Mock data is active for this region. Core loops, streaks, and routing work exactly as
            production; real datasets will plug in next.
          </div>
        )}
      </div>
    </div>
  );
}




















