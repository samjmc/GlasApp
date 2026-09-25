import React, { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Users } from "lucide-react";
import { DIMENSION_POLES, type IdeologyDimension, type IdeologyVector } from "@shared/ideology";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/pulse/EmptyState";
import { PartyDot, TDAvatar } from "@/components/pulse/Party";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { partyStyle } from "@/lib/parties";
import {
  fetchMatchesForVector,
  fetchMyMatches,
  type DimensionWeights,
  type Matches,
} from "@/lib/ideologyApi";

interface PartyMatchResultsProps {
  /** The quiz result being shown; used for anonymous matching and as the fallback when the user has no saved profile yet. */
  dimensions: IdeologyVector;
  weights: DimensionWeights;
}

const WEIGHT_DEBOUNCE_MS = 300;
const TOP_PARTIES = 3;
const BOTTOM_PARTIES = 2;
const TOP_TDS = 5;

const labels = (dims: IdeologyDimension[]) => dims.map((d) => DIMENSION_POLES[d].label).join(", ");

const cardClass = "flex flex-col gap-3.5 rounded-2xl border bg-card p-4 sm:p-5";

/**
 * Party and TD matches for the results page. Signed in: the user's saved profile
 * (GET /api/ideology/me/matches). Anonymous, or signed in with no profile yet: the
 * quiz vector on this page (POST /api/ideology/matches).
 */
const PartyMatchResults: React.FC<PartyMatchResultsProps> = ({ dimensions, weights }) => {
  const { user, isAuthenticated } = useAuth();

  // Weight changes fire quickly; wait for the user to settle before refetching.
  const [activeWeights, setActiveWeights] = useState(weights);
  useEffect(() => {
    const timer = window.setTimeout(() => setActiveWeights(weights), WEIGHT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [weights]);

  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useQuery<Matches>({
    queryKey: isAuthenticated
      ? queryKeys.ideology.myMatches(user?.id, activeWeights)
      : queryKeys.ideology.vectorMatches(dimensions, activeWeights),
    queryFn: async () => {
      if (isAuthenticated) {
        const mine = await fetchMyMatches(activeWeights);
        if (mine.hasProfile) return mine;
      }
      return fetchMatchesForVector(dimensions, activeWeights);
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <section className={cardClass} aria-busy="true">
        <h2 className="font-display text-[22px] font-bold">Closest parties</h2>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[104px] w-full rounded-xl" />
        ))}
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={cardClass}>
        <h2 className="font-display text-[22px] font-bold">Closest parties</h2>
        <p role="alert" className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load your matches."}
        </p>
        <Button variant="outline" className="w-fit" onClick={() => void refetch()}>
          Try again
        </Button>
      </section>
    );
  }

  const topParties = data.parties.slice(0, TOP_PARTIES);
  const bottomParties =
    data.parties.length > TOP_PARTIES + BOTTOM_PARTIES ? data.parties.slice(-BOTTOM_PARTIES).reverse() : [];
  const topTds = data.tds.slice(0, TOP_TDS);

  return (
    <>
      <section className={cardClass} aria-busy={isPlaceholderData}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-[22px] font-bold">Closest parties</h2>
          {isPlaceholderData && (
            <span role="status" className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Updating…
            </span>
          )}
        </div>
        {topParties.length === 0 ? (
          <EmptyState icon={Users} title="No party matches yet">
            We could not match your answers to any party. Try again later.
          </EmptyState>
        ) : (
          topParties.map((match) => {
            const pct = Math.round(match.alignment);
            const style = partyStyle(match.party);
            return (
              <div key={match.party} className="flex flex-col gap-2.5 rounded-xl bg-elevated p-3.5">
                <div className="flex items-center gap-3">
                  <PartyBadge party={match.party} />
                  <span className="min-w-0 flex-1 truncate text-base font-bold">{style.name}</span>
                  <span className="font-display text-[26px] font-extrabold tabular-nums">{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-input" aria-hidden="true">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: style.dot }} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-muted-foreground">
                    {match.closest.length > 0 ? `Closest on ${labels(match.closest)}` : "Broadly aligned with you"}
                  </span>
                  <Link
                    href={`/party/${encodeURIComponent(match.party)}`}
                    className="inline-flex min-h-11 shrink-0 items-center text-[13px] font-bold text-primary hover:underline"
                  >
                    View party
                  </Link>
                </div>
              </div>
            );
          })
        )}

        {bottomParties.length > 0 && (
          <>
            <h3 className="pt-1 text-[13px] font-semibold text-muted-foreground">Least like you</h3>
            {bottomParties.map((match) => (
              <Link
                key={match.party}
                href={`/party/${encodeURIComponent(match.party)}`}
                className="flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 transition-[background-color,transform] duration-150 hover:bg-accent active:scale-[0.98]"
              >
                <PartyBadge party={match.party} small />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-bold">{partyStyle(match.party).name}</span>
                  <span className="text-xs text-muted-foreground">
                    {match.furthest.length > 0 ? `Furthest on ${labels(match.furthest)}` : "Differs from you overall"}
                  </span>
                </span>
                <span className="font-display text-xl font-bold tabular-nums text-muted-foreground">
                  {Math.round(match.alignment)}%
                </span>
              </Link>
            ))}
          </>
        )}

        <p className="rounded-lg bg-background p-3 text-[13px] leading-relaxed text-muted-foreground">
          These are matches on views only. Before you vote, check each party&apos;s record in{" "}
          <Link href="/rankings" className="font-bold text-primary hover:underline">
            Rankings
          </Link>
          .
        </p>
      </section>

      {topTds.length > 0 && (
        <section className={cardClass}>
          <h2 className="font-display text-[22px] font-bold">Closest TDs</h2>
          <ol className="flex flex-col gap-1">
            {topTds.map((td) => (
              <li key={td.tdId}>
                <Link
                  href={`/td/${encodeURIComponent(td.name)}`}
                  className="flex min-h-[60px] items-center gap-3 rounded-lg px-1 py-2 transition-[background-color,transform] duration-150 hover:bg-accent active:scale-[0.98]"
                >
                  <TDAvatar name={td.name} party={td.party} imageUrl={td.imageUrl} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-bold">{td.name}</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <PartyDot party={td.party} />
                      <span className="truncate">
                        {partyStyle(td.party).name} · {td.constituency}
                      </span>
                    </span>
                  </span>
                  <span className="font-display text-[22px] font-bold tabular-nums text-primary">
                    {Math.round(td.alignment)}%
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          {isAuthenticated && (
            <Button asChild variant="outline" className="w-full">
              <Link href="/my-politics">See all in My politics</Link>
            </Button>
          )}
        </section>
      )}
    </>
  );
};

function PartyBadge({ party, small }: { party: string; small?: boolean }) {
  return <TDAvatar name={partyStyle(party).name} party={party} size={small ? "sm" : "md"} />;
}

export default PartyMatchResults;
