/**
 * The ideology card in a TD profile's side column (GET /api/ideology/td/:id): where the TD sits
 * on the eight dimensions, and which of that is the TD's own record and which is the party's.
 */

import { Compass } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { badgeVariants } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/pulse/EmptyState';
import { RetryButton } from '@/components/data/RetryButton';
import { MatchConfidence } from '@/components/MatchConfidence';
import { fetchTdIdeology } from '@/lib/ideologyApi';
import { dimensionState, evidenceSummary } from '@/lib/ideologyConfidence';
import { describePosition } from '@/lib/ideologyDisplay';
import { partyStyle } from '@/lib/parties';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { DIMENSION_POLES, IDEOLOGY_DIMENSIONS, IDEOLOGY_LIMIT } from '@shared/ideology';

const toPercent = (v: number) => Math.max(0, Math.min(100, ((v + IDEOLOGY_LIMIT) / (2 * IDEOLOGY_LIMIT)) * 100));

export function TdIdeologyCard({ tdId }: { tdId: number | undefined }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.ideology.td(tdId ?? 0),
    queryFn: () => fetchTdIdeology(tdId as number),
    enabled: !!tdId,
    staleTime: 5 * 60 * 1000,
  });

  const heading = (
    <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
      <Compass className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      Ideology
    </h2>
  );

  let body;
  if (isLoading || !tdId) {
    body = (
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 rounded-lg" />
        ))}
      </div>
    );
  } else if (isError || !data) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>Could not load the ideology position.</span>
        <RetryButton variant="outline" size="sm" className="h-11 md:h-9" onRetry={() => refetch()} pending={isFetching} />
      </div>
    );
  } else if (!data.profile || (!data.hasPartyBaseline && data.profile.measured.length === 0)) {
    body = (
      <EmptyState icon={Compass} title="No position yet" className="py-6">
        This TD has no party position to start from and no recorded stances yet.
      </EmptyState>
    );
  } else {
    const { profile, hasPartyBaseline } = data;
    const party = partyStyle(data.td.party).name;
    const measuredCount = profile.measured.length;
    body = (
      <>
        <ul className="flex flex-col gap-3">
          {IDEOLOGY_DIMENSIONS.map((dim) => {
            const state = dimensionState(dim, { measured: profile.measured, hasPartyBaseline });
            const value = profile.vector[dim];
            return (
              <li key={dim} className="flex flex-col gap-1.5">
                <span className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="font-semibold">{DIMENSION_POLES[dim].label}</span>
                    {state === 'party' && (
                      <span className={cn(badgeVariants({ variant: 'secondary' }), 'whitespace-nowrap')}>Party position</span>
                    )}
                  </span>
                  {state === 'not-measured' ? (
                    <span data-testid="dimension-not-measured" data-dimension={dim} className="shrink-0 text-[13px] text-muted-foreground">
                      Not measured yet
                    </span>
                  ) : (
                    <span className="shrink-0 text-[13px] text-muted-foreground">{describePosition(dim, value)}</span>
                  )}
                </span>
                {state === 'not-measured' ? (
                  <span className="block h-1.5 rounded-full border border-dashed border-input" aria-hidden="true" />
                ) : (
                  <span className="relative block h-1.5 rounded-full bg-input" aria-hidden="true">
                    <span className="absolute -top-0.5 left-1/2 h-2.5 w-px bg-muted-foreground" />
                    <span
                      className={cn('absolute -top-[3px] h-3 w-3 -translate-x-1/2 rounded-full', state === 'party' ? 'bg-muted-foreground' : 'bg-primary')}
                      style={{ left: `${toPercent(value)}%` }}
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-1.5 border-t pt-3 text-[13px] leading-relaxed text-muted-foreground">
          <MatchConfidence kind="td" confidence={profile.confidence} className="w-fit" />
          <span>{evidenceSummary(profile.evidenceBySource) ?? 'No individual evidence yet'}</span>
          <span>
            {!hasPartyBaseline
              ? 'No party baseline.'
              : measuredCount === IDEOLOGY_DIMENSIONS.length
                ? `Own evidence on all ${measuredCount} dimensions.`
                : `Own evidence on ${measuredCount} of ${IDEOLOGY_DIMENSIONS.length} dimensions; the rest is ${party}'s position.`}
          </span>
        </div>
      </>
    );
  }

  return (
    <Card data-testid="td-ideology-card" className="flex flex-col gap-3 p-5">
      {heading}
      {body}
    </Card>
  );
}
