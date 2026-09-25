import { Link } from "wouter";
import { ArrowRight, CalendarCheck, Check } from "lucide-react";
import { TodaysBiggestImpact } from "@/components/TodaysBiggestImpact";
import { Button } from "@/components/ui/button";
import { REGION_NEWS_MOCK, REGION_CONFIGS } from "@shared/region-config";

const WORKS_NOW = [
  "Daily streaks with sample US policy stories.",
  "The impact feed, showing how news will rate each member.",
  "Region switching: go back to Ireland for the full live app.",
];

const UPCOMING_FEATURES = [
  {
    title: "Representative scorecards",
    description: "Scores for members of Congress, built the same way as the scores for Irish TDs.",
  },
  {
    title: "District maps",
    description: "How issues play out across districts and local media, once the full US boundary set is in.",
  },
  {
    title: "Daily votes on US bills",
    description: "The daily loop, tied to real national votes.",
  },
];

export default function USHomePreviewPage() {
  const usConfig = REGION_CONFIGS.US;
  const sampleArticles = REGION_NEWS_MOCK.US?.articles ?? [];

  return (
    <div className="flex flex-col gap-8 pb-8">
      <section className="flex flex-col gap-4 pt-2">
        <span className="text-[13px] font-semibold text-primary">US preview</span>
        <h1 className="font-display text-4xl font-bold leading-none tracking-tight md:text-5xl">{usConfig.home.title}</h1>
        <p className="max-w-2xl text-base text-muted-foreground md:text-lg">{usConfig.home.tagline}</p>
        <p className="max-w-2xl text-sm text-muted-foreground">{usConfig.home.description}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/daily-session">
              <CalendarCheck className="h-4 w-4" aria-hidden="true" />
              Try the daily loop
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/select-region">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              Switch region
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid items-start gap-5 md:grid-cols-[2fr_3fr]">
        <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6">
          <h2 className="font-display text-xl font-bold">What works in the preview</h2>
          <ul className="flex flex-col gap-3 text-sm">
            {WORKS_NOW.map((item) => (
              <li key={item} className="flex gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">Top sample story</h2>
          <TodaysBiggestImpact />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold">Coming to the US</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {UPCOMING_FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-dashed border-input bg-card p-5">
              <h3 className="mb-2 font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {sampleArticles.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">Sample impact feed</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {sampleArticles.map((article) => (
              <article key={article.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-5">
                <span className="text-[13px] font-semibold text-muted-foreground">
                  {new Date(article.publishedDate).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <h3 className="font-semibold leading-snug">{article.title}</h3>
                <p className="text-sm text-muted-foreground">{article.aiSummary}</p>
                <span className="mt-auto text-xs text-muted-foreground">Source: {article.source}</span>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
