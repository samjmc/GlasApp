/**
 * Enhanced TD Profile Page
 * Comprehensive TD profile with modern design, polling data, and rich analytics
 */

import { useState, type ReactNode } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorDisplay, NotFoundError } from '@/components/ErrorDisplay';
import { PageHeader } from "@/components/PageHeader";
import { queryKeys } from '@/lib/queryKeys';
import type { TdParliamentSummary, TdVote, TdDebateContribution, DivisionVote } from '@shared/parliamentApi';
import {
  TrendingUp,
  TrendingDown,
  Award,
  Users,
  FileText,
  BarChart3,
  Crown,
  Briefcase,
  Calendar,
  ExternalLink,
  MapPin,
  MessageSquare,
  Vote,
  LineChart as LineChartIcon,
  ChevronLeft,
  Share2,
  Building2,
  Newspaper
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

type PillarColor = 'emerald' | 'blue' | 'cyan' | 'indigo' | 'purple' | 'orange' | 'green';

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

const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  transparency: 'Transparency',
  effectiveness: 'Effectiveness',
  integrity: 'Integrity',
  consistency: 'Consistency',
};

interface NewsArticle {
  url?: string;
  title?: string;
  ai_summary?: string | null;
  source?: string;
  published_date?: string;
  sentiment?: string;
}

type ApiEnvelope<T> = { success: true; data: T; meta?: { total: number } };

async function getParliament<T>(path: string): Promise<ApiEnvelope<T>> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return res.json();
}

const VOTE_LABEL: Record<DivisionVote, string> = { ta: 'Tá', nil: 'Níl', staon: 'Staon' };

export default function TDProfilePageEnhanced() {
  const { name } = useParams<{ name: string }>();

  const { data: scoreData, isLoading, error } = useQuery<TDProfile>({
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
    error: parliamentSummaryError
  } = useQuery({
    queryKey: queryKeys.parliament.tdSummary(tdId ?? 0),
    queryFn: () => getParliament<TdParliamentSummary>(`/api/parliament/tds/${tdId}`),
    enabled: !!tdId,
    staleTime: 5 * 60 * 1000
  });
  const parliamentSummary = parliamentSummaryResp?.data;

  const { data: tdVotesResp, isLoading: tdVotesLoading } = useQuery({
    queryKey: queryKeys.parliament.tdVotes(tdId ?? 0, 20, votesAgainstPartyOnly),
    queryFn: () =>
      getParliament<TdVote[]>(
        `/api/parliament/tds/${tdId}/votes?limit=20${votesAgainstPartyOnly ? '&againstParty=true' : ''}`
      ),
    enabled: !!tdId,
    staleTime: 5 * 60 * 1000
  });
  const tdVotes = tdVotesResp?.data ?? [];

  const { data: tdDebatesResp, isLoading: tdDebatesLoading } = useQuery({
    queryKey: queryKeys.parliament.tdDebates(tdId ?? 0, 10),
    queryFn: () => getParliament<TdDebateContribution[]>(`/api/parliament/tds/${tdId}/debates?limit=10`),
    enabled: !!tdId,
    staleTime: 5 * 60 * 1000
  });
  const tdDebateContributions = tdDebatesResp?.data ?? [];

  // Fetch recent news articles for this TD
  const { data: newsArticles } = useQuery({
    queryKey: ['td-news-v2', name],  // v2 to bust cache after adding sourceLogoUrl
    queryFn: async () => {
      const res = await fetch(`/api/news-feed/td/${encodeURIComponent(name || '')}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.articles || [];
    },
    enabled: !!name,
    staleTime: 300000  // 5 minutes
  });
  
  // Fetch real polling data for the TD's party
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
  
  const score = scoreData;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">Loading TD profile...</p>
        </div>
      </div>
    );
  }
  
  // Error handling
  if (error) {
    const isNotFound = error instanceof Error && error.message === 'TD_NOT_FOUND';
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        {isNotFound ? (
          <NotFoundError resourceName="TD" />
        ) : (
          <ErrorDisplay
            title="Failed to load TD profile"
            message={error instanceof Error ? error.message : 'Unable to fetch TD data'}
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
  
  if (!score) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <NotFoundError resourceName="TD" />
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
  
  const overallScore = score.overallScore;
  const rating = overallScore !== null ? getScoreRating(overallScore) : null;

  const pillars: { label: string; color: PillarColor; score: number | null; description: string }[] = [
    {
      label: 'News Impact',
      color: 'emerald',
      score: score.newsScore,
      description: `${score.totalStories} articles analysed`
    },
    {
      label: 'Parliamentary Activity',
      color: 'blue',
      score: score.parliamentaryScore,
      description: 'Questions, attendance and committee work.'
    },
    {
      label: 'Debate Performance',
      color: 'purple',
      score: score.debateScore,
      description: 'Oireachtas debate contributions.'
    }
  ];

  const dimensionBars = (Object.keys(DIMENSION_LABELS) as ScoreDimension[]).map((key) => ({
    key,
    label: DIMENSION_LABELS[key],
    score: score.dimensions?.[key]?.score ?? null,
    elo: score.dimensions?.[key]?.elo ?? null,
  }));
  
  // Real polling data
  const pollingData = {
    partyNationalPolling: partyPolling?.latest_support ? parseFloat(partyPolling.latest_support) : null,
    partyChange30d: partyPolling?.support_30d_change ? parseFloat(partyPolling.support_30d_change) : 0,
    trend: partyPolling?.support_30d_trend || 'stable',
    lastPollDate: partyPolling?.latest_poll_date || null,
    pollSource: partyPolling?.latest_poll_source || null,
    constituencyPolling: null, // Constituency-level polling not available yet
    reelectionChance: calculateReelectionChance(overallScore, partyPolling?.latest_support ? parseFloat(partyPolling.latest_support) : null)
  };
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <PageHeader
        className="mb-3"
        title="TD profile"
        tooltipTitle="What you can do here"
        bullets={[
          "Understand a TD’s public performance and recent impact.",
          "See ideology signals, voting patterns, and debate activity.",
          "Compare stances and track changes over time."
        ]}
      />

      {/* Back Button */}
      <Link href="/">
        <Button variant="ghost" className="mb-4 gap-2">
          <ChevronLeft className="w-4 h-4" />
          Back to Home
        </Button>
      </Link>

      {/* Hero Header */}
      <Card className="p-6 md:p-8 mb-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-2 border-blue-200">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-start gap-4 mb-4">
              {/* Profile Photo */}
              {score.imageUrl ? (
                <img
                  src={score.imageUrl}
                  alt={score.name}
                  className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-white shadow-lg flex-shrink-0"
                />
              ) : (
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white text-3xl md:text-4xl font-bold border-4 border-white shadow-lg flex-shrink-0">
                  {(score.name || '?').charAt(0)}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h1 className="text-3xl md:text-5xl font-bold mb-3 text-gray-900 dark:text-white">
                  {score.name}
                </h1>
                
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    {score.party || 'Independent'}
                  </Badge>
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <MapPin className="w-4 h-4" />
                    <span className="font-medium">{score.constituency}</span>
                  </div>
                  {score.gender && (
                    <Badge variant="outline">
                      {score.gender?.toLowerCase() === 'male' ? '👨' : '👩'} {score.gender}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Offices */}
            {score.offices && score.offices.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {score.offices.map((office, idx) => (
                  <Badge key={idx} className="gap-1 bg-yellow-500 hover:bg-yellow-600 text-white border-0">
                    <Crown className="w-3 h-3" />
                    {office.title}
                  </Badge>
                ))}
              </div>
            )}

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-4 text-sm">
              {score.attendancePct !== null && (
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>{score.attendancePct}% attendance</span>
                </div>
              )}
              {(score.questions?.oral !== null || score.questions?.written !== null) && (
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <MessageSquare className="w-4 h-4" />
                  <span>{(score.questions.oral ?? 0) + (score.questions.written ?? 0)} questions asked</span>
                </div>
              )}
              {score.committees && score.committees.length > 0 && (
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Users className="w-4 h-4" />
                  <span>{score.committees.length} {score.committees.length === 1 ? 'committee' : 'committees'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Performance Score */}
          <div className="text-center md:text-right">
            <div className="text-6xl md:text-7xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              {overallScore !== null ? (
                <>
                  {overallScore}
                  <span className="text-3xl text-gray-400">/100</span>
                </>
              ) : (
                'N/A'
              )}
            </div>
            {rating ? (
              <Badge className={`${rating.bgColor} ${rating.color} border-2 ${rating.borderColor} text-base px-4 py-1 mb-2`}>
                {rating.label}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-base px-4 py-1 mb-2">
                No Score
              </Badge>
            )}
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Performance Score
            </div>

            {/* Share Button */}
            <Button variant="outline" size="sm" className="mt-3 gap-2">
              <Share2 className="w-4 h-4" />
              Share Profile
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Left Column - Rankings & Quick Stats */}
        <div className="lg:col-span-1 space-y-6">
          {/* Rankings */}
          <Card className="p-6">
            <h2 className="font-bold text-xl mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              Rankings
            </h2>
            <div className="space-y-4">
              <RankCard label="National Rank" rank={score.nationalRank} total="174" />
              <RankCard label="Constituency Rank" rank={score.constituencyRank} total={`${getConstituencyTDCount(score.constituency ?? '')}`} />
              <RankCard label="Party Rank" rank={score.partyRank} total={`${getPartyTDCount(score.party ?? 'Independent')}`} />
            </div>
          </Card>

          {/* Score Trend */}
          <Card className="p-6">
            <h2 className="font-bold text-xl mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Score Trend
            </h2>
            <div className="space-y-3">
              <StatRow
                icon={score.eloChange7d >= 0 ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                label="Last 7 days"
                value={`${score.eloChange7d >= 0 ? '+' : ''}${score.eloChange7d} Elo`}
              />
              <StatRow
                icon={score.eloChange30d >= 0 ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                label="Last 30 days"
                value={`${score.eloChange30d >= 0 ? '+' : ''}${score.eloChange30d} Elo`}
              />
              <StatRow
                icon={<BarChart3 className="w-4 h-4 text-gray-500" />}
                label="Current Elo"
                value={score.overallElo}
              />
            </div>
            {score.lastScoredAt && (
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Last scored {new Date(score.lastScoredAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </Card>

          {/* Recent News Stories */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-emerald-600" />
              Recent News Coverage
            </h2>
            
            {newsArticles && newsArticles.length > 0 ? (
              <div className="space-y-3">
                {newsArticles.slice(0, 3).map((article: NewsArticle, idx: number) => (
                  <a
                    key={idx}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-lg border border-emerald-200 hover:border-emerald-400 transition-all hover:shadow-md group"
                  >
                    <div className="flex items-start gap-2">
                      <Newspaper className="w-4 h-4 text-emerald-600 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 line-clamp-2">
                          {article.title}
                        </h3>
                        {article.ai_summary && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 leading-relaxed">
                            {article.ai_summary}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="font-medium">{article.source}</span>
                          <span>•</span>
                          <span>{new Date(article.published_date || '').toLocaleDateString('en-IE', { month: 'short', day: 'numeric' })}</span>
                          {article.sentiment && (
                            <>
                              <span>•</span>
                              <Badge 
                                variant="outline" 
                                className={`text-xs px-1 py-0 ${
                                  article.sentiment === 'positive' || article.sentiment === 'very_positive' 
                                    ? 'border-green-400 text-green-700' 
                                    : article.sentiment === 'negative' || article.sentiment === 'very_negative'
                                    ? 'border-red-400 text-red-700'
                                    : 'border-gray-400 text-gray-700'
                                }`}
                              >
                                {article.sentiment.replace('_', ' ')}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-emerald-600 flex-shrink-0 mt-1" />
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Newspaper className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No recent news articles
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Coverage will appear when available
                </p>
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                📰 AI-analyzed news from Irish sources
              </p>
            </div>
          </Card>

          {/* Polling Section */}
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200">
            <h2 className="font-bold text-xl mb-4 flex items-center gap-2">
              <LineChartIcon className="w-5 h-5 text-purple-600" />
              Polling & Outlook
            </h2>
            
            {/* Party National Polling */}
            <div className="mb-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {score.party} National Support
              </div>
              {pollingData.partyNationalPolling !== null ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-3xl font-bold text-purple-600">
                      {pollingData.partyNationalPolling.toFixed(1)}%
                    </div>
                    <Badge variant={pollingData.trend === 'rising' ? 'default' : pollingData.trend === 'falling' ? 'destructive' : 'outline'} className="gap-1">
                      {pollingData.trend === 'rising' ? <TrendingUp className="w-3 h-3" /> : 
                       pollingData.trend === 'falling' ? <TrendingDown className="w-3 h-3" /> : '→'}
                      {pollingData.trend}
                    </Badge>
                  </div>
                  {pollingData.partyChange30d !== 0 && (
                    <div className={`text-sm ${pollingData.partyChange30d > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {pollingData.partyChange30d > 0 ? '+' : ''}{pollingData.partyChange30d.toFixed(1)}% (30 days)
                    </div>
                  )}
                  {pollingData.pollSource && (
                    <div className="text-xs text-gray-500 mt-1">
                      Source: {pollingData.pollSource}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-2xl font-bold text-gray-400">
                  N/A
                </div>
              )}
            </div>

            {/* Constituency Support */}
            <div className="mb-4 pb-4 border-b border-purple-200 dark:border-purple-700">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Party Support in {score.constituency}
              </div>
              <div className="text-2xl font-bold text-gray-400">
                N/A
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Constituency-level polling not yet available
              </div>
            </div>

            {/* Re-election Outlook */}
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Re-election Outlook
              </div>
              {pollingData.reelectionChance !== null ? (
                <>
                  <div className={`text-lg font-bold ${
                    pollingData.reelectionChance >= 70 ? 'text-green-600' :
                    pollingData.reelectionChance >= 50 ? 'text-yellow-600' :
                    'text-orange-600'
                  }`}>
                    {pollingData.reelectionChance >= 70 ? '✅ Very Likely' :
                     pollingData.reelectionChance >= 50 ? '⚠️ Competitive' :
                     '⚠️ At Risk'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Based on performance {pollingData.partyNationalPolling !== null ? '& party polling' : 'score'}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-lg font-bold text-gray-400">
                    Unable to calculate
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    No polling data available
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-700">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                📊 Polling data from recent surveys. Updated monthly.
              </p>
            </div>
          </Card>
        </div>

        {/* Middle Column - Performance Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Score Breakdown */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              Performance Breakdown
            </h2>
            
            <div className="space-y-4">
              {pillars.map((pillar) => (
                <PerformanceBar
                  key={pillar.label}
                  label={pillar.label}
                  score={pillar.score}
                  color={pillar.color}
                  description={pillar.description}
                />
              ))}
            </div>

            <h3 className="text-lg font-semibold mt-8 mb-4">Dimensions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {dimensionBars.map((dimension) => (
                <div key={dimension.key} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {dimension.score ?? 'N/A'}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{dimension.label}</div>
                  {dimension.elo !== null && (
                    <div className="text-[10px] text-gray-400 mt-1">Elo {dimension.elo}</div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Parliament Summary */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Vote className="w-6 h-6 text-blue-600" />
              Parliament Record
            </h2>

            {parliamentSummaryLoading ? (
              <div className="text-center py-8 text-gray-500">Loading parliament record...</div>
            ) : parliamentSummaryError || !parliamentSummary ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">No parliament data available yet.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30">
                  <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">Attendance</div>
                  <div className="text-2xl font-bold text-blue-800 dark:text-blue-100">
                    {parliamentSummary.isPresiding
                      ? 'Chair — does not vote'
                      : parliamentSummary.attendancePct !== null
                      ? `${parliamentSummary.attendancePct}%`
                      : '—'}
                  </div>
                  {!parliamentSummary.isPresiding && (
                    <div className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                      {parliamentSummary.votesCast ?? '—'} of {parliamentSummary.divisionsEligible ?? '—'} divisions
                    </div>
                  )}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Questions</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {parliamentSummary.questionsOral === null && parliamentSummary.questionsWritten === null
                      ? '—'
                      : (parliamentSummary.questionsOral ?? 0) + (parliamentSummary.questionsWritten ?? 0)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {parliamentSummary.questionsOral ?? '—'} oral · {parliamentSummary.questionsWritten ?? '—'} written
                  </div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800/30">
                  <div className="text-sm text-green-700 dark:text-green-300 mb-1">Debate sections spoken</div>
                  <div className="text-2xl font-bold text-green-800 dark:text-green-100">
                    {parliamentSummary.sectionsSpoken ?? '—'}
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-300 mt-1">
                    {parliamentSummary.speeches ?? '—'} speeches
                  </div>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800/30">
                  <div className="text-sm text-purple-700 dark:text-purple-300 mb-1">Party line</div>
                  <div className="text-2xl font-bold text-purple-800 dark:text-purple-100">
                    {parliamentSummary.partyLinePct !== null ? `${parliamentSummary.partyLinePct}%` : '—'}
                  </div>
                  {parliamentSummary.votesAgainstParty !== null && (
                    <div className="text-xs text-purple-600 dark:text-purple-300 mt-1">
                      {parliamentSummary.votesAgainstParty} votes against party
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Recent Votes */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Vote className="w-5 h-5 text-blue-600" />
                Recent Votes
              </h2>
              <button
                type="button"
                onClick={() => setVotesAgainstPartyOnly((prev) => !prev)}
                className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
                  votesAgainstPartyOnly
                    ? 'border-orange-300 bg-orange-100 text-orange-800'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300'
                }`}
              >
                Against party only
              </button>
            </div>

            {tdVotesLoading ? (
              <div className="text-center py-6 text-gray-500 text-sm">Loading votes...</div>
            ) : tdVotes.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">No votes recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {tdVotes.map((vote: TdVote) => (
                  <div
                    key={vote.divisionId}
                    className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                          {vote.subject || vote.debateTitle || 'Division'}
                        </h4>
                        <div className="text-[10px] text-gray-400 mt-2 flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          {new Date(vote.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {vote.withParty === false && (
                            <span className="text-orange-600 dark:text-orange-400">Against party</span>
                          )}
                        </div>
                      </div>
                      <Badge
                        className={`whitespace-nowrap ${
                          vote.vote === 'ta'
                            ? 'bg-green-100 text-green-800 hover:bg-green-200 border-green-200'
                            : vote.vote === 'nil'
                            ? 'bg-red-100 text-red-800 hover:bg-red-200 border-red-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-200'
                        }`}
                        variant="outline"
                      >
                        {VOTE_LABEL[vote.vote]}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Debate Contributions */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Recent Debate Contributions
            </h2>

            {tdDebatesLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            ) : tdDebateContributions.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">No debate contributions recorded for this period.</p>
            ) : (
              <div className="space-y-3">
                {tdDebateContributions.map((contribution: TdDebateContribution) => (
                  <div
                    key={contribution.sectionId}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span>{new Date(contribution.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span>{contribution.speeches} speech{contribution.speeches === 1 ? '' : 'es'} · {contribution.words.toLocaleString()} words</span>
                    </div>
                    <h4 className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{contribution.title}</h4>
                    {contribution.excerpt && (
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{contribution.excerpt}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Powered by Oireachtas debate transcripts.
            </p>
          </Card>

          {/* Recent scored articles */}
          {score.recentArticles.length > 0 && (
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                News Coverage Analysis
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {score.totalStories} articles have moved this TD's score. The most recent are below.
              </p>

              <div className="space-y-3">
                {score.recentArticles.map((article) => {
                  const positive = article.impact > 0;
                  const negative = article.impact < 0;
                  return (
                    <div
                      key={article.articleId}
                      className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {article.storyType && (
                              <Badge variant="outline" className="text-xs capitalize">
                                {article.storyType.replace(/_/g, ' ')}
                              </Badge>
                            )}
                            {article.sentiment && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  positive ? 'border-green-400 text-green-700' :
                                  negative ? 'border-red-400 text-red-700' :
                                  'border-gray-400 text-gray-700'
                                }`}
                              >
                                {article.sentiment.replace(/_/g, ' ')}
                              </Badge>
                            )}
                            {article.needsReview && (
                              <Badge variant="outline" className="text-xs border-amber-400 text-amber-700">
                                Needs review
                              </Badge>
                            )}
                          </div>
                          {article.reasoning && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                              {article.reasoning}
                            </p>
                          )}
                          <div className="text-[10px] text-gray-400 mt-2">
                            {new Date(article.at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                        <div className={`text-sm font-bold flex-shrink-0 ${positive ? 'text-green-600' : negative ? 'text-red-600' : 'text-gray-500'}`}>
                          {positive ? '+' : ''}{article.impact}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Available Data Notice */}
          <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              📊 Data Coverage
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold mt-0.5">✓</span>
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Questions:</span>
                  <span className="text-gray-700 dark:text-gray-300 ml-1">
                    Complete data from Nov 2024 - Oct 2025
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold mt-0.5">✓</span>
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Votes:</span>
                  <span className="text-gray-700 dark:text-gray-300 ml-1">
                    Complete Dáil voting records (Dec 2024 - Oct 2025)
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 font-bold mt-0.5">○</span>
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Debates & Legislation:</span>
                  <span className="text-gray-700 dark:text-gray-300 ml-1">
                    Coming soon (API limitations)
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Background Info */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Background & Experience</h2>
            
            {/* Bio */}
            {score.bio && (
              <p className="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">
                {score.bio}
              </p>
            )}

            {/* Historical research baseline */}
            {score.baseline?.summary && (
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {score.baseline.summary}
                </p>
                {score.baseline.keyFindings.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                    {score.baseline.keyFindings.map((finding, idx) => (
                      <li key={idx}>{finding}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              {score.baseline?.category && (
                <InfoCard
                  icon={<Award className="w-5 h-5 text-purple-600" />}
                  label="Research Category"
                  value={score.baseline.category}
                />
              )}

              {score.baseline?.researchDate && (
                <InfoCard
                  icon={<Calendar className="w-5 h-5 text-green-600" />}
                  label="Researched"
                  value={new Date(score.baseline.researchDate).toLocaleDateString('en-IE', { year: 'numeric', month: 'long' })}
                />
              )}

              {score.committees.length > 0 && (
                <div className="md:col-span-2">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Committees
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {score.committees.map((committee) => (
                      <Badge key={committee} variant="secondary">{committee}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {!score.bio && !score.baseline && score.committees.length === 0 && (
                <p className="md:col-span-2 text-sm text-gray-500 dark:text-gray-400">
                  No background information available yet.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function PerformanceBar({ label, score, color, description }: {
  label: string;
  score: number | null;
  color: PillarColor;
  description?: string;
}) {
  const colorClasses: Record<PillarColor, string> = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    cyan: 'bg-cyan-500',
    indigo: 'bg-indigo-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    green: 'bg-green-500'
  };

  const isAvailable = typeof score === 'number' && !Number.isNaN(score);
  const percentage = isAvailable ? Math.min(100, Math.max(0, score)) : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-gray-900 dark:text-white">{label}</span>
        <span className="font-bold text-lg">
          {isAvailable ? (
            <>
              {Math.round(score)}<span className="text-sm text-gray-500">/100</span>
            </>
          ) : (
            'N/A'
          )}
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-1">
        {isAvailable ? (
          <div
            className={`h-full ${colorClasses[color]} transition-all`}
            style={{ width: `${percentage}%` }}
          />
        ) : (
          <div className="h-full w-full bg-gray-300 dark:bg-gray-600 opacity-60" />
        )}
      </div>
      {isAvailable ? (
        description && (
          <p className="text-xs text-gray-600 dark:text-gray-400">{description}</p>
        )
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400">Not enough data yet.</p>
      )}
    </div>
  );
}

function RankCard({ label, rank, total }: { label: string; rank: number | null; total: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <div className="text-right">
        <span className="text-xl font-bold text-gray-900 dark:text-white">
          #{rank || '—'}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-500"> / {total}</span>
      </div>
    </div>
  );
}

function StatRow({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-bold text-lg">{value}</span>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {icon}
      <div>
        <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
        <div className="font-semibold text-gray-900 dark:text-white">{value}</div>
      </div>
    </div>
  );
}

// Helper function to calculate re-election chance
function calculateReelectionChance(performanceScore: number | null, partyPolling: number | null): number | null {
  if (performanceScore === null || !Number.isFinite(performanceScore)) {
    return null;
  }

  if (partyPolling === null) {
    // If no polling data, base only on performance
    return Math.min(95, Math.max(20, Math.round(performanceScore * 0.85)));
  }
  
  // Performance is 60% of re-election chance, party polling is 40%
  const baseChance = performanceScore * 0.6;
  const partyBonus = partyPolling * 2 * 0.4; // Scale polling % to similar range
  return Math.min(95, Math.max(20, Math.round(baseChance + partyBonus)));
}

function getConstituencyTDCount(constituency: string): number {
  // Most constituencies have 3-5 TDs
  return 5;
}

function getPartyTDCount(party: string): number {
  const counts: Record<string, number> = {
    'Fianna Fáil': 48,
    'Sinn Féin': 39,
    'Fine Gael': 38,
    'Social Democrats': 11,
    'Labour Party': 11,
    'Independent': 15
  };
  return counts[party] || 10;
}

