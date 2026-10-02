/**
 * "Positions on record" on a TD's profile: what the TD said in news articles, grouped by policy
 * domain (GET /api/stances/td/:id). Signed in with a profile, it also shows how the user's
 * daily-vote answers compare with this TD's (GET /api/ideology/me/matches?td=).
 */

import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Quote } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/pulse/EmptyState';
import { RetryButton } from '@/components/data/RetryButton';
import { IssueBreakdown, QuoteKindBadge, StanceSource, humaniseDomain } from '@/components/IssueBreakdown';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyMatches } from '@/lib/ideologyApi';
import { queryKeys } from '@/lib/queryKeys';
import type { TdStances } from '@shared/stancesApi';

async function getStances(tdId: number): Promise<TdStances> {
  const res = await fetch(`/api/stances/td/${tdId}`);
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  const json: { success: true; data: TdStances } = await res.json();
  return json.data;
}

export function TdPositionsOnRecord({ tdId }: { tdId: number | undefined }) {
  const { user, isAuthenticated } = useAuth();
  const signedIn = isAuthenticated && !!user;

  const {
    data: stances,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.td.stances(tdId ?? 0),
    queryFn: () => getStances(tdId as number),
    enabled: !!tdId,
    staleTime: 5 * 60 * 1000,
  });

  const matchesQuery = useQuery({
    queryKey: queryKeys.ideology.myMatchesForTd(user?.id, tdId ?? 0),
    queryFn: () => fetchMyMatches(undefined, tdId),
    enabled: signedIn && !!tdId,
    staleTime: 60_000,
  });

  const domains = (stances?.domains ?? []).filter((d) => d.stances.length > 0);
  const match = matchesQuery.data?.tds.find((td) => td.tdId === tdId);

  let agreement: ReactNode = null;
  if (signedIn) {
    if (matchesQuery.isLoading) {
      agreement = <Skeleton className="h-16 rounded-xl" />;
    } else if (matchesQuery.isError) {
      agreement = (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>Could not load how your views compare.</span>
          <RetryButton
            variant="outline"
            size="sm"
            className="h-11 md:h-9"
            onRetry={() => matchesQuery.refetch()}
            pending={matchesQuery.isFetching}
          />
        </div>
      );
    } else if (matchesQuery.data && !matchesQuery.data.hasProfile) {
      agreement = (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          <Link href="/quiz" className="font-semibold text-primary hover:underline">
            Take the quiz
          </Link>{' '}
          to see how your views compare with this TD.
        </p>
      );
    } else if (match) {
      agreement = (
        <div className="flex flex-col gap-3 rounded-xl bg-elevated p-4">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold">You and this TD:</span>
            <span className="font-display text-2xl font-bold tabular-nums text-primary">
              {Math.round(match.alignment)}%
            </span>
          </p>
          {match.issues && <IssueBreakdown issues={match.issues} />}
        </div>
      );
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-xl font-bold tracking-tight">Positions on record</h2>
        <span className="text-[13px] text-muted-foreground">Quotes from news reports</span>
      </div>

      {agreement}

      {isLoading || !tdId ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={Quote}
          title="Could not load positions"
          action={<RetryButton variant="secondary" onRetry={() => refetch()} pending={isFetching} />}
        >
          The positions on record did not load. Try again in a moment.
        </EmptyState>
      ) : domains.length === 0 ? (
        <EmptyState icon={Quote} title="No positions on record yet">
          A position shows here when a news article quotes this TD stating a view, and the quote is checked against
          the article text.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          {domains.map((group) => (
            <section key={group.domain} className="flex flex-col gap-2" aria-label={humaniseDomain(group.domain)}>
              <h3 className="text-[13px] font-semibold text-muted-foreground">{humaniseDomain(group.domain)}</h3>
              <ul className="flex flex-col gap-2">
                {group.stances.map((stance) => (
                  <li key={stance.id} className="flex flex-col gap-2 rounded-xl bg-elevated p-3 sm:px-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <QuoteKindBadge kind={stance.quoteKind} />
                      {stance.saidCount > 1 && (
                        <Badge variant="secondary" className="bg-card">
                          Said {stance.saidCount} times
                        </Badge>
                      )}
                      {stance.changedPosition && <Badge variant="warn">Changed position</Badge>}
                    </div>
                    <blockquote className="text-[15px] leading-relaxed">“{stance.quote}”</blockquote>
                    {stance.optionText !== null && (
                      <p className="text-[13px]">
                        <span className="font-semibold text-muted-foreground">Answer:</span> {stance.optionText}
                      </p>
                    )}
                    <StanceSource outlet={stance.outlet} url={stance.url} statedAt={stance.statedAt} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Each position is a quote from a news report, checked against the article text. Positions are a record of
        what was said, never a score.
      </p>
    </Card>
  );
}
