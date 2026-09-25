/**
 * Constituencies: all 43 Dáil constituencies as a map or a searchable list,
 * with the selected one summarised in a side panel on desktop.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowRight, MapPin, Search, SearchX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/PageHeader';
import { StatTile } from '@/components/pulse/Stat';
import { PartyLabel, TDAvatar } from '@/components/pulse/Party';
import { EmptyState } from '@/components/pulse/EmptyState';
import { RetryButton } from '@/components/data/RetryButton';
import { PartyMixBar } from '@/components/data/PartyMixBar';
import OfficialElectoralMap from '@/components/OfficialElectoralMap';
import { formatScore, scoreTone, TONE_TEXT } from '@/lib/score';
import { cn } from '@/lib/utils';

interface ConstituencyParty {
  party: string;
  count: number;
}

interface ConstituencyTD {
  id: number;
  name: string;
  party: string | null;
  imageUrl?: string | null;
  overallScore: number | null;
}

interface ConstituencyListItem {
  name: string;
  tdCount: number;
  averageScore: number | null;
  parties: ConstituencyParty[];
  tds?: ConstituencyTD[];
}

interface ConstituencySummaryData {
  constituencies: ConstituencyListItem[];
  totalConstituencies: number;
  totalTds: number;
}

interface ConstituencyDetail {
  tdCount: number;
  parties?: ConstituencyParty[];
  tds?: ConstituencyTD[];
}

function Score({ value, className }: { value: number | null; className?: string }) {
  const tone = scoreTone(value);
  return (
    <span className={cn('font-display font-extrabold tracking-tight', tone ? TONE_TEXT[tone] : 'text-muted-foreground', className)}>
      {formatScore(value)}
    </span>
  );
}

function SelectedPanel({ name, detail }: { name: string | null; detail: ConstituencyDetail | undefined }) {
  if (!name) {
    return (
      <EmptyState icon={MapPin} title="Pick a constituency">
        Tap an area on the map, or point at a card in the list, to see its TDs here.
      </EmptyState>
    );
  }
  return (
    <Card>
      <CardHeader className="gap-3">
        <span className="text-[13px] font-semibold text-muted-foreground">Constituency</span>
        <CardTitle className="font-display text-2xl font-bold tracking-tight">{name}</CardTitle>
        {detail ? (
          <>
            <span className="text-sm text-muted-foreground">
              {detail.tdCount} {detail.tdCount === 1 ? 'TD' : 'TDs'}
            </span>
            <PartyMixBar parties={detail.parties ?? []} />
          </>
        ) : (
          <Skeleton className="h-2 w-full" />
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-1">
          {detail
            ? detail.tds?.map((td) => (
                <li key={td.id}>
                  <Link
                    href={`/td/${encodeURIComponent(td.name)}`}
                    className="flex min-h-[52px] items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <TDAvatar name={td.name} party={td.party} imageUrl={td.imageUrl} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">{td.name}</span>
                      <PartyLabel party={td.party ?? 'Independent'} className="text-[13px]" />
                    </span>
                    <Score value={td.overallScore} className="text-lg" />
                  </Link>
                </li>
              ))
            : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </ul>
        <Button asChild>
          <Link href={`/constituency/${encodeURIComponent(name)}`}>
            View full profile <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ConstituenciesPage() {
  const [selectedConstituency, setSelectedConstituency] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [query, setQuery] = useState('');

  const { data: summary, isLoading, isError, refetch, isFetching } = useQuery<ConstituencySummaryData>({
    queryKey: ['constituencies-summary'],
    queryFn: async () => {
      const res = await fetch('/api/scores/constituencies/summary');
      if (!res.ok) throw new Error('Failed to fetch constituencies');
      const json = await res.json();
      return json.data as ConstituencySummaryData;
    },
  });
  const data = summary?.constituencies ?? [];

  const { data: selectedData } = useQuery<ConstituencyDetail>({
    queryKey: ['constituency-detail', selectedConstituency],
    queryFn: async () => {
      const res = await fetch(`/api/scores/constituency/${encodeURIComponent(selectedConstituency!)}`);
      if (!res.ok) throw new Error('Failed to fetch constituency');
      const json = await res.json();
      return json.data as ConstituencyDetail;
    },
    enabled: !!selectedConstituency,
  });
  // The summary already carries each constituency's TDs, so the panel can fill in before the detail call lands.
  const panelDetail = selectedData ?? data.find((c) => c.name === selectedConstituency);

  const scored = data.filter((c) => c.averageScore !== null);
  const avgScore = scored.length ? scored.reduce((s, c) => s + (c.averageScore ?? 0), 0) / scored.length : null;
  const avgSeats = data.length ? (data.reduce((s, c) => s + c.tdCount, 0) / data.length).toFixed(1) : '—';

  const term = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (term ? data.filter((c) => c.name.toLowerCase().includes(term)) : data),
    [data, term]
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Constituencies"
        description={`${summary?.totalConstituencies ?? (data.length || 43)} Dáil constituencies. See who represents each one and how they score.`}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)
        ) : (
          <>
            <StatTile label="Constituencies" value={data.length || '—'} />
            <StatTile label="TDs" value={summary?.totalTds ?? '—'} />
            <StatTile label="Average score" value={<Score value={avgScore} />} />
            <StatTile label="TDs per area" value={avgSeats} sub="3 to 5 seats each" />
          </>
        )}
      </div>

      {isError ? (
        <EmptyState icon={SearchX} title="Could not load constituencies" action={<RetryButton onRetry={() => refetch()} pending={isFetching} />}>
          The scores service did not answer. Check your connection and try again.
        </EmptyState>
      ) : (
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'map' | 'list')} className="flex flex-col gap-4">
          <TabsList aria-label="View" className="self-start">
            <TabsTrigger value="map">Map</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <div className="min-w-0">
              <TabsContent value="map" className="mt-0">
                <Card className="overflow-hidden">
                  <OfficialElectoralMap onConstituencySelect={setSelectedConstituency} constituenciesData={data} height="min(640px, 70vh)" />
                </Card>
              </TabsContent>

              <TabsContent value="list" className="mt-0 flex flex-col gap-4">
                <label className="relative">
                  <span className="sr-only">Search constituencies</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search a constituency"
                    className="h-11 pl-9"
                  />
                </label>

                {isLoading ? (
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }, (_, i) => (
                      <Skeleton key={i} className="h-32 rounded-2xl" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title="No constituency matches"
                    action={<Button variant="secondary" onClick={() => setQuery('')}>Clear search</Button>}
                  >
                    Check the spelling, or search part of the name, like “Dublin”.
                  </EmptyState>
                ) : (
                  <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((c) => (
                      <li key={c.name}>
                        <Link
                          href={`/constituency/${encodeURIComponent(c.name)}`}
                          onMouseEnter={() => setSelectedConstituency(c.name)}
                          onFocus={() => setSelectedConstituency(c.name)}
                          aria-current={selectedConstituency === c.name ? 'true' : undefined}
                          className={cn(
                            'flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-elevated active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            selectedConstituency === c.name && 'lg:border-foreground'
                          )}
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span className="flex min-w-0 flex-col">
                              <span className="font-display text-lg font-bold leading-tight tracking-tight">{c.name}</span>
                              <span className="text-[13px] text-muted-foreground">
                                {c.tdCount} {c.tdCount === 1 ? 'TD' : 'TDs'} · {c.parties.length}{' '}
                                {c.parties.length === 1 ? 'party' : 'parties'}
                              </span>
                            </span>
                            <span className="flex flex-col items-end">
                              <Score value={c.averageScore} className="text-2xl leading-none" />
                              <span className="text-xs text-muted-foreground">average</span>
                            </span>
                          </span>
                          <PartyMixBar parties={c.parties} className="mt-auto" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </div>

            <aside aria-label="Selected constituency" className={cn('lg:sticky lg:top-6', !selectedConstituency && 'hidden lg:block')}>
              <SelectedPanel name={selectedConstituency} detail={panelDetail} />
            </aside>
          </div>
        </Tabs>
      )}
    </div>
  );
}
