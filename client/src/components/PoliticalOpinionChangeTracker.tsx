import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { DIMENSION_POLES, IDEOLOGY_DIMENSIONS } from "@shared/ideology";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMyQuizResults } from "@/lib/ideologyApi";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

/** A move of this size (in −10..+10 units) counts as a real change. */
const NOTABLE_CHANGE = 1.5;

const formatDate = (iso: string | null, pattern: string) => (iso ? format(new Date(iso), pattern) : "Unknown date");
const pos = (v: number) => `${((Math.min(Math.max(v, -10), 10) + 10) / 20) * 100}%`;

/**
 * Compares the signed-in user's latest saved quiz result with an earlier one
 * (GET /api/quiz/me). Renders nothing when signed out or with fewer than two results.
 */
const PoliticalOpinionChangeTracker: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);

  const { data: history } = useQuery({
    queryKey: queryKeys.quiz.mine(user?.id),
    queryFn: fetchMyQuizResults,
    enabled: isAuthenticated,
  });

  if (!isAuthenticated || !history || history.length < 2) return null;

  const [latest, ...earlier] = history;
  const previous = earlier.find((h) => h.id === selectedHistoryId) ?? earlier[0];

  const changes = IDEOLOGY_DIMENSIONS.map((dimension) => {
    const current = latest.vector[dimension];
    const prior = previous.vector[dimension];
    return { dimension, current, prior, diff: current - prior };
  });
  const notable = changes.filter((c) => Math.abs(c.diff) >= NOTABLE_CHANGE).length;

  return (
    <section className="flex flex-col gap-3.5 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-display text-[22px] font-bold">How your views changed</h2>
        <p className="text-[13px] text-muted-foreground">
          {notable > 0
            ? `${notable} dimension${notable === 1 ? "" : "s"} moved by ${NOTABLE_CHANGE} or more since ${formatDate(previous.createdAt, "d MMM yyyy")}.`
            : `Your views have stayed steady since ${formatDate(previous.createdAt, "d MMM yyyy")}.`}
        </p>
      </div>

      {earlier.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="history-select">Compare with</Label>
          <Select value={String(previous.id ?? "")} onValueChange={(v) => setSelectedHistoryId(Number(v))}>
            <SelectTrigger id="history-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {earlier.map((result) => (
                <SelectItem key={result.id} value={String(result.id ?? "")}>
                  {formatDate(result.createdAt, "d MMM yyyy")} · {result.ideology || "Quiz result"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <ul className="grid gap-3.5 md:grid-cols-2 md:gap-x-6">
        {changes.map(({ dimension, current, prior, diff }) => {
          const poles = DIMENSION_POLES[dimension];
          const moved = Math.abs(diff) >= 0.5;
          return (
            <li key={dimension} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-bold">{poles.label}</span>
                <span className={cn("text-[13px] font-bold", Math.abs(diff) >= NOTABLE_CHANGE ? "text-primary" : "text-muted-foreground")}>
                  {moved ? `${Math.abs(diff).toFixed(1)} toward ${diff > 0 ? poles.positive : poles.negative}` : "No change"}
                </span>
              </div>
              <div
                className="relative h-2 rounded-full bg-elevated"
                role="img"
                aria-label={`${poles.label}: ${prior.toFixed(1)} then, ${current.toFixed(1)} now`}
              >
                <span className="absolute -top-[3px] left-1/2 h-3.5 w-0.5 bg-input" />
                <span
                  className="absolute -top-[3px] h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-muted-foreground bg-card"
                  style={{ left: pos(prior) }}
                />
                <span className="absolute -top-[3px] h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-primary" style={{ left: pos(current) }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{poles.negative}</span>
                <span>{poles.positive}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2 border-muted-foreground" aria-hidden="true" />
          {formatDate(previous.createdAt, "d MMM yyyy")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-primary" aria-hidden="true" />
          Latest · {formatDate(latest.createdAt, "d MMM yyyy")}
        </span>
      </p>
    </section>
  );
};

export default PoliticalOpinionChangeTracker;
