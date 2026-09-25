import { Link } from "wouter";
import { ArrowRight, BarChart3, Check, Landmark, MapPin, type LucideIcon } from "lucide-react";
import { useRegion } from "@/hooks/useRegion";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/pulse/ScoreRing";
import { ScoreRow, StatTile } from "@/components/pulse/Stat";
import type { RegionConfig } from "@shared/region-config";

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function features(region: RegionConfig): { icon: LucideIcon; title: string; body: string }[] {
  const l = region.legislature;
  return [
    { icon: BarChart3, title: `${capitalise(l.memberTitle)} rankings`, body: `All ${l.members} ${l.memberTitlePlural}, scored and sortable.` },
    { icon: Landmark, title: `${l.chamberShort} record`, body: `Every recorded vote, and how your ${l.memberTitlePlural} voted.` },
    { icon: MapPin, title: capitalise(l.seatNamePlural), body: `A page for each of the ${l.seats} ${l.seatNamePlural}.` },
    { icon: Check, title: "Daily vote", body: "Answer today's questions and compare yourself with them." },
  ];
}

/** Grey bars standing in for content that does not exist yet. */
function Placeholder({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-2.5 rounded-full bg-elevated" style={{ width: `${90 - i * 18}%` }} />
      ))}
    </div>
  );
}

/** Home for a preview region: what is coming, shown in the real layout, with no invented data. */
export function RegionPreviewHome() {
  const { region, selectRegion } = useRegion();
  if (!region) return null;
  const l = region.legislature;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-6 overflow-hidden rounded-2xl bg-hero p-6 text-hero-foreground sm:p-10">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-hero-muted px-3 py-1 text-[13px] font-bold">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
          Preview edition · {l.chamber}
        </span>
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-tight sm:text-6xl">
            Glas is coming to the <span className="text-primary">{region.shortName}.</span>
          </h1>
          <p className="max-w-2xl text-base text-hero-soft sm:text-lg">
            Every {l.memberTitle} scored on the votes they turn up for, the questions they ask and how often they
            speak, the same way Glas scores the Dáil today.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={() => void selectRegion("IE")}>
            See the live Irish edition <ArrowRight />
          </Button>
          <Button asChild size="lg" variant="outline" className="border-hero-muted text-hero-foreground hover:bg-hero-muted">
            <Link href="/select-region">Change region</Link>
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label={capitalise(l.memberTitlePlural)} value={l.members} sub={l.chamber} />
        <StatTile label={capitalise(l.seatNamePlural)} value={l.seats} sub="One page each" />
        <StatTile label="Scores" value="Not live" sub="Preview only" className="col-span-2 sm:col-span-1" />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-bold tracking-tight">What the {region.shortName} edition will have</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {features(region).map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-display text-lg font-bold">{title}</h3>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
              <Placeholder />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5 rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">A scorecard, in preview</h2>
            <span className="rounded-full bg-elevated px-2.5 py-0.5 text-xs font-bold text-muted-foreground">Layout only</span>
          </div>
          <div className="flex items-center gap-4">
            <ScoreRing value={null} size={96} label={`${capitalise(l.memberTitle)} score`} />
            <div className="flex flex-col gap-1.5">
              <span className="font-display text-xl font-bold text-muted-foreground">[{capitalise(l.memberTitle)} name]</span>
              <span className="text-sm text-muted-foreground">[Party] · [{capitalise(l.seatName)}]</span>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <ScoreRow label={`${l.chamberShort} record`} value={null} hint="Votes attended and questions asked" />
            <ScoreRow label="Debate" value={null} hint={`How often they speak in the ${l.chamberShort}`} />
            <ScoreRow label="News" value={null} hint="Coverage, weighted by source" />
          </div>
        </div>
        <div className="flex flex-col justify-between gap-5 rounded-2xl border bg-card p-6">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-xl font-bold">Following Irish politics?</h2>
            <p className="text-sm text-muted-foreground">
              The Irish edition is live: all 174 TDs scored from the official Oireachtas record, with Dáil votes,
              constituencies, the ideology quiz and a daily vote.
            </p>
          </div>
          <Placeholder lines={4} />
          <Button variant="secondary" onClick={() => void selectRegion("IE")} className="region-ie w-fit">
            Switch to Ireland <ArrowRight />
          </Button>
        </div>
      </section>
    </div>
  );
}
