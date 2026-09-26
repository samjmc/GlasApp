/**
 * Personal Rankings Tab Component
 * Shows personalized TD rankings with compatibility breakdown
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ChevronDown, ListOrdered, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/pulse/EmptyState';
import { PartyDot, TDAvatar } from '@/components/pulse/Party';
import { MatchConfidence, MatchListNote, rowBadges } from '@/components/MatchConfidence';
import { useAuth } from '@/contexts/AuthContext';
import { evidenceSummary } from '@/lib/ideologyConfidence';
import { fetchMyMatches } from '@/lib/ideologyApi';
import type { TdMatch } from '@/lib/ideologyApi';
import { partyStyle } from '@/lib/parties';
import { queryKeys } from '@/lib/queryKeys';
import { DIMENSION_POLES, type IdeologyDimension } from '@shared/ideology';
import { cn } from '@/lib/utils';

const PAGE = 10;
const BOTTOM = 5;

const dimensionLabels = (dims: IdeologyDimension[]) => dims.map((d) => DIMENSION_POLES[d].label).join(', ');

/** The user's TDs ranked by how closely they match, closest first, with the least alike at the end. */
export function PersonalRankingsTab() {
  const { user, isAuthenticated } = useAuth();
  const [visibleCount, setVisibleCount] = useState(PAGE);

  const matchesQuery = useQuery({
    queryKey: queryKeys.ideology.myMatches(user?.id, null),
    queryFn: () => fetchMyMatches(),
    enabled: isAuthenticated && !!user,
  });

  const hasProfile = matchesQuery.data?.hasProfile ?? false;
  const rankings = matchesQuery.data?.tds ?? [];

  if (!isAuthenticated) {
    return (
      <EmptyState
        icon={Lock}
        title="Find TDs who match your views"
        action={
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        }
      >
        Sign in and take the quiz to rank every TD by how closely they match you.
      </EmptyState>
    );
  }

  if (matchesQuery.isLoading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading your rankings">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (matchesQuery.error) {
    return (
      <EmptyState
        title="We could not load your rankings"
        action={
          <Button variant="outline" onClick={() => void matchesQuery.refetch()} disabled={matchesQuery.isFetching}>
            {matchesQuery.isFetching && <Loader2 className="animate-spin" aria-hidden="true" />}
            {matchesQuery.isFetching ? 'Loading…' : 'Try again'}
          </Button>
        }
      >
        Check your connection and try again.
      </EmptyState>
    );
  }

  if (!hasProfile) {
    return (
      <EmptyState
        icon={ListOrdered}
        title="No rankings yet"
        action={
          <Button asChild>
            <Link href="/quiz">Take the quiz</Link>
          </Button>
        }
      >
        Take the quiz to build your profile. Then every TD gets a match score.
      </EmptyState>
    );
  }

  if (rankings.length === 0) {
    return (
      <EmptyState icon={ListOrdered} title="No TDs to rank">
        We have no TD positions to compare with yet. Check back soon.
      </EmptyState>
    );
  }

  const topCount = Math.max(0, rankings.length - BOTTOM);
  const hasBottom = rankings.length > PAGE;
  const top = rankings.slice(0, hasBottom ? Math.min(visibleCount, topCount) : rankings.length);
  const bottom = hasBottom ? rankings.slice(-BOTTOM).reverse() : [];
  const badges = rowBadges([...top, ...bottom]);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-[22px] font-bold">Closest to you</h2>
          <span className="text-[13px] text-muted-foreground">{rankings.length} TDs ranked</span>
        </div>
        <MatchListNote kind="td" items={[...top, ...bottom]} measured={matchesQuery.data?.measured} />
        <ol className="flex flex-col gap-2">
          {top.map((r, i) => (
            <RankingRow key={r.tdId} ranking={r} rank={i + 1} badge={badges} />
          ))}
        </ol>
        {hasBottom && visibleCount < topCount && (
          <Button variant="outline" className="h-11 w-full" onClick={() => setVisibleCount((n) => n + PAGE)}>
            <ChevronDown aria-hidden="true" />
            Show more
          </Button>
        )}
      </section>

      {bottom.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-[22px] font-bold">Least like you</h2>
          <ol className="flex flex-col gap-2">
            {bottom.map((r, i) => (
              <RankingRow key={r.tdId} ranking={r} rank={rankings.length - i} badge={badges} low />
            ))}
          </ol>
        </section>
      )}

      <p className="text-[13px] text-muted-foreground">
        Rankings start from your quiz. Each daily vote and news stance you answer refines them.
      </p>
    </div>
  );
}

function RankingRow({ ranking, rank, badge, low }: { ranking: TdMatch; rank: number; badge: boolean; low?: boolean }) {
  const evidence = evidenceSummary(ranking.evidenceBySource);
  return (
    <li>
      <Link
        href={`/td/${encodeURIComponent(ranking.name)}`}
        className="flex min-h-[72px] items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-[background-color,transform] duration-150 hover:bg-accent active:scale-[0.98]"
      >
        <span className="w-7 shrink-0 text-center font-display text-sm font-bold text-muted-foreground tabular-nums">{rank}</span>
        <TDAvatar name={ranking.name} party={ranking.party} imageUrl={ranking.imageUrl} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[15px] font-bold">{ranking.name}</span>
            {badge && <MatchConfidence kind="td" confidence={ranking.confidence} />}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <PartyDot party={ranking.party} />
            <span className="truncate">
              {partyStyle(ranking.party).short}
              {ranking.constituency ? ` · ${ranking.constituency}` : ''}
              {evidence ? ` · ${evidence}` : ''}
            </span>
          </span>
          {(low ? ranking.furthest : ranking.closest).length > 0 && (
            <span className="hidden truncate text-xs text-muted-foreground sm:block">
              {low ? 'Furthest on ' : 'Closest on '}
              {dimensionLabels(low ? ranking.furthest : ranking.closest)}
            </span>
          )}
        </span>
        <span className={cn('font-display text-[22px] font-bold tabular-nums', low ? 'text-warn' : 'text-primary')}>
          {Math.round(ranking.alignment)}%
        </span>
      </Link>
    </li>
  );
}
