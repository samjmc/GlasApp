/**
 * "Party averages": the mean TD score for each party with 10 or more TDs,
 * as bars in party colours (columns on desktop, rows on phone).
 *
 * Built from the full TD list: /api/scores/parties only counts TDs with a stored
 * party score, so its member counts cannot answer "parties with 10+ TDs".
 */

import { useMemo } from 'react';
import { Link } from 'wouter';
import { BarChart3 } from 'lucide-react';
import { partyStyle } from '@/lib/parties';
import { formatScore } from '@/lib/score';
import { EmptyState } from '@/components/pulse/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HomeCard, HomeCardHeader } from '@/components/home/HomeCard';
import { useAllTDs } from '@/components/home/useAllTDs';

const MIN_TDS = 10;

interface PartyAverage {
  party: string;
  count: number;
  avg: number | null;
}

/** Widget comparing average TD scores across the larger parties. */
export function PartyRankingsWidget({ className }: { className?: string }) {
  const { data, isLoading, isError, refetch } = useAllTDs();

  const parties = useMemo<PartyAverage[]>(() => {
    const groups = new Map<string, { count: number; sum: number; scored: number }>();
    for (const td of data?.tds ?? []) {
      if (!td.party || td.party === 'Independent') continue;
      const g = groups.get(td.party) ?? { count: 0, sum: 0, scored: 0 };
      g.count += 1;
      if (td.overallScore !== null && td.overallScore !== undefined) {
        g.sum += td.overallScore;
        g.scored += 1;
      }
      groups.set(td.party, g);
    }
    return Array.from(groups, ([party, g]) => ({ party, count: g.count, avg: g.scored ? g.sum / g.scored : null }))
      .filter((p) => p.count >= MIN_TDS)
      .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  }, [data]);

  return (
    <HomeCard className={className}>
      <HomeCardHeader title="Party averages" href="/rankings" linkLabel="Rankings" />
      <span className="-mt-2 text-[13px] text-muted-foreground">Parties with {MIN_TDS}+ TDs</span>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={BarChart3}
          title="Party scores did not load"
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          }
        >
          Check your connection, then try again.
        </EmptyState>
      ) : parties.length === 0 ? (
        <EmptyState icon={BarChart3} title="No party averages yet">
          Averages show once TDs are scored.
        </EmptyState>
      ) : (
        <ul
          className="flex flex-col gap-3 md:grid md:h-56 md:items-end md:gap-4"
          style={{ gridTemplateColumns: `repeat(${parties.length}, minmax(0, 1fr))` }}
        >
          {parties.map((p) => {
            const style = partyStyle(p.party);
            const pct = p.avg === null ? 0 : Math.max(2, Math.min(100, p.avg));
            return (
              <li key={p.party} className="md:h-full">
                <Link
                  href={`/party/${encodeURIComponent(p.party)}`}
                  aria-label={`${style.name}: average ${formatScore(p.avg)} across ${p.count} TDs`}
                  className="group flex flex-col gap-1.5 rounded-lg transition-opacity hover:opacity-90 md:h-full md:justify-end"
                >
                  {/* Phone: label row, then a horizontal bar. */}
                  <span className="flex items-baseline justify-between gap-2 md:hidden">
                    <span className="truncate text-sm font-semibold">
                      {style.name} <span className="font-normal text-muted-foreground">· {p.count} TDs</span>
                    </span>
                    <span className="font-display text-lg font-bold">{formatScore(p.avg)}</span>
                  </span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-elevated md:hidden" aria-hidden="true">
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: style.dot }} />
                  </span>

                  {/* Desktop: a column. */}
                  <span className="hidden font-display text-2xl font-bold md:block">{formatScore(p.avg)}</span>
                  <span
                    className="hidden rounded-b-sm rounded-t-xl md:block"
                    style={{ height: `${pct * 0.7}%`, backgroundColor: style.dot }}
                    aria-hidden="true"
                  />
                  <span className="hidden truncate text-sm font-semibold md:block">{style.name}</span>
                  <span className="hidden text-xs text-muted-foreground md:block">{p.count} TDs</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </HomeCard>
  );
}
