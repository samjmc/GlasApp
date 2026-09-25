/**
 * TD profile (/td/:name): hero band with the overall score and ranks, the three score
 * pillars, the Dáil record, and tabs for votes, debates, news and background.
 */

import { useState, type ReactNode } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  ChevronLeft,
  ExternalLink,
  MessageSquare,
  Minus,
  Newspaper,
  SearchX,
  Share2,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  Vote,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScoreRing } from '@/components/pulse/ScoreRing';
import { ScoreBar, StatTile } from '@/components/pulse/Stat';
import { PartyLabel, TDAvatar } from '@/components/pulse/Party';
import { VoteChip } from '@/components/pulse/VoteChip';
import { EmptyState } from '@/components/pulse/EmptyState';
import { NewsArticleCard } from '@/components/NewsArticleCard';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import { formatIsoDate } from '@/lib/isoDate';
import { partyStyle } from '@/lib/parties';
import { cn } from '@/lib/utils';
import type { TdParliamentSummary, TdVote, TdDebateContribution } from '@shared/parliamentApi';
import type { FeedArticle } from '@/lib/news';

type ScoreDimension = 'transparency' | 'effectiveness' | 'integrity' | 'consistency';

/** `GET /api/scores/td/:name` payload (the `data` field). */
interface TDProfile {
  id: number;
  name: string;
  party: string | null;
  constituency: string | null;
  imageUrl: string | null;
  gender: string | null;
  overallScore: number | null;
  label: string | null;
  overallElo: number;
  newsScore: number | null;
  parliamentaryScore: number | null;
  debateScore: number | null;
  nationalRank: number | null;
  partyRank: number | null;
  constituencyRank: number | null;
  eloChange7d: number;
  eloChange30d: number;
  totalStories: number;
  lastScoredAt: string | null;
  memberCode: string | null;
  bio: string | null;
  offices: { title: string; since?: string }[];
  committees: string[];
  questions: { oral: number | null; written: number | null };
  attendancePct: number | null;
  dimensions: Record<ScoreDimension, { elo: number; score: number }>;
  baseline: {
    summary: string | null;
    category: string | null;
    confidence: number | string | null;
    keyFindings: string[];
    researchDate: string | null;
  } | null;
  recentArticles: {
    articleId: number;
    impact: number;
    storyType: string | null;
    sentiment: string | null;
    reasoning: string | null;
    needsReview: boolean;
    at: string;
  }[];
}

type ApiEnvelope<T> = { success: true; data: T; meta?: { total: number } };

async function getParliament<T>(path: string): Promise<ApiEnvelope<T>> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return res.json();
}

/** Seats in the 34th Dáil. */
const DAIL_SEATS = 174;

/** A count, or "—" when unknown. */
function num(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString('en-IE');
}

/** A percentage, or "—" when unknown. */
function pct(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${value}%`;
}

/** A timestamp (or date-only string) as "23 Sep 2026". */
function formatDay(value: string | null | undefined): string {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatIsoDate(value);
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function humanise(value: string): string {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function TDProfilePageEnhanced() {
  const { name } = useParams<{ name: string }>();
  const { toast } = useToast();

  const { data: scoreData, isLoading, error, refetch } = useQuery<TDProfile>({
    queryKey: ['td-profile-v3', name],  // v3: payload shape changed with /api/scores
    queryFn: async () => {
      const res = await fetch(`/api/scores/td/${encodeURIComponent(name || '')}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('TD_NOT_FOUND');
        if (res.status >= 500) throw new Error('Server error - please try again later');
        throw new Error('Failed to load TD profile');
      }
      const json = await res.json();
      return json.data as TDProfile;
    },
    enabled: !!name,
    retry: (failureCount, error) => {
      // Don't retry if TD not found
      if (error instanceof Error && error.message === 'TD_NOT_FOUND') return false;
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 300000  // 5 minutes
  });

  const tdId = scoreData?.id;

  const [votesAgainstPartyOnly, setVotesAgainstPartyOnly] = useState(false);

  const {
    data: parliamentSummaryResp,
    isLoading: parliamentSummaryLoading,
    error: parliamentSummaryError,
    refetch: refetchParliamentSummary,
  } = useQuery({
    queryKey: queryKeys.parliament.tdSummary(tdId ?? 0),
    queryFn: () => getParliament<TdParliamentSummary>(`/api/parliament/tds/${tdId}`),
    enabled: !!tdId,
    staleTime: 5 * 60 * 1000
  });
  const parliamentSummary = parliamentSummaryResp?.data;

  const {
    data: tdVotesResp,
    isLoading: tdVotesLoading,
    isError: tdVotesError,
    refetch: refetchVotes,
  } = useQuery({
    queryKey: queryKeys.parliament.tdVotes(tdId ?? 0, 20, votesAgainstPartyOnly),
    queryFn: () =>
      getParliament<TdVote[]>(
        `/api/parliament/tds/${tdId}/votes?limit=20${votesAgainstPartyOnly ? '&againstParty=true' : ''}`
      ),
    enabled: !!tdId,
    staleTime: 5 * 60 * 1000
  });
  const tdVotes = tdVotesResp?.data ?? [];

  const {
    data: tdDebatesResp,
    isLoading: tdDebatesLoading,
    isError: tdDebatesError,
    refetch: refetchDebates,
  } = useQuery({
    queryKey: queryKeys.parliament.tdDebates(tdId ?? 0, 10),
    queryFn: () => getParliament<TdDebateContribution[]>(`/api/parliament/tds/${tdId}/debates?limit=10`),
    enabled: !!tdId,
    staleTime: 5 * 60 * 1000
  });
  const tdDebateContributions = tdDebatesResp?.data ?? [];

  // Recent news articles for this TD
  const { data: newsArticles = [], isLoading: newsLoading } = useQuery({
    queryKey: queryKeys.td.news(name || ''),
    queryFn: async () => {
      const res = await fetch(`/api/news-feed/td/${encodeURIComponent(name || '')}`);
      if (!res.ok) return [] as FeedArticle[];
      const json = await res.json();
      return (json.data?.articles ?? []) as FeedArticle[];
    },
    enabled: !!name,
    staleTime: 300000  // 5 minutes
  });

  // Latest polling for the TD's party
  const { data: partyPolling } = useQuery({
    queryKey: ['party-polling', scoreData?.party],
    queryFn: async () => {
      if (!scoreData?.party) return null;

      const { supabase } = await import('../lib/supabaseClient');
      const { data, error } = await supabase
        .from('polling_aggregates_cache')
        .select('*')
        .eq('entity_type', 'party')
        .eq('entity_name', scoreData.party)
        .maybeSingle();

      if (error) {
        console.error('Polling fetch error:', error);
        return null;
      }

      return data;
    },
    enabled: !!scoreData?.party
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-11 w-32 rounded-lg" />
        <Skeleton className="h-72 rounded-2xl sm:h-56" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !scoreData) {
    const isNotFound = !error || (error instanceof Error && error.message === 'TD_NOT_FOUND');
    return (
      <EmptyState
        icon={SearchX}
        title={isNotFound ? 'TD not found' : 'Could not load this TD'}
        action={
          isNotFound ? (
            <Button asChild variant="secondary">
              <Link href="/rankings">See all TDs</Link>
            </Button>
          ) : (
            <Button onClick={() => refetch()}>Try again</Button>
          )
        }
        className="mt-6"
      >
        {isNotFound
          ? 'No TD in the current Dáil has that name. Pick one from the rankings.'
          : error instanceof Error
            ? error.message
            : 'Unable to fetch TD data.'}
      </EmptyState>
    );
  }

  const score = scoreData;
  const partyName = partyStyle(score.party).name;

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${score.name} on Glas`, url });
      } catch {
        // The user closed the share sheet.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied' });
    } catch {
      toast({ title: 'Could not copy the link', variant: 'destructive' });
    }
  };

  const rankChips = [
    score.nationalRank !== null && `#${score.nationalRank} of ${DAIL_SEATS} TDs`,
    score.partyRank !== null && `#${score.partyRank} in ${partyName}`,
    score.constituencyRank !== null && score.constituency && `#${score.constituencyRank} in ${score.constituency}`,
  ].filter((chip): chip is string => Boolean(chip));

  const pillars = [
    { label: 'Dáil record', value: score.parliamentaryScore, sub: 'Questions and votes' },
    { label: 'Debate', value: score.debateScore, sub: 'Dáil debates' },
    {
      label: 'News',
      value: score.newsScore,
      sub: `${score.totalStories} ${score.totalStories === 1 ? 'story' : 'stories'}`,
    },
  ];
  const unscored = pillars.filter((p) => p.value === null).map((p) => p.label);

  // The parliament feed is the source of truth; the score payload fills gaps while it loads or fails.
  const summary = parliamentSummary;
  const questionsOral = summary?.questionsOral ?? score.questions?.oral ?? null;
  const questionsWritten = summary?.questionsWritten ?? score.questions?.written ?? null;
  const questionsTotal =
    questionsOral === null && questionsWritten === null ? null : (questionsOral ?? 0) + (questionsWritten ?? 0);
  const attendance = summary?.attendancePct ?? score.attendancePct;
  const isPresiding = summary?.isPresiding ?? false;

  const stats: { label: string; value: ReactNode; sub?: string; bar?: number | null }[] = [
    {
      label: 'Votes cast',
      value: isPresiding ? '—' : (
        <>
          {num(summary?.votesCast)}
          <span className="text-base text-muted-foreground"> / {num(summary?.divisionsEligible)}</span>
        </>
      ),
      sub: isPresiding ? 'Chair, does not vote' : 'of divisions eligible',
      bar: isPresiding ? undefined : attendance,
    },
    { label: 'Attendance', value: isPresiding ? '—' : pct(attendance), sub: 'of Dáil divisions' },
    { label: 'Sitting days', value: num(summary?.sittingDays) },
    {
      label: 'Speeches',
      value: num(summary?.speeches),
      sub: summary?.sectionsSpoken != null ? `in ${num(summary.sectionsSpoken)} debate sections` : undefined,
    },
    { label: 'Questions', value: num(questionsTotal), sub: `${num(questionsOral)} oral · ${num(questionsWritten)} written` },
    {
      label: 'Party line',
      value: pct(summary?.partyLinePct),
      sub: summary?.votesAgainstParty != null ? `${summary.votesAgainstParty} votes against party` : undefined,
    },
  ];

  const articleById = new Map(newsArticles.map((a) => [a.id, a]));
  const pollSupport = partyPolling?.latest_support ? parseFloat(partyPolling.latest_support) : null;
  const pollChange = partyPolling?.support_30d_change ? parseFloat(partyPolling.support_30d_change) : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/rankings"
        className="inline-flex min-h-[44px] items-center gap-1 self-start text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Rankings
      </Link>

      {/* Hero */}
      <section className="flex flex-col gap-6 rounded-2xl bg-hero p-5 text-hero-foreground sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4 sm:gap-5">
          <TDAvatar
            name={score.name}
            party={score.party}
            imageUrl={score.imageUrl}
            size="lg"
            className="ring-2 ring-hero-muted sm:h-24 sm:w-24 sm:text-2xl"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className="font-display text-3xl font-bold leading-none tracking-tight sm:text-5xl">{score.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
              {score.party ? (
                <Link
                  href={`/party/${encodeURIComponent(score.party)}`}
                  className="inline-flex min-h-[44px] items-center hover:text-hero-soft sm:min-h-0"
                >
                  <PartyLabel party={score.party} className="text-[15px] font-semibold text-inherit" />
                </Link>
              ) : (
                <PartyLabel party={score.party} className="text-[15px] font-semibold text-hero-foreground" />
              )}
              {score.constituency && (
                <>
                  <span className="text-hero-soft" aria-hidden="true">·</span>
                  <Link
                    href={`/constituency/${encodeURIComponent(score.constituency)}`}
                    className="inline-flex min-h-[44px] items-center font-semibold underline underline-offset-4 hover:text-hero-soft sm:min-h-0"
                  >
                    {score.constituency}
                  </Link>
                </>
              )}
            </div>
            {score.offices.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {score.offices.map((office) => (
                  <span
                    key={office.title}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-hero-muted px-3 text-[13px] font-semibold"
                  >
                    <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
                    {office.title}
                  </span>
                ))}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={handleShare}
            aria-label="Share this profile"
            className="h-11 w-11 shrink-0 bg-hero-muted px-0 text-hero-foreground hover:bg-hero-muted/80 hover:text-hero-foreground sm:w-auto sm:px-4"
          >
            <Share2 aria-hidden="true" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </div>

        <div className="flex items-center gap-5 lg:border-l lg:border-hero-muted lg:pl-8">
          <ScoreRing
            value={score.overallScore}
            size={120}
            label="Overall score"
            caption="of 100"
            trackClassName="stroke-hero-muted"
          />
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-[13px] font-semibold text-hero-soft">
              Overall score{score.label ? ` · ${score.label}` : ''}
            </span>
            <div className="flex flex-wrap gap-2">
              {rankChips.length > 0 ? (
                rankChips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex min-h-8 items-center rounded-full bg-hero-muted px-3 py-1 text-[13px] font-semibold"
                  >
                    {chip}
                  </span>
                ))
              ) : (
                <span className="text-[13px] text-hero-soft">Not ranked yet</span>
              )}
            </div>
            <span className="text-[13px] text-hero-soft">
              {score.lastScoredAt ? `Scored ${formatDay(score.lastScoredAt)}` : 'Not scored yet'}
            </span>
          </div>
        </div>
      </section>

      {/* Pillars and Dáil record */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-bold tracking-tight">Score breakdown</h2>
            <span className="text-[13px] text-muted-foreground">3 pillars</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {pillars.map((p) =>
              p.value === null ? (
                <div
                  key={p.label}
                  className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-input px-1 py-4 text-center"
                >
                  <ScoreRing value={null} size={72} label={p.label} />
                  <span className="text-[13px] font-bold text-muted-foreground">{p.label}</span>
                  <span className="text-xs text-muted-foreground">Not scored yet</span>
                </div>
              ) : (
                <div key={p.label} className="flex flex-col items-center gap-2 rounded-xl bg-elevated px-1 py-4 text-center">
                  <ScoreRing value={p.value} size={72} label={p.label} />
                  <span className="text-[13px] font-bold">{p.label}</span>
                  <span className="text-xs text-muted-foreground">{p.sub}</span>
                </div>
              )
            )}
          </div>
          {unscored.length > 0 && unscored.length < pillars.length && (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {unscored.join(' and ')} {unscored.length === 1 ? 'is' : 'are'} not scored yet, so the overall score
              is the weighted mean of the other pillars.
            </p>
          )}
        </Card>

        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="font-display text-xl font-bold tracking-tight">Dáil record</h2>
            {summary?.memberSince && (
              <span className="text-[13px] text-muted-foreground">TD since {formatIsoDate(summary.memberSince)}</span>
            )}
          </div>
          {parliamentSummaryLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stats.map((s) => (
                <Skeleton key={s.label} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {stats.map((s) => (
                  <StatTile key={s.label} label={s.label} value={s.value} sub={s.sub} className="border-0 bg-elevated">
                    {s.bar !== undefined && <ScoreBar value={s.bar} />}
                  </StatTile>
                ))}
              </div>
              {parliamentSummaryError && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>Could not load the full Dáil record.</span>
                  <Button variant="outline" size="sm" onClick={() => refetchParliamentSummary()}>
                    Try again
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Tabs */}
        <Tabs defaultValue="votes" className="flex min-w-0 flex-col gap-4">
          <TabsList aria-label="Profile sections" className="grid h-auto w-full grid-cols-4 sm:max-w-[520px]">
            {['Votes', 'Debates', 'News', 'Background'].map((label) => (
              <TabsTrigger
                key={label}
                value={label.toLowerCase()}
                className="h-11 px-1 text-[13px] sm:px-4 sm:text-sm"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="votes" className="mt-0">
            <Card className="flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h2 className="font-display text-xl font-bold tracking-tight">Recent votes</h2>
                  <span className="text-[13px] text-muted-foreground">
                    {votesAgainstPartyOnly ? 'Divisions where they broke from their party' : 'Last 20 divisions'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  aria-pressed={votesAgainstPartyOnly}
                  onClick={() => setVotesAgainstPartyOnly((prev) => !prev)}
                  className={cn(
                    'h-11 rounded-full sm:h-10',
                    votesAgainstPartyOnly && 'border-warn bg-warn/15 text-warn hover:bg-warn/20'
                  )}
                >
                  Against party only
                </Button>
              </div>

              {tdVotesLoading ? (
                <div className="flex flex-col gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))}
                </div>
              ) : tdVotesError ? (
                <EmptyState
                  icon={Vote}
                  title="Could not load votes"
                  action={<Button variant="secondary" onClick={() => refetchVotes()}>Try again</Button>}
                >
                  The Dáil record did not load. Try again in a moment.
                </EmptyState>
              ) : tdVotes.length === 0 ? (
                <EmptyState icon={Vote} title={votesAgainstPartyOnly ? `No votes against ${partyName}` : 'No votes recorded yet'}>
                  {votesAgainstPartyOnly
                    ? 'In the divisions we have, they voted with their party every time.'
                    : 'Votes show here once the Dáil divisions they took part in are synced.'}
                </EmptyState>
              ) : (
                <ul className="flex flex-col gap-2">
                  {tdVotes.map((vote) => {
                    const title = vote.debateTitle || vote.subject || 'Division';
                    return (
                      <li key={vote.divisionId} className="flex items-center gap-3 rounded-xl bg-elevated p-3 sm:gap-4 sm:px-4">
                        <VoteChip vote={vote.vote} />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="line-clamp-2 text-[15px] font-bold leading-snug">{title}</span>
                          {vote.subject && vote.subject !== title && (
                            <span className="line-clamp-2 text-[13px] text-muted-foreground">{vote.subject}</span>
                          )}
                          <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
                            <span>{formatIsoDate(vote.date)}</span>
                            {vote.outcome && <span>· {vote.outcome}</span>}
                            {vote.withParty === false && <span className="font-semibold text-warn sm:hidden">· Against party</span>}
                          </span>
                        </div>
                        {vote.withParty !== null && (
                          <Badge
                            variant={vote.withParty ? 'outline' : 'warn'}
                            className={cn('hidden shrink-0 sm:inline-flex', vote.withParty && 'border-transparent bg-card text-muted-foreground')}
                          >
                            {vote.withParty ? 'With party' : 'Against party'}
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="debates" className="mt-0">
            <Card className="flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-xl font-bold tracking-tight">Recent debates</h2>
                <span className="text-[13px] text-muted-foreground">From Oireachtas debate transcripts</span>
              </div>
              {tdDebatesLoading ? (
                <div className="flex flex-col gap-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                  ))}
                </div>
              ) : tdDebatesError ? (
                <EmptyState
                  icon={MessageSquare}
                  title="Could not load debates"
                  action={<Button variant="secondary" onClick={() => refetchDebates()}>Try again</Button>}
                >
                  The debate record did not load. Try again in a moment.
                </EmptyState>
              ) : tdDebateContributions.length === 0 ? (
                <EmptyState icon={MessageSquare} title="No debate contributions yet">
                  Speeches show here once the debates they spoke in are synced.
                </EmptyState>
              ) : (
                <ul className="flex flex-col gap-2">
                  {tdDebateContributions.map((c) => (
                    <li key={c.sectionId} className="flex flex-col gap-1.5 rounded-xl bg-elevated p-4">
                      <span className="flex flex-wrap justify-between gap-x-3 text-[13px] text-muted-foreground">
                        <span>{formatIsoDate(c.date)}</span>
                        <span>
                          {c.speeches} {c.speeches === 1 ? 'speech' : 'speeches'} · {c.words.toLocaleString('en-IE')} words
                        </span>
                      </span>
                      <h3 className="text-[15px] font-bold leading-snug">{c.title}</h3>
                      {c.excerpt && <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{c.excerpt}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="news" className="mt-0 flex flex-col gap-4">
            {score.recentArticles.length > 0 && (
              <Card className="flex flex-col gap-4 p-5 sm:p-6">
                <div className="flex flex-col gap-1">
                  <h2 className="font-display text-xl font-bold tracking-tight">Effect on score</h2>
                  <span className="text-[13px] text-muted-foreground">
                    {score.totalStories} {score.totalStories === 1 ? 'story has' : 'stories have'} been scored. The most recent:
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {score.recentArticles.map((a) => {
                    const article = articleById.get(a.articleId);
                    return (
                      <li key={a.articleId} className="flex items-start gap-3 rounded-xl bg-elevated p-4">
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          {article && (
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-start gap-1.5 text-[15px] font-bold leading-snug hover:text-primary"
                            >
                              {article.title}
                              <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            </a>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {a.storyType && <Badge variant="secondary">{humanise(a.storyType)}</Badge>}
                            {a.sentiment && <Badge variant="outline">{humanise(a.sentiment)}</Badge>}
                            {a.needsReview && <Badge variant="warn">Needs review</Badge>}
                          </div>
                          {a.reasoning && <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{a.reasoning}</p>}
                          <span className="text-xs text-muted-foreground">{formatDay(a.at)}</span>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 font-display text-lg font-bold',
                            a.impact > 0 ? 'text-score-high' : a.impact < 0 ? 'text-warn' : 'text-muted-foreground'
                          )}
                          aria-label={`Score effect ${a.impact}`}
                        >
                          {a.impact > 0 ? '+' : ''}
                          {a.impact}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}

            <section className="flex flex-col gap-3" aria-labelledby="td-news-heading">
              <h2 id="td-news-heading" className="font-display text-xl font-bold tracking-tight">
                In the news
              </h2>
              {newsLoading ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Skeleton className="h-80 rounded-2xl" />
                  <Skeleton className="h-80 rounded-2xl" />
                </div>
              ) : newsArticles.length === 0 ? (
                <EmptyState icon={Newspaper} title="No recent stories">
                  Stories from Irish news sources that name {score.name} will show here.
                </EmptyState>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {newsArticles.map((article) => (
                    <NewsArticleCard key={article.id} article={article} />
                  ))}
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="background" className="mt-0">
            <Card className="flex flex-col gap-5 p-5 sm:p-6">
              <h2 className="font-display text-xl font-bold tracking-tight">Background</h2>
              {!score.bio && !score.baseline?.summary && !score.baseline?.category && !score.baseline?.researchDate ? (
                <EmptyState icon={UserRound} title="No background yet">
                  A short biography and research summary will show here once they are added.
                </EmptyState>
              ) : (
                <>
                  {score.bio && <p className="leading-relaxed">{score.bio}</p>}
                  {score.baseline?.summary && (
                    <div className="flex flex-col gap-3 rounded-xl bg-elevated p-4">
                      <p className="leading-relaxed">{score.baseline.summary}</p>
                      {score.baseline.keyFindings.length > 0 && (
                        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                          {score.baseline.keyFindings.map((finding) => (
                            <li key={finding}>{finding}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {(score.baseline?.category || score.baseline?.researchDate) && (
                    <dl className="grid grid-cols-2 gap-3">
                      {score.baseline?.category && (
                        <div className="flex flex-col gap-1 rounded-xl bg-elevated p-4">
                          <dt className="text-[13px] font-semibold text-muted-foreground">Research category</dt>
                          <dd className="font-semibold">{humanise(score.baseline.category)}</dd>
                        </div>
                      )}
                      {score.baseline?.researchDate && (
                        <div className="flex flex-col gap-1 rounded-xl bg-elevated p-4">
                          <dt className="text-[13px] font-semibold text-muted-foreground">Researched</dt>
                          <dd className="font-semibold">{formatDay(score.baseline.researchDate)}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                </>
              )}
              <div className="border-t pt-5 lg:hidden">
                <CommitteeList committees={score.committees} />
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Side column */}
        <aside className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="font-display text-lg font-bold tracking-tight">Rankings</h2>
            <ul className="flex flex-col gap-1">
              {[
                { label: 'National', rank: score.nationalRank, of: `of ${DAIL_SEATS}`, href: '/rankings' },
                { label: partyName, rank: score.partyRank, of: 'in party', href: score.party ? `/party/${encodeURIComponent(score.party)}` : null },
                {
                  label: score.constituency ?? 'Constituency',
                  rank: score.constituencyRank,
                  of: 'in constituency',
                  href: score.constituency ? `/constituency/${encodeURIComponent(score.constituency)}` : null,
                },
              ].map((row) => {
                const body = (
                  <>
                    <span className="min-w-0 truncate text-sm font-semibold">{row.label}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      <span className="font-display text-lg font-bold text-foreground">
                        {row.rank !== null ? `#${row.rank}` : '—'}
                      </span>{' '}
                      {row.of}
                    </span>
                  </>
                );
                const classes = 'flex min-h-[44px] items-center justify-between gap-3 rounded-lg px-3';
                return (
                  <li key={row.of}>
                    {row.href ? (
                      <Link href={row.href} className={cn(classes, 'transition-colors hover:bg-accent')}>
                        {body}
                      </Link>
                    ) : (
                      <div className={classes}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="font-display text-lg font-bold tracking-tight">Score trend</h2>
            <dl className="flex flex-col gap-2">
              <TrendRow label="Last 7 days" change={score.eloChange7d} />
              <TrendRow label="Last 30 days" change={score.eloChange30d} />
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted-foreground">Current Elo</dt>
                <dd className="font-display text-lg font-bold">{num(score.overallElo)}</dd>
              </div>
            </dl>
            <p className="text-[13px] text-muted-foreground">
              {score.lastScoredAt ? `Last scored ${formatDay(score.lastScoredAt)}` : 'No stories scored yet.'}
            </p>
          </Card>

          <Card className="hidden flex-col gap-3 p-5 lg:flex">
            <CommitteeList committees={score.committees} />
          </Card>

          {score.party && (
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="font-display text-lg font-bold tracking-tight">Party polling</h2>
              {pollSupport !== null ? (
                <>
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-3xl font-bold tracking-tight">{pollSupport.toFixed(1)}%</span>
                    {pollChange !== null && pollChange !== 0 && (
                      <span className={cn('text-sm font-semibold', pollChange > 0 ? 'text-score-high' : 'text-warn')}>
                        {pollChange > 0 ? '+' : ''}
                        {pollChange.toFixed(1)} in 30 days
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-muted-foreground">
                    National support for {partyName}
                    {partyPolling?.latest_poll_source ? ` · ${partyPolling.latest_poll_source}` : ''}
                    {partyPolling?.latest_poll_date ? `, ${formatDay(partyPolling.latest_poll_date)}` : ''}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No recent national poll for {partyName}.</p>
              )}
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function TrendRow({ label, change }: { label: string; change: number }) {
  const Icon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'inline-flex items-center gap-1.5 font-display text-lg font-bold',
          change > 0 ? 'text-score-high' : change < 0 ? 'text-warn' : 'text-muted-foreground'
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {change > 0 ? '+' : ''}
        {change} Elo
      </dd>
    </div>
  );
}

function CommitteeList({ committees }: { committees: string[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
        <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Committees
      </h2>
      {committees.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {committees.map((committee) => (
            <Badge key={committee} variant="secondary" className="h-8 px-3 text-[13px]">
              {committee}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          No committee places recorded. They are not synced from the Oireachtas yet.
        </p>
      )}
    </div>
  );
}
