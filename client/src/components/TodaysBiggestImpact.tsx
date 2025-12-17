/**
 * Today's Biggest Impact - Hero Section
 * Shows the highest impact news story of the day
 */

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useRegion } from "@/hooks/useRegion";

interface TodaysBiggestImpactProps {
  variant?: "compact" | "full";
}

export function TodaysBiggestImpact({ variant = "full" }: TodaysBiggestImpactProps) {
  const { regionCode } = useRegion();
  const cardBase =
    variant === "compact"
      ? "mobile-card-tight bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
      : "mobile-card mobile-card-tight bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800";
  const { data, isLoading } = useQuery({
    queryKey: ['biggest-impact-today-v4', regionCode],  // v4 - includes policy articles + logos
    queryFn: async () => {
      const res = await fetch('/api/news-feed?sort=today&limit=1');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 1000 // Very short cache to force refresh
  });

  if (isLoading) {
    return (
      <Card className={`${cardBase} animate-pulse bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-2 border-orange-200`}>
        <div className="h-6 bg-orange-200 rounded w-1/4 mb-4"></div>
        <div className="h-8 bg-orange-300 rounded w-3/4 mb-3"></div>
        <div className="h-4 bg-orange-200 rounded w-1/2"></div>
      </Card>
    );
  }

  const article = data?.articles?.[0];
  
  if (!article) {
    return (
      <Card className={`${cardBase} bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-200`}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse"></div>
          <span className="text-sm font-semibold text-purple-900 dark:text-purple-100 uppercase tracking-wide">
            Awaiting Today's Impact
          </span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          News analysis in progress...
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Our AI is analyzing today's political news. The highest impact story will appear here shortly.
        </p>
      </Card>
    );
  }

  const impactScore = Math.abs(article.impactScore || 0);
  const isPositive = (article.impactScore || 0) > 0;
  const sentiment = article.sentiment || 'neutral';

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <Card className={`${cardBase} relative overflow-hidden shadow-lg transition hover:shadow-xl cursor-pointer group min-h-[256px]`}>
        {/* Background Image Layer */}
        <div className="absolute inset-0 z-0">
          {article.imageUrl ? (
            <img 
              src={article.imageUrl} 
              alt="" 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-800" />
          )}
          {/* Overlay - Dark enough for white text (75% black opacity) */}
          <div className="absolute inset-0 bg-black/75" />
        </div>

        {/* Content Layer */}
        <div className="relative z-10 flex flex-col h-full p-4 sm:p-6">
          {/* Title */}
          <div className="flex flex-col gap-1 mb-3">
            <h2 className="text-base font-semibold text-white group-hover:text-emerald-400 transition drop-shadow-md">
              {article.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-gray-200 border-white/20 bg-white/10">
                {new Date(article.publishedDate).toLocaleDateString("en-IE")}
              </Badge>
              <Badge variant="outline" className="text-[10px] text-gray-200 border-white/20 bg-white/10">
                📰 {article.source}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  sentiment === "positive"
                    ? "border-green-300/50 text-green-300 bg-green-500/10"
                    : sentiment === "negative"
                    ? "border-red-300/50 text-red-300 bg-red-500/10"
                    : "border-gray-300/50 text-gray-300 bg-gray-500/10"
                }`}
              >
                {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
              </Badge>
            </div>
          </div>

          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
            {/* Impact Score */}
            <div className="flex items-center gap-1">
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400" />
              )}
              <span className={`text-sm font-semibold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                {isPositive ? "+" : ""}
                {impactScore}
              </span>
              <span className="text-gray-300">Impact</span>
            </div>
            {article.affectedTDs && article.affectedTDs.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="font-semibold text-white">
                  {article.affectedTDs[0].name}
                </span>
                {article.affectedTDs[0].impactScore !== undefined && (
                  <span className={`font-semibold ${article.affectedTDs[0].impactScore > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {article.affectedTDs[0].impactScore > 0 ? "+" : ""}
                    {article.affectedTDs[0].impactScore}
                  </span>
                )}
              </div>
            )}
            {!article.affectedTDs && article.politicianName && (
              <div className="flex items-center gap-1">
                <span className="font-semibold text-white">{article.politicianName}</span>
                {article.scoreChange && (
                  <span className={`font-semibold ${article.scoreChange > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {article.scoreChange > 0 ? "+" : ""}
                    {article.scoreChange}
                  </span>
                )}
              </div>
            )}
          </div>

        {/* AI Summary - Full Text */}
        {article.aiSummary && (
          <p className="text-sm text-gray-200 drop-shadow-sm">
            {article.aiSummary}
          </p>
        )}
        </div>
      </Card>
    </a>
  );
}

