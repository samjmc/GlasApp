/**
 * Party Profile Page
 * Comprehensive party profile with performance scores and 8-dimensional ideology
 */

import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorDisplay, NotFoundError } from '@/components/ErrorDisplay';
import {
  Users,
  BarChart3,
  Crown,
  ChevronLeft,
  Share2,
  MapPin,
  Scale,
  TrendingUp
} from 'lucide-react';
import { PartyPollingWidget } from '@/components/PartyPollingWidget';
import { politicalParties } from '@shared/data';
import { partyDimensionsData } from '@/data/partyDimensionsData';

interface PartyRanking {
  rank: number;
  party: string;
  memberCount: number;
  avgElo: number;
  overallScore: number;
  label: string;
  computedAt: string | null;
}

interface PartyMember {
  id: number;
  name: string;
  constituency: string | null;
  overallScore: number | null;
  newsScore: number | null;
  parliamentaryScore: number | null;
  debateScore: number | null;
}

interface PartyDetail {
  party: string;
  size: number;
  averageScore: number | null;
  genderBreakdown: { male: number; female: number; unknown: number; femalePercentage: number };
  constituencyCount: number;
  members: PartyMember[];
}

type PartyProfile = PartyDetail & { ranking: PartyRanking | null };

function average(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return Math.round(present.reduce((a, b) => a + b, 0) / present.length);
}

export default function PartyProfilePage() {
  const { name } = useParams<{ name: string }>();

  const { data: party, isLoading, error } = useQuery<PartyProfile>({
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
      const rankings: PartyRanking[] = rankingsRes.ok ? ((await rankingsRes.json()).data ?? []) : [];
      const ranking = rankings.find((p) => p.party.toLowerCase() === detail.party.toLowerCase()) ?? null;
      return { ...detail, ranking };
    },
    enabled: !!name,
    retry: (failureCount, error) => {
      // Don't retry if party not found
      if (error instanceof Error && error.message === 'PARTY_NOT_FOUND') return false;
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">Loading party profile...</p>
        </div>
      </div>
    );
  }

  // Error handling
  if (error) {
    const isNotFound = error instanceof Error && error.message === 'PARTY_NOT_FOUND';
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        {isNotFound ? (
          <NotFoundError resourceName="Party" />
        ) : (
          <ErrorDisplay
            title="Failed to load party profile"
            message={error instanceof Error ? error.message : 'Unable to fetch party data'}
            error={error}
            onRetry={() => window.location.reload()}
            type="error"
          />
        )}
        <div className="mt-6 text-center">
          <Link href="/">
            <Button variant="outline">Return to Homepage</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!party) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <NotFoundError resourceName="Party" />
        <div className="mt-6 text-center">
          <Link href="/">
            <Button variant="outline">Return to Homepage</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getScoreRating = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-300' };
    if (score >= 70) return { label: 'Very Good', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-300' };
    if (score >= 60) return { label: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-300' };
    if (score >= 50) return { label: 'Average', color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300' };
    return { label: 'Below Average', color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-300' };
  };

  // Brand colour and ideology come from the static party data; the scores API has neither.
  const staticParty = politicalParties.find(
    (p) => p.country === 'ireland' && p.name.toLowerCase() === party.party.toLowerCase()
  );
  const partyColor = staticParty?.color ?? '#6b7280';
  const ideology = staticParty ? partyDimensionsData[staticParty.id] : undefined;

  const overallScore = party.ranking?.overallScore ?? party.averageScore;
  const rating = overallScore !== null ? getScoreRating(overallScore) : null;
  const componentAverages = {
    news: average(party.members.map((m) => m.newsScore)),
    parliamentary: average(party.members.map((m) => m.parliamentaryScore)),
    debate: average(party.members.map((m) => m.debateScore)),
  };

  // Helper to get dimension label and color
  const getDimensionLabel = (dimension: string, value: number) => {
    const absValue = Math.abs(value);
    const intensity = absValue >= 8 ? 'Very' : absValue >= 5 ? 'Moderately' : 'Slightly';

    const labels: Record<string, { left: string; right: string }> = {
      economic: { left: 'Left', right: 'Right' },
      social: { left: 'Progressive', right: 'Conservative' },
      cultural: { left: 'Multicultural', right: 'Traditional' },
      globalism: { left: 'Nationalist', right: 'Internationalist' },
      environmental: { left: 'Industrial', right: 'Ecological' },
      authority: { left: 'Libertarian', right: 'Authoritarian' },
      welfare: { left: 'Individual', right: 'Communitarian' },
      technocratic: { left: 'Populist', right: 'Technocratic' }
    };

    const side = value >= 0 ? labels[dimension].right : labels[dimension].left;
    return absValue >= 2 ? `${intensity} ${side}` : 'Centrist';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Back Button */}
      <Link href="/">
        <Button variant="ghost" className="mb-4 gap-2">
          <ChevronLeft className="w-4 h-4" />
          Back to Home
        </Button>
      </Link>

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl mb-6 border-2" style={{ borderColor: partyColor }}>
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900 to-gray-800 opacity-95"></div>
        <div className="relative z-10 p-8 md:p-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start gap-6">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
                style={{ backgroundColor: partyColor }}
              >
                {party.party.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                  {party.party}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-gray-300">
                  {party.ranking && (
                    <Badge variant="outline" className="bg-white/10 text-white border-white/30">
                      {party.ranking.label}
                    </Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{party.size} Active TDs</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Overall Score */}
            <div className="text-center md:text-right">
              <div className="text-6xl font-bold text-white mb-2">
                {overallScore !== null ? (
                  <>
                    {overallScore}<span className="text-3xl text-gray-400">/100</span>
                  </>
                ) : (
                  'N/A'
                )}
              </div>
              {rating && (
                <Badge className={`${rating.bgColor} ${rating.color} border-2 ${rating.borderColor} text-sm px-4 py-1`}>
                  {rating.label}
                </Badge>
              )}
              <p className="text-sm text-gray-300 mt-2">Performance Score</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-2 bg-white/10 text-white border-white/30 hover:bg-white/20"
              >
                <Share2 className="w-3 h-3" />
                Share Profile
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Rankings & Stats */}
        <div className="space-y-6">
          {/* Rankings */}
          <Card className="p-6">
            <h2 className="font-bold text-xl mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-600" />
              Rankings
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-gray-600 dark:text-gray-400">National Rank</span>
                <span className="font-bold text-lg">{party.ranking ? `#${party.ranking.rank}` : '—'}</span>
              </div>
            </div>
          </Card>

          {/* Key Stats */}
          <Card className="p-6">
            <h2 className="font-bold text-xl mb-4">Key Statistics</h2>
            <div className="space-y-3">
              <StatRow
                icon={<Users className="w-4 h-4" />}
                label="Active TDs"
                value={party.size}
              />
              <StatRow
                icon={<MapPin className="w-4 h-4" />}
                label="Constituencies"
                value={party.constituencyCount}
              />
              <StatRow
                icon={<TrendingUp className="w-4 h-4" />}
                label="Avg TD Score"
                value={party.averageScore ?? 'N/A'}
              />
              <StatRow
                icon={<Users className="w-4 h-4" />}
                label="Female TDs"
                value={`${party.genderBreakdown.female} (${party.genderBreakdown.femalePercentage}%)`}
              />
            </div>
          </Card>

          {/* Party TDs List */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Active TDs ({party.size})
            </h2>
            <PartyTDsList members={party.members} />
          </Card>
        </div>

        {/* Middle Column - Performance Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Performance Breakdown */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              Performance Breakdown
            </h2>

            <div className="space-y-4">
              <PerformanceBar
                label="News Impact"
                score={componentAverages.news}
                color="emerald"
                description={`Average news-based score across ${party.size} TDs`}
              />
              <PerformanceBar
                label="Parliamentary Activity"
                score={componentAverages.parliamentary}
                color="blue"
                description={`Average parliamentary score across ${party.size} TDs`}
              />
              <PerformanceBar
                label="Debate Performance"
                score={componentAverages.debate}
                color="purple"
                description={`Average debate score across ${party.size} TDs`}
              />
            </div>
          </Card>

          {/* 8 Dimensional Political Compass */}
          <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-2 border-indigo-200">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Scale className="w-6 h-6 text-indigo-600" />
              8-Dimensional Political Compass
            </h2>

            {ideology ? (
              <div className="space-y-4">
                <DimensionBar
                  label="Economic"
                  value={ideology.economic}
                  leftLabel="Left-wing"
                  rightLabel="Right-wing"
                  description={getDimensionLabel('economic', ideology.economic)}
                />
                <DimensionBar
                  label="Social"
                  value={ideology.social}
                  leftLabel="Progressive"
                  rightLabel="Conservative"
                  description={getDimensionLabel('social', ideology.social)}
                />
                <DimensionBar
                  label="Cultural"
                  value={ideology.cultural}
                  leftLabel="Progressive"
                  rightLabel="Traditional"
                  description={getDimensionLabel('cultural', ideology.cultural)}
                />
                <DimensionBar
                  label="Globalism"
                  value={ideology.globalism}
                  leftLabel="Nationalist"
                  rightLabel="Globalist"
                  description={getDimensionLabel('globalism', ideology.globalism)}
                />
                <DimensionBar
                  label="Environmental"
                  value={ideology.environmental}
                  leftLabel="Industry"
                  rightLabel="Green"
                  description={getDimensionLabel('environmental', ideology.environmental)}
                />
                <DimensionBar
                  label="Authority"
                  value={ideology.authority}
                  leftLabel="Libertarian"
                  rightLabel="Authoritarian"
                  description={getDimensionLabel('authority', ideology.authority)}
                />
                <DimensionBar
                  label="Welfare"
                  value={ideology.welfare}
                  leftLabel="Free Market"
                  rightLabel="Welfare State"
                  description={getDimensionLabel('welfare', ideology.welfare)}
                />
                <DimensionBar
                  label="Technocratic"
                  value={ideology.technocratic}
                  leftLabel="Populist"
                  rightLabel="Expert-led"
                  description={getDimensionLabel('technocratic', ideology.technocratic)}
                />
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No ideology profile is available for this party yet.
              </p>
            )}

            <div className="mt-6 pt-4 border-t border-indigo-200 dark:border-indigo-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                💡 These scores represent the party's ideological position on each dimension.
                Scores range from -10 (strongly left/progressive) to +10 (strongly right/conservative).
              </p>
            </div>
          </Card>

          {/* Public Opinion Polling Widget */}
          <PartyPollingWidget
            partyName={party.party}
            performanceScore={overallScore ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}

// Performance Bar Component
function PerformanceBar({ label, score, color, description }: {
  label: string;
  score: number | null;
  color: string;
  description: string;
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    cyan: 'bg-cyan-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500'
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-700 dark:text-gray-300">{label}</span>
        <span className="font-bold text-lg">
          {score !== null ? (
            <>{score}<span className="text-sm text-gray-400">/100</span></>
          ) : (
            'N/A'
          )}
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors[color]} transition-all duration-500`}
          style={{ width: `${score ?? 0}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
    </div>
  );
}

// Dimension Bar Component (for -10 to +10 scale)
function DimensionBar({ label, value, leftLabel, rightLabel, description }: {
  label: string;
  value: number;
  leftLabel: string;
  rightLabel: string;
  description: string;
}) {
  // Convert -10 to +10 into 0-100% position
  const position = ((value + 10) / 20) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-700 dark:text-gray-300">{label}</span>
        <Badge variant="outline" className="text-xs">
          {description}
        </Badge>
      </div>

      {/* The bar */}
      <div className="relative w-full h-8 bg-gradient-to-r from-red-200 via-gray-200 to-blue-200 dark:from-red-900/40 dark:via-gray-700 dark:to-blue-900/40 rounded-full overflow-hidden border border-gray-300 dark:border-gray-600">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-400 dark:bg-gray-500 z-10"></div>

        {/* Position indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-indigo-600 border-2 border-white shadow-lg z-20 transition-all duration-500"
          style={{ left: `calc(${position}% - 8px)` }}
        />

        {/* Value display */}
        <div
          className="absolute top-1/2 -translate-y-1/2 px-2 py-1 bg-indigo-600 text-white text-xs font-bold rounded shadow-lg z-30 transition-all duration-500"
          style={{
            left: `calc(${position}% - ${value.toString().length * 3.5}px)`,
            transform: 'translateY(calc(-50% - 28px))'
          }}
        >
          {value > 0 ? `+${value}` : value}
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
        <span>← {leftLabel}</span>
        <span>{rightLabel} →</span>
      </div>
    </div>
  );
}

// Stat Row Component
function StatRow({ icon, label, value }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

// Party TDs List Component
function PartyTDsList({ members }: { members: PartyMember[] }) {
  if (members.length === 0) {
    return <div className="text-center py-4 text-gray-500 text-sm">No active TDs found</div>;
  }

  // The party endpoint returns members best-first already; keep that order.
  return (
    <div className="space-y-2">
      {members.map((td) => (
        <Link key={td.id} href={`/td/${encodeURIComponent(td.name)}`}>
          <div className="group p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {td.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {td.constituency}
                </div>
              </div>
              <div className="text-right ml-2">
                <div className="text-lg font-bold text-blue-600">
                  {td.overallScore ?? 'N/A'}
                </div>
                <div className="text-[10px] text-gray-400">/100</div>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
