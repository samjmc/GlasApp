/**
 * My Politics Page
 * Personalized TD rankings based on user's quiz + policy votes
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sparkles,
  Target,
  Users,
  Building2,
  ArrowRight,
  Lock,
  CheckCircle2,
  AlertCircle,
  Info
} from 'lucide-react';
import { Link } from 'wouter';
import IdeologyTimeSeriesChartEnhanced from '@/components/IdeologyTimeSeriesChartEnhanced';
import { PageHeader } from "@/components/PageHeader";
import { fetchMyIdeology, fetchMyMatches } from '@/lib/ideologyApi';
import { queryKeys } from '@/lib/queryKeys';
import { DIMENSION_POLES, IDEOLOGY_DIMENSIONS, IDEOLOGY_LIMIT } from '@shared/ideology';
import type { IdeologyDimension, IdeologyVector } from '@shared/ideology';

const describeDominantAxis = (vector: IdeologyVector): string => {
  let dominant: IdeologyDimension = IDEOLOGY_DIMENSIONS[0];
  for (const dim of IDEOLOGY_DIMENSIONS) {
    if (Math.abs(vector[dim]) > Math.abs(vector[dominant])) dominant = dim;
  }
  const value = vector[dominant];
  if (value === 0) return 'Balanced stance';
  const poles = DIMENSION_POLES[dominant];
  return `${poles.label}: leans ${value > 0 ? poles.positive : poles.negative}`;
};

const dimensionLabels = (dims: IdeologyDimension[]): string =>
  dims.map((d) => DIMENSION_POLES[d].label).join(', ');

export default function MyPoliticsPage() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [visibleRankingsCount, setVisibleRankingsCount] = useState(5);
  const [activeTab, setActiveTab] = useState<'overview' | 'rankings'>('overview');

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

  const vector = vectorQuery.data ?? null;
  const rankings = matchesQuery.data?.tds ?? [];
  const partyMatches = matchesQuery.data?.parties ?? [];
  const hasProfile = vector !== null && matchesQuery.data?.hasProfile !== false;
  const isLoading = vectorQuery.isLoading || matchesQuery.isLoading;
  const loadError = vectorQuery.error ?? matchesQuery.error;

  const shellClass = "mobile-shell mobile-stack";
  const defaultCardClass = "mobile-card";

  // ---------------- RENDERING ----------------

  if (!isAuthenticated) {
    return (
      <div className={shellClass}>
        <Card className={`${defaultCardClass} text-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-200`}>
          <Lock className="w-16 h-16 mx-auto mb-4 text-purple-600" />
          <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
            Find TDs Who Match Your Values
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
            Take a quick quiz to discover which TDs align with your political beliefs
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login">
              <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 w-full sm:w-auto">
                Sign In to Get Started
              </Button>
            </Link>
            <Link href="/register">
              <Button size="lg" variant="outline" className="border-purple-300 w-full sm:w-auto">
                Create Account
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            <Link href="/" className="hover:text-purple-600">← Continue browsing as guest</Link>
          </p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading your political profile...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={shellClass}>
        <Card className={`${defaultCardClass} text-center`}>
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            We couldn't load your political profile right now.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              vectorQuery.refetch();
              matchesQuery.refetch();
            }}
          >
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  if (!hasProfile) {
    return (
      <div className={shellClass}>
        <Card className={`${defaultCardClass} bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-200`}>
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Unlock Your Personal TD Rankings
            </h1>
            <p className="text-lg text-gray-700 dark:text-gray-300">
              Complete the 8-dimension quiz to place yourself on the ideology map and see the TDs closest to your position.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
              <Button
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg"
                onClick={() => navigate('/quiz')}
              >
                Take the Quiz
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="mb-6">
        <PageHeader
          className="mb-2"
          title="My politics"
          tooltipTitle="What this page does for you"
          bullets={[
            "Shows the TDs closest to your views (quiz + daily votes).",
            "Shows where you agree and differ with each TD and party.",
            "Tracks how your position changes over time."
          ]}
        />

        <nav
          className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-200 bg-white/80 p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900/60"
          aria-label="Tabs"
        >
          {(['overview', 'rankings'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const labels = {
              overview: 'Overview',
              rankings: 'My Rankings'
            };

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={[
                  "h-11 w-full rounded-xl px-2 text-xs font-semibold tracking-wide transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
                  isActive
                    ? "bg-purple-600 text-white shadow"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="block truncate">{labels[tab]}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
          {/* Ideology Snapshot */}
          {vector && (
            <Card className={`${defaultCardClass} bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-200`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  Your Ideology
                </h2>
              </div>

              <div className="mb-4">
                <div className="text-2xl font-bold mb-1 text-purple-700 dark:text-purple-300">
                  {describeDominantAxis(vector)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                {IDEOLOGY_DIMENSIONS.map((dim) => {
                  const poles = DIMENSION_POLES[dim];
                  const normalized = Math.max(0, Math.min(100, ((vector[dim] + IDEOLOGY_LIMIT) / (2 * IDEOLOGY_LIMIT)) * 100));
                  return (
                    <div key={dim} className="text-xs">
                      <div className="mb-1 font-medium text-gray-700 dark:text-gray-300">
                        {poles.label}
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500"
                          style={{ width: `${normalized}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                        <span>{poles.negative}</span>
                        <span>{poles.positive}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4 border-purple-200 hover:bg-purple-100 text-purple-700 dark:border-purple-800 dark:hover:bg-purple-900/30 dark:text-purple-300"
                onClick={() => setActiveTab('rankings')}
              >
                View Full Analysis
              </Button>
            </Card>
          )}

          {/* Top Matches Snapshot */}
          <Card className={defaultCardClass}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Top Matches
            </h2>

            <div className="space-y-3">
              {rankings.slice(0, 3).map((match) => (
                <Link key={match.tdId} href={`/td/${encodeURIComponent(match.name)}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer border border-gray-200 dark:border-gray-700">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white truncate">
                        {match.name}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {match.party}
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">
                        {Math.round(match.alignment)}%
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-gray-500"
              onClick={() => setActiveTab('rankings')}
            >
              See all rankings <ArrowRight className="ml-1 w-4 h-4" />
            </Button>
          </Card>
        </div>
      )}

      {activeTab === 'rankings' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Ideology Time Series Chart */}
          {user && (
            <IdeologyTimeSeriesChartEnhanced userId={user.id} />
          )}

          {/* Full Personal Rankings */}
          <Card className={defaultCardClass}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                  <Users className="w-6 h-6 text-purple-600" />
                  Complete Rankings
                </h2>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full">
                      <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs p-4 bg-slate-900 border-slate-800 text-white">
                    <div className="flex flex-col gap-2">
                      <p className="font-semibold text-emerald-400">Improve Your Match Accuracy</p>
                      <p className="text-xs text-gray-300">
                        Your rankings are currently based on the quiz. Vote on policy articles in the news feed to refine your matches!
                      </p>
                      <p className="text-xs text-gray-400 flex items-center gap-1.5 bg-white/10 p-2 rounded-lg mt-1">
                        <Sparkles className="w-3 h-3 text-yellow-400" />
                        Each vote updates your compatibility with all TDs who took a stance.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Badge variant="outline" className="text-xs">
                {rankings.length} TDs
              </Badge>
            </div>

            {rankings.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No rankings yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rankings.slice(0, visibleRankingsCount).map((ranking, index) => (
                  <Link key={ranking.tdId} href={`/td/${encodeURIComponent(ranking.name)}`}>
                    <div className="p-4 border rounded-xl bg-white dark:bg-gray-800/50 hover:border-purple-500/30 transition-colors cursor-pointer dark:border-gray-700">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold text-sm">
                            #{index + 1}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white leading-tight">
                              {ranking.name}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {ranking.party} • {ranking.constituency}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 leading-none">
                            {Math.round(ranking.alignment)}%
                          </div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-1">Match</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-0.5">Closest on</div>
                          <div className="text-xs font-medium text-gray-900 dark:text-gray-200">
                            {ranking.closest.length > 0 ? dimensionLabels(ranking.closest) : '—'}
                          </div>
                        </div>
                        <div className="text-center border-l border-gray-100 dark:border-gray-700/50">
                          <div className="text-xs text-gray-500 mb-0.5">Furthest on</div>
                          <div className="text-xs font-medium text-gray-900 dark:text-gray-200">
                            {ranking.furthest.length > 0 ? dimensionLabels(ranking.furthest) : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}

                {visibleRankingsCount < rankings.length && (
                  <Button
                    variant="ghost"
                    className="w-full mt-4"
                    onClick={() => setVisibleRankingsCount((prev) => prev + 10)}
                  >
                    Load more
                  </Button>
                )}
              </div>
            )}
          </Card>

          {/* Party Alignment */}
          <Card className={defaultCardClass}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Party Alignment
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {partyMatches.map((match) => (
                <div
                  key={match.party}
                  className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">{match.party}</div>
                      <div className="text-xs text-gray-500">
                        Based on {match.tdCount} TD{match.tdCount === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {Math.round(match.alignment)}%
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600"
                      style={{ width: `${match.alignment}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
