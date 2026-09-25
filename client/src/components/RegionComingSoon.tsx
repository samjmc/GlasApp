import { Link, useLocation } from "wouter";
import { ArrowRight, Hourglass } from "lucide-react";
import { useRegion } from "@/hooks/useRegion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RegionConfig } from "@shared/region-config";

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What the section at this path will be called in a preview region. */
function sectionTitle(path: string, region: RegionConfig): string {
  const l = region.legislature;
  const edition = `the ${region.shortName} edition`;
  if (path.startsWith("/rankings") || path.startsWith("/td/")) return `${capitalise(l.memberTitle)} rankings are coming to ${edition}`;
  if (path.startsWith("/party/")) return `Party pages are coming to ${edition}`;
  if (path.startsWith("/debates")) return `The ${l.chamberShort} record is coming to ${edition}`;
  if (path.startsWith("/constituenc")) return `${capitalise(l.seatName)} pages are coming to ${edition}`;
  if (path.startsWith("/quiz")) return `The ideology quiz is coming to ${edition}`;
  if (path.startsWith("/daily-session")) return `The daily vote is coming to ${edition}`;
  return `This page is coming to ${edition}`;
}

/** Any section of a preview region: says what is coming, with the page's shape greyed out below. */
export function RegionComingSoon() {
  const { region, selectRegion } = useRegion();
  const [location] = useLocation();
  if (!region) return null;
  const title = sectionTitle(location, region);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col items-start gap-4 rounded-2xl border bg-card p-6 sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Hourglass className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-muted-foreground">{region.name} · preview</span>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="max-w-xl text-muted-foreground">
            It will work like the Irish edition, for all {region.legislature.members} {region.legislature.memberTitlePlural}.
            Nothing here is scored yet.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/">Back to the {region.shortName} preview</Link>
          </Button>
          <Button variant="outline" onClick={() => void selectRegion("IE")}>
            See it live in Ireland <ArrowRight />
          </Button>
        </div>
      </section>

      <div className="grid gap-3 opacity-60 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border bg-card p-5">
            <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
