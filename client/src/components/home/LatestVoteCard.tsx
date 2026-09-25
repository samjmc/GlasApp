import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Landmark } from "lucide-react";
import type { DivisionSummary } from "@shared/parliamentApi";
import { apiClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { formatIsoDate } from "@/lib/isoDate";
import { DivisionBar } from "@/components/pulse/VoteChip";
import { EmptyState } from "@/components/pulse/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeCard } from "./HomeCard";

type Envelope = { success: true; data: DivisionSummary[]; meta?: { total: number } };

/** The most recent Dáil division: title, outcome, Tá/Níl split, link to the record. */
export function LatestVoteCard({ className }: { className?: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.parliament.divisions(1, 0),
    queryFn: () => apiClient.get<Envelope>("/api/parliament/divisions?limit=1&offset=0"),
  });
  const vote = data?.data?.[0];

  if (isLoading) {
    return (
      <HomeCard className={className}>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="mt-auto h-3 w-full rounded-full" />
      </HomeCard>
    );
  }

  if (isError || !vote) {
    return (
      <HomeCard className={className}>
        <EmptyState
          icon={Landmark}
          title={isError ? "Dáil votes did not load" : "No Dáil votes yet"}
          action={
            isError ? (
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            ) : undefined
          }
        >
          {isError ? "Check your connection, then try again." : "Votes show here after the Dáil sits."}
        </EmptyState>
      </HomeCard>
    );
  }

  const carried = vote.outcome?.toLowerCase() === "carried";
  const voted = vote.taCount + vote.nilCount + vote.staonCount;

  return (
    <HomeCard className={className}>
      <span className="text-[13px] font-semibold text-muted-foreground">
        Latest Dáil vote · {formatIsoDate(vote.date, { day: "numeric", month: "short" })}
      </span>
      <h2 className="line-clamp-3 font-display text-xl font-bold leading-tight tracking-tight md:text-2xl">
        {vote.debateTitle ?? vote.subject ?? "Dáil division"}
      </h2>
      <div className="flex flex-wrap items-center gap-2.5">
        {vote.outcome && <Badge variant={carried ? "success" : "warn"}>{carried ? "Carried" : vote.outcome}</Badge>}
        <span className="text-sm text-muted-foreground">{voted} TDs voted</span>
      </div>
      <DivisionBar ta={vote.taCount} nil={vote.nilCount} className="mt-auto" />
      <Link href="/debates" className="text-sm font-bold text-primary hover:underline">
        How did your TDs vote?
      </Link>
    </HomeCard>
  );
}
