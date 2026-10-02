/**
 * Rankings: every TD, or every party, ranked by score or by one of its four components.
 * `?filter=top|bottom` picks the starting order of the TD list.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearch } from 'wouter';
import { Info, SearchX, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/PageHeader';
import { Segmented } from '@/components/pulse/Segmented';
import { ScoreBar } from '@/components/pulse/Stat';
import { PartyDot, PartyLabel, TDAvatar } from '@/components/pulse/Party';
import { EmptyState } from '@/components/pulse/EmptyState';
import { RetryButton } from '@/components/data/RetryButton';
import { TDQuickInfoModal } from '@/components/TDQuickInfoModal';
import { queryKeys } from '@/lib/queryKeys';
import { partyStyle } from '@/lib/parties';
import { formatScore, scoreTone, TONE_TEXT } from '@/lib/score';
import { cn } from '@/lib/utils';
import type { ScoreComponents, TdListItem } from '@shared/scoresApi';

type RankingsData = {
  tds: TdListItem[];
  count: number;
};

type Component = keyof ScoreComponents;
type SortKey = 'overall' | Component;
type StartFilter = 'top' | 'bottom';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'overall', label: 'Score' },
  { value: 'questions', label: 'Questions' },
  { value: 'attendance', label: 'Votes' },
  { value: 'committees', label: 'Committees' },
  { value: 'debate', label: 'Debate' },
];

const COMPONENTS: Component[] = ['questions', 'attendance', 'committees', 'debate'];

const PAGE_SIZE = 50;

const valueOf = (td: TdListItem, key: SortKey) => (key === 'overall' ? td.overallScore : td.components[key]);

/** A value in its own unit: attendance and committees are percentages, the rest plain numbers. */
function formatValue(key: SortKey, value: number | null): string {
  if (value === null) return '—';
  return key === 'attendance' || key === 'committees' ? `${Math.round(value)}%` : formatScore(value);
}

function mean(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  return present.length ? present.reduce((a, b) => a + b, 0) / present.length : null;
}

/** Nulls always go last, whatever the direction. */
function compareNullable(a: number | null, b: number | null, dir: 1 | -1) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (b - a) * dir;
}

/** The value the list is sorted by; only the overall score is coloured by the score rule. */
function BigValue({ sortKey, value, className }: { sortKey: SortKey; value: number | null; className?: string }) {
  const tone = sortKey === 'overall' ? scoreTone(value) : null;
  return (
    <span
      className={cn(
        'font-display text-xl font-extrabold tracking-tight',
        tone ? TONE_TEXT[tone] : value === null ? 'text-muted-foreground' : '',
        className
      )}
    >
      {formatValue(sortKey, value)}
    </span>
  );
}

function ComponentCell({ component, value }: { component: Component; value: number | null }) {
  return (
    <span
      className={cn('hidden text-sm font-semibold tabular-nums md:block', value === null && 'text-muted-foreground')}
      title={value === null ? 'Not applicable' : undefined}
    >
      {formatValue(component, value)}
    </span>
  );
}

export default function ResearchedTDsPage() {
  const search = useSearch();
  const startFilter = (new URLSearchParams(search).get('filter') as StartFilter | null) ?? 'top';

  const [view, setView] = useState<'tds' | 'parties'>('tds');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParty, setSelectedParty] = useState<string>('all');
  const [selectedConstituency, setSelectedConstituency] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('overall');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selectedTDId, setSelectedTDId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<RankingsData>({
    queryKey: queryKeys.td.rankings(),
    queryFn: async () => {
      const res = await fetch('/api/scores/tds');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const tds = (json.data ?? []) as TdListItem[];
      return { tds, count: json.meta?.count ?? tds.length };
    },
  });

  const tds = data?.tds ?? [];

  const { partyCounts, constituencies } = useMemo(() => {
    const p = new Map<string, number>();
    const c = new Set<string>();
    tds.forEach((td) => {
      const party = td.party ?? 'Independent';
      p.set(party, (p.get(party) ?? 0) + 1);
      if (td.constituency) c.add(td.constituency);
    });
    return {
      partyCounts: Array.from(p.entries()).sort((a, b) => b[1] - a[1]),
      constituencies: Array.from(c).sort(),
    };
  }, [tds]);

  const term = searchTerm.trim().toLowerCase();
  const hasActiveFilters = term !== '' || selectedParty !== 'all' || selectedConstituency !== 'all';

  const filteredTDs = useMemo(() => {
    const list = tds.filter(
      (td) =>
        (term === '' || td.name.toLowerCase().includes(term)) &&
        (selectedParty === 'all' || (td.party ?? 'Independent') === selectedParty) &&
        (selectedConstituency === 'all' || td.constituency === selectedConstituency)
    );
    const dir = startFilter === 'bottom' ? -1 : 1;
    if (sortKey === 'overall') {
      // Ranks ascend; unranked TDs go last either way.
      return list.sort((a, b) => compareNullable(a.nationalRank, b.nationalRank, dir === 1 ? -1 : 1));
    }
    return list.sort((a, b) => compareNullable(valueOf(a, sortKey), valueOf(b, sortKey), dir));
  }, [tds, term, selectedParty, selectedConstituency, sortKey, startFilter]);

  const parties = useMemo(() => {
    const groups = new Map<string, TdListItem[]>();
    tds.forEach((td) => {
      const party = td.party ?? 'Independent';
      groups.set(party, [...(groups.get(party) ?? []), td]);
    });
    return Array.from(groups.entries())
      .map(([name, members]) => ({
        name,
        count: members.length,
        // Unranked members have no overall score and are left out of the mean, not counted as 0.
        overall: mean(members.map((m) => m.overallScore)),
        questions: mean(members.map((m) => m.components.questions)),
        attendance: mean(members.map((m) => m.components.attendance)),
        committees: mean(members.map((m) => m.components.committees)),
        debate: mean(members.map((m) => m.components.debate)),
      }))
      .filter((p) => term === '' || p.name.toLowerCase().includes(term))
      .sort((a, b) => compareNullable(a[sortKey], b[sortKey], 1));
  }, [tds, term, sortKey]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedParty('all');
    setSelectedConstituency('all');
    setVisible(PAGE_SIZE);
  };

  const openInfo = (tdId: number) => {
    setSelectedTDId(tdId);
    setIsModalOpen(true);
  };

  const count = data?.count ?? tds.length;
  const heading = startFilter === 'bottom' ? 'Lowest first' : null;
  const valueLabel = SORTS.find((s) => s.value === sortKey)!.label;

  return (
    <Tabs value={view} onValueChange={(v) => setView(v as 'tds' | 'parties')} className="flex flex-col gap-6">
      <PageHeader
        title="Rankings"
        description={
          isLoading
            ? 'All TDs and parties, scored on questions, votes, committees and debate from the Oireachtas record.'
            : `All ${count} TDs and ${partyCounts.length} parties, scored on questions, votes, committees and debate from the Oireachtas record.`
        }
        right={
          <TabsList aria-label="Rank">
            <TabsTrigger value="tds">TDs</TabsTrigger>
            <TabsTrigger value="parties">Parties</TabsTrigger>
          </TabsList>
        }
      />

      <section aria-label="Filters" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative flex-1">
            <span className="sr-only">{view === 'tds' ? 'Filter by name' : 'Filter parties by name'}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              placeholder={view === 'tds' ? 'Filter by TD name' : 'Filter by party name'}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setVisible(PAGE_SIZE);
              }}
              className="h-11 pl-9"
            />
          </label>
          {view === 'tds' && (
            <Select
              value={selectedConstituency}
              onValueChange={(v) => {
                setSelectedConstituency(v);
                setVisible(PAGE_SIZE);
              }}
            >
              <SelectTrigger className="h-11 w-full md:w-[220px]" aria-label="Constituency">
                <SelectValue placeholder="All constituencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All constituencies</SelectItem>
                {constituencies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Segmented label="Sort by" options={SORTS} value={sortKey} onChange={setSortKey} />
        </div>

        {view === 'tds' && partyCounts.length > 0 && (
          <div role="group" aria-label="Party" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {[['all', count] as [string, number], ...partyCounts].map(([party, n]) => {
              const on = selectedParty === party;
              return (
                <button
                  key={party}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setSelectedParty(on && party !== 'all' ? 'all' : party);
                    setVisible(PAGE_SIZE);
                  }}
                  className={cn(
                    'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors md:h-10',
                    on ? 'border-foreground bg-foreground text-background' : 'bg-elevated text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  {party !== 'all' && <PartyDot party={party} />}
                  {party === 'all' ? 'All parties' : partyStyle(party).short}
                  <span className="text-xs opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div>
        <TabsContent value="tds" className="mt-0 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              {isLoading ? 'Loading TDs' : `${filteredTDs.length} of ${tds.length} TDs`}
              {heading && ` · ${heading}`}
            </span>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-11 md:h-9" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>

          <section aria-label="TD rankings" className="overflow-hidden rounded-2xl border bg-card">
            <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_7rem_4.5rem_4rem_5.5rem_4rem_5.5rem_2.5rem] items-center gap-4 border-b px-5 py-3 text-[13px] font-semibold text-muted-foreground md:grid">
              <span>#</span>
              <span>TD</span>
              <span>Party</span>
              <span>Questions</span>
              <span>Votes</span>
              <span>Committees</span>
              <span>Debate</span>
              <span className="text-right">{valueLabel}</span>
              <span className="sr-only">Details</span>
            </div>

            {isLoading ? (
              <ul className="divide-y" aria-busy="true">
                {Array.from({ length: 10 }, (_, i) => (
                  <li key={i} className="flex items-center gap-4 px-4 py-3 md:px-5">
                    <Skeleton className="h-4 w-6" />
                    <Skeleton className="h-11 w-11 rounded-full" />
                    <div className="flex flex-1 flex-col gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-10" />
                  </li>
                ))}
              </ul>
            ) : isError ? (
              <EmptyState
                icon={SearchX}
                title="Could not load rankings"
                action={<RetryButton onRetry={() => refetch()} pending={isFetching} />}
                className="m-4 border-0"
              >
                The scores service did not answer. Check your connection and try again.
              </EmptyState>
            ) : filteredTDs.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No TDs match these filters"
                action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
                className="m-4 border-0"
              >
                Try another name, or widen the party or constituency.
              </EmptyState>
            ) : (
              <ul className="divide-y">
                {filteredTDs.slice(0, visible).map((td, index) => (
                  <li key={td.id} className="group flex items-center transition-colors hover:bg-elevated">
                    <Link
                      href={`/td/${encodeURIComponent(td.name)}`}
                      className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 md:grid md:grid-cols-[2.5rem_minmax(0,1fr)_7rem_4.5rem_4rem_5.5rem_4rem_5.5rem] md:gap-4 md:pl-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground md:w-auto md:text-left">
                        {startFilter === 'top' && sortKey === 'overall' ? td.nationalRank ?? '—' : index + 1}
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-3">
                        <TDAvatar name={td.name} party={td.party} imageUrl={td.imageUrl} size="md" />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-semibold">{td.name}</span>
                          <span className="truncate text-[13px] text-muted-foreground">
                            <span className="md:hidden">{partyStyle(td.party ?? 'Independent').short} · </span>
                            {td.constituency ?? '—'}
                          </span>
                        </span>
                      </span>
                      <PartyLabel party={td.party ?? 'Independent'} short className="hidden md:inline-flex" />
                      {COMPONENTS.map((c) => (
                        <ComponentCell key={c} component={c} value={td.components[c]} />
                      ))}
                      <BigValue sortKey={sortKey} value={valueOf(td, sortKey)} className="shrink-0 text-right" />
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quick info for ${td.name}`}
                      onClick={() => openInfo(td.id)}
                      className="mx-1 h-11 w-11 shrink-0 text-muted-foreground md:mr-4 md:h-9 md:w-9"
                    >
                      <Info />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {filteredTDs.length > visible && (
            <Button variant="secondary" className="self-center" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Show {Math.min(PAGE_SIZE, filteredTDs.length - visible)} more
            </Button>
          )}
        </TabsContent>

        <TabsContent value="parties" className="mt-0 flex flex-col gap-4">
          <section aria-label="Party rankings" className="overflow-hidden rounded-2xl border bg-card">
            <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_3rem_7rem_4.5rem_4rem_5.5rem_4rem_5.5rem] items-center gap-4 border-b px-5 py-3 text-[13px] font-semibold text-muted-foreground md:grid">
              <span>#</span>
              <span>Party</span>
              <span>TDs</span>
              <span>Average score</span>
              <span>Questions</span>
              <span>Votes</span>
              <span>Committees</span>
              <span>Debate</span>
              <span className="text-right">{valueLabel}</span>
            </div>
            {isLoading ? (
              <ul className="divide-y" aria-busy="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className="flex items-center gap-4 px-5 py-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-6 w-10" />
                  </li>
                ))}
              </ul>
            ) : parties.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No party matches that name"
                action={<Button variant="secondary" onClick={clearFilters}>Clear search</Button>}
                className="m-4 border-0"
              />
            ) : (
              <ul className="divide-y">
                {parties.map((p, index) => {
                  const style = partyStyle(p.name);
                  return (
                    <li key={p.name}>
                      <Link
                        href={`/party/${encodeURIComponent(p.name)}`}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-elevated active:scale-[0.99] md:grid md:grid-cols-[2.5rem_minmax(0,1fr)_3rem_7rem_4.5rem_4rem_5.5rem_4rem_5.5rem] md:gap-4 md:px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground md:w-auto md:text-left">
                          {index + 1}
                        </span>
                        <span className="flex min-w-0 flex-1 items-center gap-3">
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-hero-foreground"
                            style={{ backgroundColor: style.fill }}
                            aria-hidden="true"
                          >
                            {style.short}
                          </span>
                          <span className="flex min-w-0 flex-col gap-1.5">
                            <span className="truncate font-semibold">{style.name}</span>
                            <span className="text-[13px] text-muted-foreground md:hidden">
                              {p.count} {p.count === 1 ? 'TD' : 'TDs'}
                            </span>
                            <ScoreBar value={p.overall} className="w-28 md:hidden" />
                          </span>
                        </span>
                        <span className="hidden text-sm font-semibold tabular-nums md:block">{p.count}</span>
                        <ScoreBar value={p.overall} className="hidden md:block" />
                        {COMPONENTS.map((c) => (
                          <ComponentCell key={c} component={c} value={p[c]} />
                        ))}
                        <BigValue sortKey={sortKey} value={p[sortKey]} className="shrink-0 text-right" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <p className="text-[13px] text-muted-foreground">
            A party's score is the mean of its ranked TDs' scores. Parties with 1 to 4 TDs move a lot on one member's record.
          </p>
        </TabsContent>
      </div>

      {selectedTDId && (
        <TDQuickInfoModal tdId={selectedTDId} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
    </Tabs>
  );
}
