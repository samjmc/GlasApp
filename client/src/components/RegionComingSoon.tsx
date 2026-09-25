import { Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRegion } from "@/hooks/useRegion";
import type { RegionFeatureKey } from "@shared/region-config";
import { Link } from "wouter";

const FEATURE_COPY: Partial<
  Record<RegionFeatureKey, { title: string; body: string }>
> = {
  politicianProfiles: {
    title: "Representative scorecards",
    body: "We’re lining up federal and swing-district scorecards so you can compare how representatives stack up across trust, delivery, and sentiment.",
  },
  partyProfiles: {
    title: "Party deep dives",
    body: "National party performance tracking is in progress. Expect ideology explanations, trust metrics, and policy follow-through soon.",
  },
  constituencyInsights: {
    title: "District-level insights",
    body: "We’re mapping US congressional districts with the same depth we provide for Irish constituencies. Detailed analytics are on the way.",
  },
  maps: {
    title: "Interactive map views",
    body: "Geo visualisations for US issues and turnout trends are in development. You’ll be able to explore hotspots once data pipelines are ready.",
  },
  polling: {
    title: "Polling & rankings",
    body: "Our polling dashboards are currently Irish-only. US polling sentiment and leaderboard loops are being staged next.",
  },
  quiz: {
    title: "Personal alignment quiz",
    body: "We’re adapting the political alignment quiz for US context. Once the prompts are tuned you’ll see US-specific alignment journeys.",
  },
  personalInsights: {
    title: "Personal insights",
    body: "Insights tied to US representatives and national issues are in progress. Daily streaks already work—insights will follow shortly.",
  },
  localRepresentatives: {
    title: "Local reps directory",
    body: "We’re compiling datasets for congressional districts to mirror the Irish TD directory. Expect coverage soon.",
  },
  conflictTracking: {
    title: "Conflict map",
    body: "The conflict visualisations are being reworked to emphasise US-centric indicators. They’ll return with new overlays soon.",
  },
  education: {
    title: "Political education",
    body: "US-focused explainer content is coming so you can onboard friends with core democratic concepts and accountability metrics.",
  },
  ratings: {
    title: "Ratings & reviews",
    body: "Trust scores and user rating flows depend on the representative dataset. Once it lands, you’ll be able to rate US figures too.",
  },
};

const DEFAULT_COPY = {
  title: "Feature coming soon",
  body: "We’re wiring this section for the US preview. Switch back to the Ireland region anytime to see the production experience.",
};

type RegionComingSoonProps = {
  feature: RegionFeatureKey;
  headline?: string;
};

/** Placeholder card shown when a feature is not yet available in a region. */
export function RegionComingSoon({ feature, headline }: RegionComingSoonProps) {
  const { region, selectRegion, regionCode } = useRegion();
  const copy = FEATURE_COPY[feature] ?? DEFAULT_COPY;
  const regionName = region?.shortName ?? "this region";

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-elevated text-muted-foreground" aria-hidden="true">
        <Globe2 className="h-8 w-8" />
      </span>
      <h1 className="mb-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {headline ?? `${copy.title} – coming soon to ${regionName}`}
      </h1>
      <p className="mb-6 text-base text-muted-foreground sm:text-lg">
        {copy.body}
      </p>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Want the full production experience right now? Switch back to Ireland and explore every
          feature while we finish the US build.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/select-region">Change region</Link>
          </Button>
          {regionCode !== "IE" && (
            <Button
              variant="outline"
              onClick={() => selectRegion("IE")}
            >
              Jump to Irish experience
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
