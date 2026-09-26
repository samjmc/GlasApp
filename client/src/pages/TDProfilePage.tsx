/**
 * TD profile (/td/:name): hero band with the overall score and ranks, the four facts the
 * score is built from, the Dáil record, and tabs for votes, debates, news and background.
 */

import { useState, type ReactNode } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  ChevronLeft,
  ClipboardList,
  Euro,
  ExternalLink,
  FileText,
  MessageSquare,
  Newspaper,
  SearchX,
  Share2,
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
import { RetryButton } from '@/components/data/RetryButton';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import { formatIsoDate } from '@/lib/isoDate';
import { partyStyle } from '@/lib/parties';
import { formatScore } from '@/lib/score';
import { cn } from '@/lib/utils';
import { INTEREST_CATEGORIES } from '@shared/parliamentApi';
import type {
  AbsenceKind,
  OfficeKind,
  TdParliamentSummary,
  TdVote,
  TdDebateContribution,
  TdCommittee,
  TdBill,
  TdQuestionTopic,
  TdInterests,
  TdAllowances,
} from '@shared/parliamentApi';
import type { TdProfile } from '@shared/scoresApi';
import type { FeedArticle } from '@/lib/news';

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

/** A full-term backbencher's full-marks benchmarks, as in server/scoring/weights.ts. */
const FULL_ATTENDANCE_BENCHMARK = 95;
const FULL_QUESTIONS_BENCHMARK = 200;

/** Offices whose holders are not expected to ask parliamentary questions. */
const QUESTION_EXEMPT_OFFICES: readonly OfficeKind[] = ['cabinet', 'minister_of_state', 'ceann_comhairle'];

const ABSENCE_LABELS: Record<AbsenceKind, string> = {
  parental_leave: 'Parental leave',
  medical_leave: 'Medical leave',
  bereavement: 'Bereavement',
  other_leave: 'Leave',
};

/** Cents as euro: "€1,234.56". */
function euro(cents: number): string {
  return (cents / 100).toLocaleString('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** A first-of-month date as "Aug 2026". */
function formatMonth(value: string): string {
  return formatIsoDate(value, { month: 'short', year: 'numeric' });
}

/** Why some divisions or questions are not counted for this TD: only the notes that apply. */
function fairnessNotes(s: TdParliamentSummary): string[] {
  const notes: string[] = [];
  const divisions = (n: number) => `${num(n)} ${n === 1 ? 'division' : 'divisions'}`;
  const isAre = (n: number) => (n === 1 ? 'is' : 'are');
  if (s.divisionsChaired !== null && s.divisionsChaired > 0) {
    notes.push(`${divisions(s.divisionsChaired)} in the chair ${isAre(s.divisionsChaired)} not counted (the chair cannot vote).`);
  }
  if (s.divisionsExcused !== null && s.divisionsExcused > 0) {
    notes.push(`${divisions(s.divisionsExcused)} during documented leave ${isAre(s.divisionsExcused)} not counted.`);
  }
  if (s.attendanceBenchmark !== null && s.attendanceBenchmark < FULL_ATTENDANCE_BENCHMARK) {
    notes.push(
      `Full marks for votes at ${s.attendanceBenchmark}%: time in a leadership role (government office or party leader, on either side) has its own benchmark.`,
    );
  }
  const exempt = s.officeHistory.filter((o) => QUESTION_EXEMPT_OFFICES.includes(o.type));
  const wasChair = s.isPresiding || exempt.some((o) => o.type === 'ceann_comhairle');
  if (!s.questionsComplete) notes.push('Some months of questions are not loaded yet, so the question count may be low.');
  if (s.questionsExpected === null) {
    if (wasChair) notes.push('Not scored on questions: the Ceann Comhairle chairs the Dáil.');
    else if (exempt.length > 0) notes.push('Not scored on questions: members of government answer questions, they do not ask them.');
  } else if (s.questionsExpected < FULL_QUESTIONS_BENCHMARK) {
    const expected = `Expected ${num(Math.round(s.questionsExpected))} questions`;
    notes.push(
      exempt.length === 0
        ? `${expected}, pro-rated to the time they were expected to ask.`
        : wasChair
          ? `${expected}, for the time outside the chair.`
          : `${expected}, for the time outside government office.`
    );
  }
  return notes;
}

export default function TDProfilePageEnhanced() {
  const { name } = useParams<{ name: string }>();
  const { toast } = useToast();

  const { data: scoreData, isLoading, error, refetch, isFetching } = useQuery<TdProfile>({
    queryKey: ['td-profile-v4', name],  // v4: the score is built from Oireachtas facts only
    queryFn: async () => {
      const res = await fetch(`/api/scores/td/${encodeURIComponent(name || '')}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('TD_NOT_FOUND');
        if (res.status >= 500) throw new Error('Server error - please try again later');
        throw new Error('Failed to load TD profile');
      }
      const json = await res.json();
      return json.data as TdProfile;
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
    isFetching: parliamentSummaryFetching,
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
    isFetching: tdVotesFetching,
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
    isFetching: tdDebatesFetching,
  } = useQuery({
    queryKey: queryKeys.parliament.tdDebates(tdId ?? 0, 10),
    queryFn: () => getParliament<TdDebateContribution[]>(`/api/parliament/tds/${tdId}/debates?limit=10`),
    enabled: !!tdId,
    staleTime: 5 * 60 * 1000
  });
  const tdDebateContributions = tdDebatesResp?.data ?? [];

  const {
    data: tdCommitteesResp,
    isLoading: tdCommitteesLoading,
    isError: tdCommitteesError,
    refetch: refetchCommittees,
    isFetching: tdCommitteesFetching,
  } = useQuery({
    queryKey: queryKeys.parliament.tdCommittees(tdId ?? 0),
    queryFn: () => getParliament<TdCommittee[]>(`/api/parliament/tds/${tdId}/committees`),
    enabled: !!tdId,
    staleTime: 5 * 60 * 1000
  });
  const tdCommittees = tdCommitteesResp?.data ?? [];

  const {
    data: tdBillsResp,
    isLoading: tdBillsLoading,
    isError: tdBillsError,
    refetch: refetchBills,
    isFetching: tdBillsFetching,
  } = useQuery({
    queryKey: queryKeys.parliament.tdBills(tdId ?? 0, 20),
    queryFn: () => getParliament<TdBill[]>(`/api/parliament/tds/${tdId}/bills?limit=20`),
    enabled: !!tdId,
    staleTime: 5 * 60 * 1000
  });
  const tdBills = tdBillsResp?.data ?? [];

  const {
    data: tdQuestionTopicsResp,
    isLoading: tdQuestionTopicsLoading,
    isError: tdQuestionTopicsError,
    refetch: refetchQuestionTopics,
    isFetching: tdQuestionTopicsFetching,
  } = useQuery({
    queryKey: queryKeys.parliament.tdQuestionTopics(tdId ?? 0),
    queryFn: () => getParliament<TdQuestionTopic[]>(`/api/parliament/tds/${tdId}/question-topics`),
    enabled: !!tdId,
    staleTime: 5 * 60 * 1000
  });
  const tdQuestionTopics = tdQuestionTopicsResp?.data ?? [];

  // Both return `data: null` (not 404) when nothing is stored for this TD yet.
  const {
    data: tdInterestsResp,
    isLoading: tdInterestsLoading,
    isError: tdInterestsError,
    refetch: refetchInterests,
    isFetching: tdInterestsFetching,
  } = useQuery({
    queryKey: queryKeys.parliament.tdInterests(tdId ?? 0),
    queryFn: () => getParliament<TdInterests | null>(`/api/parliament/tds/${tdId}/interests`),
    enabled: !!tdId,
    staleTime: 5 * 60 * 1000
  });
  const tdInterests = tdInterestsResp?.data ?? null;

  const {
    data: tdAllowancesResp,
    isLoading: tdAllowancesLoading,
    isError: tdAllowancesError,
    refetch: refetchAllowances,
    isFetching: tdAllowancesFetching,
  } = useQuery({
    queryKey: queryKeys.parliament.tdAllowances(tdId ?? 0),
    queryFn: () => getParliament<TdAllowances | null>(`/api/parliament/tds/${tdId}/allowances`),
    enabled: !!tdId,
    staleTime: 5 * 60 * 1000
  });
  const tdAllowances = tdAllowancesResp?.data ?? null;

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
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
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
            <RetryButton onRetry={() => refetch()} pending={isFetching} />
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

  const { components, facts } = score;
  // A NULL component was not expected of this TD (or cannot be measured): it is left out of
  // the score, never counted as 0.
  const notApplicable = <span className="text-lg text-muted-foreground">Not applicable</span>;
  const factTiles: { label: string; value: ReactNode; sub: string; note?: string }[] = [
    {
      label: 'Questions',
      value: components.questions === null ? notApplicable : num(components.questions),
      sub: `${num(facts.questions.oral)} oral · ${num(facts.questions.written)} written`,
    },
    {
      label: 'Dáil votes',
      value: components.attendance === null ? notApplicable : pct(components.attendance),
      sub: `${num(facts.votes.cast)} of ${num(facts.votes.divisionsEligible)} divisions`,
      note: 'Pairing is not published, so a paired absence counts as a missed vote.',
    },
    {
      label: 'Committees',
      value: components.committees === null ? notApplicable : pct(components.committees),
      sub: `${num(facts.committees.sittingsAttended)} of ${num(facts.committees.sittingsEligible)} sittings`,
    },
    {
      label: 'Debate',
      value: components.debate === null ? notApplicable : `${components.debate} / 100`,
      sub: `Spoke in ${num(facts.debate.sectionsSpoken)} debates over ${num(facts.debate.sittingDays)} sitting days`,
      note: 'Per sitting day, against the TD at the 75th percentile, who scores 100.',
    },
  ];

  // The parliament feed is the source of truth; the score payload fills gaps while it loads or fails.
  const summary = parliamentSummary;
  const questionsOral = summary?.questionsOral ?? facts.questions.oral;
  const questionsWritten = summary?.questionsWritten ?? facts.questions.written;
  const questionsTotal =
    questionsOral === null && questionsWritten === null ? null : (questionsOral ?? 0) + (questionsWritten ?? 0);
  const attendance = summary?.attendancePct ?? components.attendance;
  const isPresiding = summary?.isPresiding ?? score.isPresiding;
  const offices: { title: string; since?: string | null }[] = summary?.offices ?? score.offices;

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
    {
      label: 'Committee attendance',
      value: pct(summary?.committeeAttendancePct),
      sub: `${num(summary?.committeeSittingsAttended)} of ${num(summary?.committeeSittingsEligible)} sittings`,
    },
    // NULL until the bills feed has run once: "—", never 0.
    { label: 'Bills sponsored', value: num(summary?.billsSponsored) },
  ];

  // question-topics is sorted by total (oral + written) desc, so the first entry's total is the max.
  const topQuestionTopics = tdQuestionTopics.slice(0, 8);
  const maxQuestionTopicTotal = topQuestionTopics.reduce((max, t) => Math.max(max, t.oral + t.written), 0);

  const recordNotes = summary ? fairnessNotes(summary) : [];
  const absences = summary?.absences ?? [];

  // Declared categories get a row each; the ones with nothing declared share one muted line.
  const interestCategories = (tdInterests?.categories ?? []).slice().sort((a, b) => a.number - b.number);
  const interestLabel = (n: number) => INTEREST_CATEGORIES[n] ?? `Category ${n}`;
  const declaredInterests = interestCategories.filter((c) => c.declared !== null);
  const undeclaredInterests = interestCategories.filter((c) => c.declared === null).map((c) => interestLabel(c.number));

  const committeeList = (
    <CommitteeList
      committees={tdCommittees}
      loading={tdCommitteesLoading}
      error={tdCommitteesError}
      onRetry={() => refetchCommittees()}
      retrying={tdCommitteesFetching}
    />
  );

  const pollSupport = partyPolling?.latest_support ? parseFloat(partyPolling.latest_support) : null;
  const pollChange = partyPolling?.support_30d_change ? parseFloat(partyPolling.support_30d_change) : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/rankings"
        className="inline-flex min-h-11 items-center gap-1 self-start rounded-md text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
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
            {offices.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {offices.map((office) => (
                  <span
                    key={office.title}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-hero-muted px-3 py-1 text-[13px] font-semibold"
                  >
                    <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {office.title}
                      {office.since && <span className="font-normal text-hero-soft"> since {formatDay(office.since)}</span>}
                    </span>
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
              ) : score.isPresiding ? (
                <span className="inline-flex min-h-8 items-center rounded-full bg-hero-muted px-3 py-1 text-[13px] font-semibold">
                  Holds the chair, so not ranked
                </span>
              ) : (
                <span className="text-[13px] text-hero-soft">
                  {score.computedAt ? 'Not ranked: fewer than 2 of the 4 measures apply' : 'Not ranked yet'}
                </span>
              )}
            </div>
            <span className="text-[13px] text-hero-soft">
              {score.computedAt ? `Scored ${formatDay(score.computedAt)}` : 'Not scored yet'}
            </span>
          </div>
        </div>
      </section>

      {/* Pillars and Dáil record */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="font-display text-xl font-bold tracking-tight">Score breakdown</h2>
            <span className="text-[13px] text-muted-foreground">From the Oireachtas record</span>
          </div>
          {score.isPresiding && (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Holds the chair. The Ceann Comhairle presides rather than votes, asks questions or debates, so this TD
              is not scored or ranked.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {factTiles.map((t) => (
              <StatTile
                key={t.label}
                label={t.label}
                value={t.value}
                sub={
                  <>
                    {t.sub}
                    {t.note && <span className="mt-1 block text-xs">{t.note}</span>}
                  </>
                }
                className="border-0 bg-elevated"
              />
            ))}
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Dáil record {formatScore(score.pillars.parliamentary)} · Debate {formatScore(score.pillars.debate)}. A
            measure that does not apply is left out, never counted as 0.
            {facts.recordUrl && (
              <>
                {' '}
                <a
                  href={facts.recordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-foreground underline underline-offset-4 hover:text-primary"
                >
                  Check the record on oireachtas.ie
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </>
            )}
          </p>
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
              {(recordNotes.length > 0 || absences.length > 0) && (
                <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {recordNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                  {absences.map((a) => (
                    <li key={`${a.from}-${a.reason}`}>
                      On leave {formatIsoDate(a.from)} – {a.to ? formatIsoDate(a.to) : 'ongoing'} · {ABSENCE_LABELS[a.reason]} ·{' '}
                      <a
                        href={a.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center gap-1 font-semibold underline underline-offset-4 transition-colors hover:text-foreground sm:min-h-0"
                      >
                        Source
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {parliamentSummaryError && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>Could not load the full Dáil record.</span>
                  <RetryButton
                    variant="outline"
                    size="sm"
                    className="h-11 md:h-9"
                    onRetry={() => refetchParliamentSummary()}
                    pending={parliamentSummaryFetching}
                  />
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
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
                  action={<RetryButton variant="secondary" onRetry={() => refetchVotes()} pending={tdVotesFetching} />}
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
                  action={<RetryButton variant="secondary" onRetry={() => refetchDebates()} pending={tdDebatesFetching} />}
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
            <section className="flex flex-col gap-3" aria-labelledby="td-news-heading">
              <h2 id="td-news-heading" className="font-display text-xl font-bold tracking-tight">
                In the news
              </h2>
              {newsLoading ? (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
                  <Skeleton className="h-80 rounded-2xl" />
                  <Skeleton className="h-80 rounded-2xl" />
                </div>
              ) : newsArticles.length === 0 ? (
                <EmptyState icon={Newspaper} title="No recent stories">
                  Stories from Irish news sources that name {score.name} will show here.
                </EmptyState>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
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
                {committeeList}
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

          <Card className="hidden flex-col gap-3 p-5 lg:flex">
            {committeeList}
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
              <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Bills sponsored
            </h2>
            {tdBillsLoading ? (
              <div className="flex flex-col gap-2">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : tdBillsError ? (
              <SideCardError message="Could not load bills." onRetry={() => refetchBills()} retrying={tdBillsFetching} />
            ) : tdBills.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {summary?.billsSponsored === null
                  ? 'Bills show here once they are synced from the Oireachtas.'
                  : 'No bills sponsored this term.'}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {tdBills.map((bill) => (
                  <li key={bill.id}>
                    <Link
                      href={`/debates?tab=bills&bill=${encodeURIComponent(bill.id)}`}
                      className="flex flex-col gap-1.5 rounded-xl bg-elevated p-3 transition-colors hover:bg-accent"
                    >
                      <span className="line-clamp-2 text-sm font-bold leading-snug">{bill.shortTitle}</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{bill.status}</Badge>
                        {bill.isPrimary && <Badge>Primary sponsor</Badge>}
                      </span>
                      <span className="text-[13px] text-muted-foreground">
                        {bill.source}
                        {bill.mostRecentStage ? ` · ${bill.mostRecentStage}` : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
              <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Question focus
            </h2>
            {tdQuestionTopicsLoading ? (
              <div className="flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-9 rounded-lg" />
                ))}
              </div>
            ) : tdQuestionTopicsError ? (
              <SideCardError
                message="Could not load question topics."
                onRetry={() => refetchQuestionTopics()}
                retrying={tdQuestionTopicsFetching}
              />
            ) : topQuestionTopics.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-muted-foreground">No parliamentary questions recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {topQuestionTopics.map((topic) => {
                  const total = topic.oral + topic.written;
                  return (
                    <li key={topic.department} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 font-semibold leading-snug">{topic.department}</span>
                        <span className="shrink-0 text-[13px] text-muted-foreground">
                          {topic.oral} oral · {topic.written} written
                        </span>
                      </div>
                      <ScoreBar
                        value={maxQuestionTopicTotal > 0 ? (total / maxQuestionTopicTotal) * 100 : 0}
                        tone="bg-primary"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
              <ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Register of interests{tdInterests ? ` (${tdInterests.year})` : ''}
            </h2>
            {tdInterestsLoading ? (
              <div className="flex flex-col gap-2">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : tdInterestsError ? (
              <SideCardError
                message="Could not load the register of interests."
                onRetry={() => refetchInterests()}
                retrying={tdInterestsFetching}
              />
            ) : !tdInterests ? (
              <p className="text-[13px] leading-relaxed text-muted-foreground">Not in the published register yet.</p>
            ) : (
              <>
                {declaredInterests.length > 0 && (
                  <dl className="flex flex-col gap-2">
                    {declaredInterests.map((c) => (
                      <div key={c.number} className="flex min-w-0 flex-col gap-1 rounded-xl bg-elevated p-3">
                        <dt className="text-sm font-bold leading-snug">{interestLabel(c.number)}</dt>
                        <dd className="whitespace-pre-line break-words text-sm leading-relaxed">{c.declared}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {undeclaredInterests.length > 0 && (
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    Nothing declared: {undeclaredInterests.join(', ')}
                  </p>
                )}
                <a
                  href={tdInterests.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-sm text-[13px] font-semibold text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground sm:min-h-0"
                >
                  Source (PDF)
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </a>
              </>
            )}
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
              <Euro className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Allowances (PSA)
            </h2>
            {tdAllowancesLoading ? (
              <div className="flex flex-col gap-2">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : tdAllowancesError ? (
              <SideCardError message="Could not load allowances." onRetry={() => refetchAllowances()} retrying={tdAllowancesFetching} />
            ) : !tdAllowances ? (
              <p className="text-[13px] leading-relaxed text-muted-foreground">Not published yet.</p>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <span className="font-display text-3xl font-bold tracking-tight">{euro(tdAllowances.totalCents)}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {tdAllowances.months.length} {tdAllowances.months.length === 1 ? 'month' : 'months'} paid,{' '}
                    {formatMonth(tdAllowances.from)} – {formatMonth(tdAllowances.to)}
                  </span>
                </div>
                {tdAllowances.months.length > 0 && (
                  <dl className="flex flex-col gap-1">
                    {tdAllowances.months.slice(0, 3).map((m) => (
                      <div key={m.month} className="flex items-center justify-between gap-3 rounded-lg bg-elevated px-3 py-2 text-sm">
                        <dt className="text-muted-foreground">{formatMonth(m.month)}</dt>
                        <dd className="font-semibold">{euro(m.amountCents)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {tdAllowances.unpublishedMonths.length > 0 && (
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    Not published by the Oireachtas yet: {tdAllowances.unpublishedMonths.map(formatMonth).join(', ')}.
                  </p>
                )}
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Parliamentary Standard Allowance: travel and accommodation, and public representation. Published monthly by
                  the Oireachtas.
                </p>
              </>
            )}
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

/** A side card's load failure: one line and a retry, as the Dáil record card does it. */
function SideCardError({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>{message}</span>
      <RetryButton variant="outline" size="sm" className="h-11 md:h-9" onRetry={onRetry} pending={retrying} />
    </div>
  );
}

function CommitteeList({
  committees,
  loading,
  error,
  onRetry,
  retrying,
}: {
  committees: TdCommittee[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
        <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Committees
      </h2>
      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <SideCardError message="Could not load committees." onRetry={onRetry} retrying={retrying} />
      ) : committees.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-muted-foreground">Not a member of any committee.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {committees.map((committee) => (
            // A TD can hold two memberships of one committee, so the start date is part of the key.
            <li key={`${committee.committeeId}-${committee.start}`} className="flex flex-col gap-1 rounded-xl bg-elevated p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-bold leading-snug">{committee.name}</span>
                {committee.role === 'Cathaoirleach' && <Badge>Chair</Badge>}
                {committee.role === 'Leas-Chathaoirleach' && <Badge variant="outline">Vice-chair</Badge>}
              </div>
              <span className="flex flex-wrap justify-between gap-x-3 text-[13px] text-muted-foreground">
                <span>
                  {formatIsoDate(committee.start)} – {committee.end ? formatIsoDate(committee.end) : 'present'}
                </span>
                <span>
                  {committee.sittingsAttended} of {committee.sittingsEligible} sittings
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
