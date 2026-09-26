/**
 * My Politics Page
 * Personalized TD rankings based on user's quiz + policy votes
 */

import { useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Compass, Loader2, Lock, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/pulse/EmptyState';
import { PartyDot, TDAvatar } from '@/components/pulse/Party';
import { PageHeader } from '@/components/PageHeader';
import IdeologyTimeSeriesChartEnhanced from '@/components/IdeologyTimeSeriesChartEnhanced';
import { PersonalRankingsTab } from '@/components/PersonalRankingsTab';
import { MatchConfidence, MatchListNote, rowBadges } from '@/components/MatchConfidence';
import { fetchMyIdeology, fetchMyMatches } from '@/lib/ideologyApi';
import { evidenceSummary } from '@/lib/ideologyConfidence';
import { describePosition } from '@/lib/ideologyDisplay';
import { partyStyle } from '@/lib/parties';
import { queryKeys } from '@/lib/queryKeys';
import { DIMENSION_POLES, IDEOLOGY_DIMENSIONS, IDEOLOGY_LIMIT } from '@shared/ideology';
import type { IdeologyDimension, IdeologyVector } from '@shared/ideology';

type Tab = 'overview' | 'rankings' | 'network';

const dominantDimension = (vector: IdeologyVector): IdeologyDimension =>
  IDEOLOGY_DIMENSIONS.reduce((a, b) => (Math.abs(vector[b]) > Math.abs(vector[a]) ? b : a));

const toPercent = (v: number) => Math.max(0, Math.min(100, ((v + IDEOLOGY_LIMIT) / (2 * IDEOLOGY_LIMIT)) * 100));
const formatValue = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`;

const cardClass = 'flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5';

export default function MyPoliticsPage() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const signedIn = isAuthenticated && !!user;

  const vectorQuery = useQuery({
    queryKey: queryKeys.ideology.mine(user?.id),
    queryFn: fetchMyIdeology,
    enabled: signedIn,
  });

  const matchesQuery = useQuery({
    queryKey: queryKeys.ideology.myMatches(user?.id, null),
    queryFn: () => fetchMyMatches(),
    enabled: signedIn,
  });

  const vector = vectorQuery.data?.vector ?? null;
  const dimensionConfidence = vectorQuery.data?.confidence;
  const rankings = matchesQuery.data?.tds ?? [];
  const partyMatches = matchesQuery.data?.parties ?? [];
  const hasProfile = vector !== null && matchesQuery.data?.hasProfile !== false;
  const isLoading = vectorQuery.isLoading || matchesQuery.isLoading;
  const loadError = vectorQuery.error ?? matchesQuery.error;
  const isRetrying = vectorQuery.isFetching || matchesQuery.isFetching;

  if (!isAuthenticated) {
    return (
      <LockedState
        title="Find TDs who match your views"
        body="Sign in, then take the quiz. We rank every TD and party by how closely they match you."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/register">Create account</Link>
            </Button>
          </div>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-2" aria-busy="true" aria-label="Loading your political profile">
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-11 w-full max-w-md rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="py-2">
        <EmptyState
          title="We could not load your profile"
          action={
            <Button
              variant="outline"
              disabled={isRetrying}
              onClick={() => {
                void vectorQuery.refetch();
                void matchesQuery.refetch();
              }}
            >
              {isRetrying && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isRetrying ? 'Loading…' : 'Try again'}
            </Button>
          }
        >
          Check your connection and try again.
        </EmptyState>
      </div>
    );
  }

  if (!hasProfile || !vector) {
    return (
      <LockedState
        title="Unlock your TD matches"
        body="Take the 8-dimension quiz. It places you on the ideology map and ranks the TDs and parties closest to you."
        action={
          <Button asChild size="lg">
            <Link href="/quiz">
              Take the quiz
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        }
      />
    );
  }

  const dominant = dominantDimension(vector);
  const topMatches = rankings.slice(0, 5);
  const topBadges = rowBadges(topMatches);
  const partyBadges = rowBadges(partyMatches);

  return (
    <div className="flex flex-col gap-5 py-2">
      <PageHeader
        title="My politics"
        description="Your views, the TDs closest to them, and how they change."
        tooltipTitle="What this page does for you"
        bullets={[
          'Shows the TDs closest to your views (quiz + daily votes).',
          'Shows where you agree and differ with each TD and party.',
          'Tracks how your position changes over time.',
        ]}
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)} className="flex flex-col gap-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rankings">My rankings</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <section className="flex flex-col gap-4 rounded-2xl bg-hero p-5 text-hero-foreground">
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-hero-soft">Your strongest view</span>
                <h2 className="font-display text-[28px] font-extrabold leading-tight tracking-tight">
                  {vector[dominant] === 0 ? 'Balanced across the board' : describePosition(dominant, vector[dominant])}
                </h2>
                <span className="text-sm text-hero-soft">on {DIMENSION_POLES[dominant].label}</span>
              </div>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
                {IDEOLOGY_DIMENSIONS.map((dim) => {
                  const poles = DIMENSION_POLES[dim];
                  const notMeasured = dimensionConfidence?.[dim].level === 'none';
                  return (
                    <li key={dim} className="flex flex-col gap-1">
                      <span className="flex items-baseline justify-between text-[13px] font-semibold">
                        {poles.label}
                        {notMeasured ? (
                          <span data-testid="dimension-not-measured" data-dimension={dim} className="text-[12px] font-normal text-hero-soft">
                            Not measured yet
                          </span>
                        ) : (
                          <span className="font-display tabular-nums">{formatValue(vector[dim])}</span>
                        )}
                      </span>
                      {notMeasured ? (
                        <span className="block h-1.5 rounded-full border border-dashed border-hero-soft" aria-hidden="true" />
                      ) : (
                        <span className="relative block h-1.5 rounded-full bg-hero-muted" aria-hidden="true">
                          <span className="absolute -top-0.5 left-1/2 h-2.5 w-px bg-hero-soft" />
                          <span
                            className="absolute -top-[3px] h-3 w-3 -translate-x-1/2 rounded-full bg-primary"
                            style={{ left: `${toPercent(vector[dim])}%` }}
                          />
                        </span>
                      )}
                      <span className="flex justify-between text-[11px] text-hero-soft">
                        <span>{poles.negative}</span>
                        <span>{poles.positive}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Button asChild variant="inverse" className="mt-auto">
                <Link href="/quiz/results">See full results</Link>
              </Button>
            </section>

            <section className={cardClass}>
              <h2 className="font-display text-[22px] font-bold">Top matches</h2>
              <MatchListNote kind="td" items={topMatches} measured={matchesQuery.data?.measured} />
              {rankings.length === 0 ? (
                <EmptyState icon={Users} title="No TD matches yet">
                  We have no TD positions to compare with yet.
                </EmptyState>
              ) : (
                <ol className="flex flex-col gap-1">
                  {topMatches.map((match) => (
                    <li key={match.tdId}>
                      <Link
                        href={`/td/${encodeURIComponent(match.name)}`}
                        className="flex min-h-[60px] items-center gap-3 rounded-lg px-1 py-2 transition-[background-color,transform] duration-150 hover:bg-accent active:scale-[0.98]"
                      >
                        <TDAvatar name={match.name} party={match.party} imageUrl={match.imageUrl} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-[15px] font-bold">{match.name}</span>
                            {topBadges && <MatchConfidence kind="td" confidence={match.confidence} />}
                          </span>
                          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                            <PartyDot party={match.party} />
                            <span className="truncate">
                              {[partyStyle(match.party).name, evidenceSummary(match.evidenceBySource)].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                        </span>
                        <span className="font-display text-[22px] font-bold tabular-nums text-primary">
                          {Math.round(match.alignment)}%
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
              <Button variant="outline" className="mt-auto w-full" onClick={() => setActiveTab('rankings')}>
                See all rankings
                <ArrowRight aria-hidden="true" />
              </Button>
            </section>
          </div>

          {user && <IdeologyTimeSeriesChartEnhanced userId={user.id} />}
        </TabsContent>

        <TabsContent value="rankings" className="mt-0">
          <PersonalRankingsTab />
        </TabsContent>

        <TabsContent value="network" className="mt-0">
          <section className={cardClass}>
            <div className="flex flex-col gap-0.5">
              <h2 className="font-display text-[22px] font-bold">Party alignment</h2>
              <p className="text-[13px] text-muted-foreground">How close each party&apos;s TDs sit to your views, on average.</p>
            </div>
            <MatchListNote kind="party" items={partyMatches} measured={matchesQuery.data?.measured} />
            {partyMatches.length === 0 ? (
              <EmptyState icon={Users} title="No party matches yet">
                We have no party positions to compare with yet.
              </EmptyState>
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">
                {partyMatches.map((match) => {
                  const pct = Math.round(match.alignment);
                  const style = partyStyle(match.party);
                  return (
                    <li key={match.party}>
                      <Link
                        href={`/party/${encodeURIComponent(match.party)}`}
                        className="flex flex-col gap-2.5 rounded-xl bg-elevated p-3.5 transition-[background-color,transform] duration-150 hover:bg-accent active:scale-[0.98]"
                      >
                        <span className="flex items-center gap-3">
                          <TDAvatar name={style.name} party={match.party} />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-base font-bold">{style.name}</span>
                              {partyBadges && <MatchConfidence kind="party" confidence={match.confidence} />}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              From {match.tdCount} TD{match.tdCount === 1 ? '' : 's'}
                            </span>
                          </span>
                          <span className="font-display text-[26px] font-extrabold tabular-nums">{pct}%</span>
                        </span>
                        <span className="block h-2 overflow-hidden rounded-full bg-input" aria-hidden="true">
                          <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: style.dot }} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LockedState({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 py-2">
      <section className="flex flex-col items-start gap-4 rounded-2xl bg-hero p-6 text-hero-foreground sm:p-10">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-hero-muted">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="text-[13px] font-semibold text-hero-soft">My politics</span>
        <h1 className="max-w-xl font-display text-[34px] font-extrabold leading-[1.05] tracking-tight sm:text-5xl">{title}</h1>
        <p className="max-w-xl text-base leading-relaxed text-hero-soft">{body}</p>
        {action}
      </section>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Compass, title: 'Your position', text: 'See where you sit on 8 dimensions, from economy to environment.' },
          { icon: Users, title: 'Your TD matches', text: 'Every TD ranked by how closely their record matches your views.' },
          { icon: ArrowRight, title: 'How you change', text: 'Daily votes update your profile. Track how it moves over time.' },
        ].map(({ icon: Icon, title: t, text }) => (
          <div key={t} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-[15px] font-bold">{t}</h2>
            <p className="text-[13px] text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
