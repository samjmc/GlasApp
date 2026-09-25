/**
 * Today's biggest impact: the highest-impact news story of the day.
 */

import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/queryKeys";
import { useRegion } from "@/hooks/useRegion";
import { ArticleImage } from "@/components/news/ArticleImage";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeedArticle } from "@/lib/news";
import { cn } from "@/lib/utils";

interface TodaysBiggestImpactProps {
  /** "compact" drops the image, for tight columns. */
  variant?: "compact" | "full";
}

const Eyebrow = () => (
  <span className="flex items-center gap-2 text-[13px] font-semibold text-primary">
    <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
    Today&apos;s biggest impact
  </span>
);

/** Highlights today's biggest-impact story (full or compact variant). */
export function TodaysBiggestImpact({ variant = "full" }: TodaysBiggestImpactProps) {
  const { regionCode } = useRegion();
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: queryKeys.news.biggestImpact(regionCode),
    queryFn: async () => {
      const res = await fetch("/api/news-feed?sort=today&limit=1");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      return json.data as { articles: FeedArticle[]; total: number; hasMore: boolean };
    },
    staleTime: 1000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5" aria-label="Loading today's biggest story">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-input bg-card p-5">
        <Eyebrow />
        <span className="font-display text-lg font-bold">Today&apos;s top story did not load</span>
        <span className="text-sm text-muted-foreground">Check your connection, then try again.</span>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="mt-1 h-11">
          {isFetching && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isFetching ? "Loading…" : "Try again"}
        </Button>
      </div>
    );
  }

  const article = data?.articles?.[0];

  if (!article) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-input bg-card p-5">
        <Eyebrow />
        <span className="font-display text-lg font-bold">No story scored yet today</span>
        <span className="text-sm text-muted-foreground">
          We are reading today&apos;s political news. The story with the biggest effect on a TD will lead here once it
          is scored.
        </span>
      </div>
    );
  }

  const impact = article.impactScore ?? 0;
  const isPositive = impact > 0;
  const lead = article.affectedTDs?.[0];
  const body = article.aiSummary ?? article.summary;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition-[background-color,transform] duration-150 hover:bg-accent active:scale-[0.98] sm:flex-row"
    >
      {variant === "full" && (
        <ArticleImage
          src={article.imageUrl}
          alt=""
          source={article.source}
          sourceLogoUrl={article.sourceLogoUrl}
          category={article.category}
          priority
          className="rounded-none sm:w-64 sm:shrink-0"
        />
      )}
      <div className="flex min-w-0 flex-col gap-2 p-5">
        <Eyebrow />
        <h3 className="font-display text-xl font-bold leading-tight tracking-tight group-hover:text-primary">
          {article.title}
          <span className="sr-only"> (opens in a new tab)</span>
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          <span className="font-semibold text-foreground">{article.source}</span>
          <span>{new Date(article.publishedAt).toLocaleDateString("en-IE")}</span>
          <span className={cn("inline-flex items-center gap-1 font-bold", isPositive ? "text-score-high" : "text-warn")}>
            {isPositive ? <TrendingUp className="h-4 w-4" aria-hidden="true" /> : <TrendingDown className="h-4 w-4" aria-hidden="true" />}
            {isPositive ? "+" : ""}
            {impact} impact
          </span>
          {lead && (
            <span>
              <span className="font-semibold text-foreground">{lead.name}</span>
              {lead.impactScore !== undefined && (
                <span className={cn("ml-1 font-bold", lead.impactScore > 0 ? "text-score-high" : "text-warn")}>
                  {lead.impactScore > 0 ? "+" : ""}
                  {lead.impactScore}
                </span>
              )}
            </span>
          )}
        </div>
        {body && <p className="line-clamp-3 text-sm text-muted-foreground">{body}</p>}
      </div>
    </a>
  );
}
