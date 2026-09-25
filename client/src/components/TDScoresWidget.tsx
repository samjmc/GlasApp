/**
 * "Top of the Dáil": the five highest-scoring TDs, with a quick-info dialog per TD.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Info, Trophy } from 'lucide-react';
import { queryKeys } from '@/lib/queryKeys';
import { formatScore, scoreTone, TONE_TEXT } from '@/lib/score';
import { TDAvatar } from '@/components/pulse/Party';
import { EmptyState } from '@/components/pulse/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HomeCard, HomeCardHeader } from '@/components/home/HomeCard';
import { partyStyle } from '@/lib/parties';
import { cn } from '@/lib/utils';
import { TDQuickInfoModal } from './TDQuickInfoModal';

interface TDRow {
  id: number;
  name: string;
  imageUrl?: string | null;
  party?: string | null;
  overallScore?: number | null;
}

export interface ScoresWidgetData {
  top: TDRow[];
  bottom: TDRow[];
  movers: TDRow[];
  stats: {
    totalTds: number;
    scoredTds: number;
    storiesAnalysed: number;
    lastScoredAt: string | null;
  };
}

/** Shared query for GET /api/scores/widget (the home hero reads its stats too). */
export function useScoresWidget() {
  return useQuery<ScoresWidgetData>({
    queryKey: queryKeys.td.scoresWidget(),
    queryFn: async () => {
      const res = await fetch('/api/scores/widget');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      return json.data as ScoresWidgetData;
    },
    staleTime: 60000,
  });
}

/** Widget listing the top five TDs by score. */
export function TDScoresWidget({ className }: { className?: string }) {
  const [selectedTDId, setSelectedTDId] = useState<number | null>(null);
  const { data, isLoading, isError, refetch } = useScoresWidget();
  const top = (data?.top ?? []).slice(0, 5);
  const total = data?.stats.totalTds;

  return (
    <HomeCard className={className}>
      <HomeCardHeader title="Top of the Dáil" href="/rankings" linkLabel={total ? `All ${total}` : 'All TDs'} />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={Trophy}
          title="Rankings did not load"
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          }
        >
          Check your connection, then try again.
        </EmptyState>
      ) : top.length === 0 ? (
        <EmptyState icon={Trophy} title="No TDs scored yet">
          Scores show here after the first daily run.
        </EmptyState>
      ) : (
        <ol className="flex flex-col gap-1">
          {top.map((td, i) => {
            const tone = scoreTone(td.overallScore);
            return (
              <li key={td.id} className="group flex items-center gap-1">
                <Link
                  href={`/td/${encodeURIComponent(td.name)}`}
                  className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3 rounded-lg px-2 transition-colors hover:bg-elevated"
                >
                  <span className="w-5 text-sm font-bold text-muted-foreground">{i + 1}</span>
                  <TDAvatar name={td.name} party={td.party} imageUrl={td.imageUrl} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{td.name}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">{partyStyle(td.party ?? 'Independent').name}</span>
                  </span>
                  <span className={cn('font-display text-xl font-bold', tone ? TONE_TEXT[tone] : 'text-muted-foreground')}>
                    {formatScore(td.overallScore)}
                  </span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Quick info for ${td.name}`}
                  onClick={() => setSelectedTDId(td.id)}
                  className="text-muted-foreground"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ol>
      )}

      {selectedTDId !== null && (
        <TDQuickInfoModal tdId={selectedTDId} isOpen onClose={() => setSelectedTDId(null)} />
      )}
    </HomeCard>
  );
}
