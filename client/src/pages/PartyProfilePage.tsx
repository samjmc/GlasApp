/**
 * Party profile: hero band, then Overview / TDs / Pledges / Ideology tabs.
 */

import { useMemo, useState } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Compass, SearchX, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScoreRing } from '@/components/pulse/ScoreRing';
import { ScoreRow, StatTile } from '@/components/pulse/Stat';
import { TDAvatar } from '@/components/pulse/Party';
import { Segmented } from '@/components/pulse/Segmented';
import { EmptyState } from '@/components/pulse/EmptyState';
import { RetryButton } from '@/components/data/RetryButton';
import { PartyPollingWidget } from '@/components/PartyPollingWidget';
import { PartyPledgesPanel } from '@/components/pledges/PartyPledgesPanel';
import { politicalParties } from '@shared/data';
import { partyDimensionsData } from '@/data/partyDimensionsData';
import { partyStyle } from '@/lib/parties';
import { formatScore, scoreTone, TONE_TEXT } from '@/lib/score';
import { cn } from '@/lib/utils';
import type { PartyDetail, PartyScoreRow, TdCard } from '@shared/scoresApi';

type PartyProfile = PartyDetail & { ranking: PartyScoreRow | null };
type MemberSort = 'overall' | 'parliamentary' | 'debate';

const MEMBER_SORTS: { value: MemberSort; label: string }[] = [
  { value: 'overall', label: 'Score' },
  { value: 'parliamentary', label: 'Dáil record' },
  { value: 'debate', label: 'Debate' },
];

const DIMENSIONS = [
  { key: 'economic', label: 'Economic', neg: 'Left', pos: 'Right' },
  { key: 'social', label: 'Social', neg: 'Progressive', pos: 'Conservative' },
  { key: 'cultural', label: 'Cultural', neg: 'Progressive', pos: 'Traditional' },
  { key: 'globalism', label: 'Globalism', neg: 'Nationalist', pos: 'Globalist' },
  { key: 'environmental', label: 'Environment', neg: 'Industry', pos: 'Green' },
  { key: 'authority', label: 'Authority', neg: 'Libertarian', pos: 'Authoritarian' },
  { key: 'welfare', label: 'Welfare', neg: 'Free market', pos: 'Welfare state' },
  { key: 'technocratic', label: 'Governance', neg: 'Populist', pos: 'Expert-led' },
] as const;

function average(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  if (present.length === 0) return null;
  return Math.round(present.reduce((a, b) => a + b, 0) / present.length);
}

function describe(value: number, neg: string, pos: string) {
  const abs = Math.abs(value);
  if (abs < 2) return 'Centre';
  const intensity = abs >= 8 ? 'Strongly' : abs >= 5 ? 'Moderately' : 'Slightly';
  return `${intensity} ${(value < 0 ? neg : pos).toLowerCase()}`;
}

function MemberRow({ td, party, value, pos }: { td: TdCard; party: string; value: number | null; pos: number }) {
  const tone = scoreTone(value);
  return (
    <Link
      href={`/td/${encodeURIComponent(td.name)}`}
      className="flex min-h-[56px] items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-elevated active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">{pos}</span>
      <TDAvatar name={td.name} party={party} imageUrl={td.imageUrl} size="md" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{td.name}</span>
        <span className="truncate text-[13px] text-muted-foreground">
          {td.constituency ?? '—'}
          {td.nationalRank ? ` · #${td.nationalRank} nationally` : ''}
        </span>
      </span>
      <span className={cn('font-display text-xl font-extrabold tracking-tight', tone ? TONE_TEXT[tone] : 'text-muted-foreground')}>
        {formatScore(value)}
      </span>
    </Link>
  );
}

/**
 * wouter runs decodeURI on the path, which leaves reserved escapes (%26, %2F, %23) encoded.
 * Finish the job, but keep the raw value when it holds a bare "%" (e.g. "100% RDR").
 */
function decodeParam(value: string | undefined): string | undefined {
  if (!value) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function PartyProfilePage() {
  const name = decodeParam(useParams<{ name: string }>().name);
  const [tab, setTab] = useState('overview');
  const [memberSort, setMemberSort] = useState<MemberSort>('overall');

  const { data: party, isLoading, error, refetch, isFetching } = useQuery<PartyProfile>({
    queryKey: ['party-profile-v2', name],
    queryFn: async () => {
      const [detailRes, rankingsRes] = await Promise.all([
        fetch(`/api/scores/party/${encodeURIComponent(name || '')}`),
        fetch('/api/scores/parties'),
      ]);
      if (detailRes.status === 404) throw new Error('PARTY_NOT_FOUND');
      if (!detailRes.ok) {
        if (detailRes.status >= 500) throw new Error('Server error - please try again later');
        throw new Error('Failed to load party data');
      }
      const detail = (await detailRes.json()).data as PartyDetail;
      const rankings: PartyScoreRow[] = rankingsRes.ok ? ((await rankingsRes.json()).data ?? []) : [];
      const ranking = rankings.find((p) => p.party.toLowerCase() === detail.party.toLowerCase()) ?? null;
      return { ...detail, ranking };
    },
    enabled: !!name,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message === 'PARTY_NOT_FOUND') return false;
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const sortedMembers = useMemo(() => {
    const members = party?.members ?? [];
    if (memberSort === 'overall') return members; // the endpoint returns best-first already
    return [...members].sort((a, b) => (b.pillars[memberSort] ?? -1) - (a.pillars[memberSort] ?? -1));
  }, [party?.members, memberSort]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-10 w-80 rounded-xl" />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !party) {
    const isNotFound = !error || (error instanceof Error && error.message === 'PARTY_NOT_FOUND');
    return (
      <EmptyState
        icon={SearchX}
        title={isNotFound ? 'Party not found' : 'Could not load this party'}
        action={
          isNotFound ? (
            <Button asChild variant="secondary">
              <Link href="/rankings">See all parties</Link>
            </Button>
          ) : (
            <RetryButton onRetry={() => refetch()} pending={isFetching} />
          )
        }
        className="mt-6"
      >
        {isNotFound
          ? 'No party in the current Dáil has that name. Pick one from the rankings.'
          : error instanceof Error
            ? error.message
            : 'Unable to fetch party data.'}
      </EmptyState>
    );
  }

  // Ideology comes from the static party data; the scores API has none.
  const staticParty = politicalParties.find(
    (p) => p.country === 'ireland' && p.name.toLowerCase() === party.party.toLowerCase()
  );
  const ideology = staticParty ? partyDimensionsData[staticParty.id] : undefined;
  const style = partyStyle(party.party);

  // The mean of ranked members' scores; unranked members are left out, not counted as 0.
  const overallScore = party.averageScore;
  const pillars = [
    { label: 'Dáil record', value: average(party.members.map((m) => m.pillars.parliamentary)) },
    { label: 'Debate', value: average(party.members.map((m) => m.pillars.debate)) },
  ];
  const tdWord = party.size === 1 ? 'TD' : 'TDs';
  const knownGender = party.genderBreakdown.male + party.genderBreakdown.female;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/rankings"
        className="inline-flex min-h-11 items-center gap-1 self-start rounded-md text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Rankings
      </Link>

      <section className="relative overflow-hidden rounded-2xl bg-hero p-5 text-hero-foreground sm:p-8">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: style.dot }} />
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <span
              aria-hidden="true"
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full font-display text-xl font-bold text-hero-foreground sm:h-20 sm:w-20 sm:text-2xl"
              style={{ backgroundColor: style.fill }}
            >
              {style.short}
            </span>
            <div className="flex min-w-0 flex-col gap-2">
              <span className="text-[13px] font-semibold text-hero-soft">Party</span>
              <h1 className="font-display text-3xl font-bold leading-none tracking-tight sm:text-5xl">{party.party}</h1>
              <div className="flex flex-wrap gap-2 text-[13px] font-semibold">
                <span className="rounded-full bg-hero-muted px-3 py-1">
                  {party.size} {tdWord}
                </span>
                <span className="rounded-full bg-hero-muted px-3 py-1">
                  {party.constituencyCount} of 43 constituencies
                </span>
                {party.ranking?.rank != null && (
                  <span className="rounded-full bg-hero-muted px-3 py-1">#{party.ranking.rank} of parties</span>
                )}
              </div>
            </div>
          </div>
          <ScoreRing
            value={overallScore}
            size={112}
            label="Average score"
            caption="average score"
            trackClassName="stroke-hero-muted"
            className="self-start md:self-auto"
          />
        </div>
      </section>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-4">
        <TabsList aria-label="Party sections" className="self-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tds">TDs</TabsTrigger>
          <TabsTrigger value="pledges">Pledges</TabsTrigger>
          <TabsTrigger value="ideology">Ideology</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader className="flex-row items-baseline justify-between gap-3 space-y-0">
                  <CardTitle className="font-display text-xl font-bold tracking-tight">Pillar averages</CardTitle>
                  <span className="text-[13px] text-muted-foreground">
                    Mean across {party.size} {tdWord}
                  </span>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {pillars.map((p) => (
                    <ScoreRow key={p.label} label={p.label} value={p.value} />
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                  <CardTitle className="font-display text-xl font-bold tracking-tight">Top TDs</CardTitle>
                  {party.members.length > 5 && (
                    <Button variant="ghost" size="sm" className="h-11 md:h-9" onClick={() => setTab('tds')}>
                      See all {party.size} {tdWord}
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-1">
                  {party.members.length === 0 ? (
                    <EmptyState icon={Users} title="No active TDs">
                      This party has no TDs in the current Dáil.
                    </EmptyState>
                  ) : (
                    party.members
                      .slice(0, 5)
                      .map((td, i) => <MemberRow key={td.id} td={td} party={party.party} value={td.overallScore} pos={i + 1} />)
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-xl font-bold tracking-tight">Key stats</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <StatTile label="TDs" value={party.size} className="bg-elevated" />
                    <StatTile label="Constituencies" value={party.constituencyCount} className="bg-elevated" />
                    <StatTile label="Average score" value={formatScore(party.averageScore)} className="bg-elevated" />
                    <StatTile
                      label="Women"
                      value={knownGender > 0 ? `${party.genderBreakdown.femalePercentage}%` : '—'}
                      sub={knownGender > 0 ? `${party.genderBreakdown.female} of ${party.size}` : undefined}
                      className="bg-elevated"
                    />
                  </div>
                  {knownGender === 0 && (
                    <span className="text-[13px] text-muted-foreground">Gender is not recorded for these TDs yet.</span>
                  )}
                </CardContent>
              </Card>

              <PartyPollingWidget partyName={party.party} performanceScore={overallScore ?? undefined} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tds" className="mt-0">
          <Card>
            <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="font-display text-xl font-bold tracking-tight">
                {party.size} {tdWord}
              </CardTitle>
              <Segmented label="Sort by" options={MEMBER_SORTS} value={memberSort} onChange={setMemberSort} size="sm" />
            </CardHeader>
            <CardContent>
              {sortedMembers.length === 0 ? (
                <EmptyState icon={Users} title="No active TDs">
                  This party has no TDs in the current Dáil.
                </EmptyState>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-1 md:grid-cols-2">
                  {sortedMembers.map((td, i) => (
                    <MemberRow
                      key={td.id}
                      td={td}
                      party={party.party}
                      pos={i + 1}
                      value={memberSort === 'overall' ? td.overallScore : td.pillars[memberSort]}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pledges" className="mt-0">
          <PartyPledgesPanel party={party.party} />
        </TabsContent>

        <TabsContent value="ideology" className="mt-0">
          <Card>
            <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle className="font-display text-xl font-bold tracking-tight">Where {party.party} sits</CardTitle>
                <span className="text-[13px] text-muted-foreground">8 dimensions, −10 to +10. 0 is the centre.</span>
              </div>
              <Button asChild variant="secondary" size="sm" className="h-11 md:h-9">
                <Link href="/quiz">Take the quiz to compare</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {ideology ? (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-6 md:grid-cols-2">
                  {DIMENSIONS.map((d) => {
                    const value = ideology[d.key];
                    const position = ((Math.max(-10, Math.min(10, value)) + 10) / 20) * 100;
                    return (
                      <div key={d.key} className="flex flex-col gap-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-semibold">{d.label}</span>
                          <span className="text-[13px] text-muted-foreground">
                            {describe(value, d.neg, d.pos)} ·{' '}
                            <span className="font-display font-bold text-foreground">{value > 0 ? `+${value}` : value}</span>
                          </span>
                        </div>
                        <div
                          className="relative h-2 rounded-full bg-elevated"
                          role="img"
                          aria-label={`${d.label}: ${value} on a scale from −10 (${d.neg}) to +10 (${d.pos})`}
                        >
                          <span className="absolute inset-y-[-3px] left-1/2 w-px bg-input" aria-hidden="true" />
                          <span
                            aria-hidden="true"
                            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary transition-[left] duration-200"
                            style={{ left: `${position}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{d.neg}</span>
                          <span>{d.pos}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon={Compass} title="No ideology profile yet">
                  We have not placed this party on the 8 dimensions yet.
                </EmptyState>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
