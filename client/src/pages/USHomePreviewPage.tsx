import { TodaysBiggestImpact } from "@/components/TodaysBiggestImpact";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { REGION_NEWS_MOCK, REGION_CONFIGS } from "@shared/region-config";
import { ArrowRight, CalendarCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";

const UPCOMING_FEATURES = [
  {
    title: "Representative scorecards",
    description:
      "Full sentiment tracking for members of Congress, with the same trust, delivery, and impact metrics used for Irish TDs.",
  },
  {
    title: "District heatmaps",
    description:
      "Explore how issues play out across swing districts and local media markets once we land the full US boundary set.",
  },
  {
    title: "Polling and retention loop",
    description:
      "Daily streaks already work in this preview. Soon, you’ll also get US-specific dopamine loops tied to national votes.",
  },
];

export default function USHomePreviewPage() {
  const usConfig = REGION_CONFIGS.US;
  const sampleArticles = REGION_NEWS_MOCK.US?.articles ?? [];

  return (
    <>
      <section className="bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-blue-900/30 dark:via-slate-900 dark:to-purple-900/20 rounded-3xl border border-blue-100 dark:border-blue-900/40 px-6 py-12 md:px-12 md:py-16 mb-10 shadow-sm">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="text-6xl" aria-hidden>
            {usConfig.assets.flagEmoji}
          </div>
          <p className="text-sm uppercase tracking-[0.4em] text-blue-600 dark:text-blue-300 font-semibold">
            US preview mode
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            {usConfig.home.title}
          </h1>
          <p className="text-base md:text-lg text-gray-600 dark:text-gray-300">
            {usConfig.home.tagline}
          </p>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 max-w-3xl mx-auto">
            {usConfig.home.description}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Button asChild size="lg">
              <Link href="/daily-session">
                <span className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4" />
                  Launch mock daily loop
                </span>
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/select-region">
                <span className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Switch region
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[2fr_3fr] items-start mb-12">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              What works in the US preview
            </h2>
          </div>
          <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
            <li>
              ✅ Daily streak logic with mock US policy stories—keep your loop alive while we add
              real datasets.
            </li>
            <li>
              ✅ Impact feed showing how the news module will highlight bipartisan wins and ethics
              probes.
            </li>
            <li>
              ✅ Region switching for testing; return to Ireland anytime to see the full production
              experience.
            </li>
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Today&apos;s highest-impact mock story
          </h2>
          <TodaysBiggestImpact />
        </Card>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Upcoming US features
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {UPCOMING_FEATURES.map((feature) => (
            <Card key={feature.title} className="p-5 h-full border-dashed border-blue-200 dark:border-blue-900/40">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {sampleArticles.length > 0 && (
        <section className="mb-16">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Mock impact feed highlights
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {sampleArticles.map((article) => (
              <Card key={article.id} className="p-5">
                <p className="text-xs uppercase tracking-wide text-blue-500 mb-2">
                  {new Date(article.publishedDate).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                  {article.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  {article.aiSummary}
                </p>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Source: {article.source}
                </span>
              </Card>
            ))}
          </div>
        </section>
      )}
    </>
  );
}



















