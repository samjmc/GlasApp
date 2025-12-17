/**
 * Enhanced TD Profile Page
 * Comprehensive TD profile with modern design, polling data, and rich analytics
 */

import { useParams, Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorDisplay, NotFoundError } from '@/components/ErrorDisplay';
import { PageHeader } from "@/components/PageHeader";
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

const IDEOLOGY_DIMENSION_LABELS: Record<string, string> = {
  economic: 'Economic Left - Right',
  social: 'Social Progressive - Conservative',
  cultural: 'Cultural Multicultural - Traditional',
  authority: 'Authority Libertarian - Authoritarian',
  environmental: 'Environmental Industrial - Ecological',
  welfare: 'Welfare Individual - Communitarian',
  globalism: 'Globalism Nationalist - Internationalist',
  technocratic: 'Governance Populist - Technocratic',
};

const IDEOLOGY_SHORT_LABELS: Record<string, string> = {
  economic: 'Economic',
  social: 'Social',
  cultural: 'Cultural',
  authority: 'Authority',
  environmental: 'Environment',
  welfare: 'Welfare',
  globalism: 'Globalism',
  technocratic: 'Technocratic',
};

function formatConfidence(weight?: number): string {
  if (!weight || weight <= 0) return 'No signals yet';
  if (weight >= 40) return 'High confidence';
  if (weight >= 15) return 'Moderate confidence';
  return 'Low confidence';
}

export default function TDProfilePageEnhanced() {
  const { name } = useParams<{ name: string }>();
  const queryClient = useQueryClient();
  
  const { data: scoreData, isLoading, error } = useQuery({
    queryKey: ['td-profile-v2', name],  // v2 to bust cache after adding image_url
    queryFn: async () => {
      const res = await fetch(`/api/parliamentary/scores/td/${encodeURIComponent(name || '')}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('TD_NOT_FOUND');
        if (res.status >= 500) throw new Error('Server error - please try again later');
        throw new Error('Failed to load TD profile');
      }
      const data = await res.json();
      return data.td ? { score: data.td } : data;
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
  
  const politicianName = scoreData?.score?.politician_name;

  const {
    data: debateActivity,
    isLoading: debateMetricsLoading,
    error: debateMetricsError
  } = useQuery({
    queryKey: ['td-debate-metrics', politicianName],
    queryFn: async () => {
      const response = await fetch(`/api/debates/td/${encodeURIComponent(politicianName || '')}/metrics`);
      if (!response.ok) {
        throw new Error('Failed to load debate activity');
      }
      return response.json();
    },
    enabled: !!politicianName,
    staleTime: 5 * 60 * 1000
  });

  const {
    data: debateHistory,
    isLoading: debateHistoryLoading,
    error: debateHistoryError
  } = useQuery({
    queryKey: ['td-debate-history', politicianName],
    queryFn: async () => {
      const response = await fetch(`/api/debates/td/${encodeURIComponent(politicianName || '')}/history?periods=12`);
      if (!response.ok) {
        throw new Error('Failed to load debate history');
      }
      return response.json();
    },
    enabled: !!politicianName,
    staleTime: 5 * 60 * 1000
  });

  const {
    data: debateAlerts = [],
    isLoading: debateAlertsLoading,
    error: debateAlertsError
  } = useQuery({
    queryKey: ['td-debate-alerts', politicianName],
    queryFn: async () => {
      const response = await fetch(`/api/debates/alerts?td=${encodeURIComponent(politicianName || '')}&limit=6`);
      if (!response.ok) {
        throw new Error('Failed to load debate alerts');
      }
      const payload = await response.json();
      const alerts = payload?.alerts ?? [];
      return alerts.map((item: any) => ({
        ...item,
        status: item.status ?? 'new'
      }));
    },
    enabled: !!politicianName,
    staleTime: 2 * 60 * 1000
  });

  const updateAlertStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/debates/alerts/${encodeURIComponent(id)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        throw new Error('Failed to update alert status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['td-debate-alerts', politicianName] });
      queryClient.invalidateQueries({ queryKey: ['debates', 'alerts'] });
    }
  });

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
    queryKey: ['party-polling', scoreData?.score?.party],
    queryFn: async () => {
      if (!scoreData?.score?.party) return null;
      
      const { supabase } = await import('../lib/supabaseClient');
      const { data, error } = await supabase
        .from('polling_aggregates_cache')
        .select('*')
        .eq('entity_type', 'party')
        .eq('entity_name', scoreData.score.party)
        .maybeSingle();
      
      if (error) {
        console.error('Polling fetch error:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!scoreData?.score?.party
  });
  
  // Fetch voting analysis data
  const { data: votingStats } = useQuery({
    queryKey: ['td-voting-stats', politicianName],
    queryFn: async () => {
      const res = await fetch(`/api/parliamentary/voting/stats/${encodeURIComponent(politicianName || '')}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!politicianName
  });

  const { data: rebelVotesData } = useQuery({
    queryKey: ['td-rebel-votes', politicianName],
    queryFn: async () => {
      const res = await fetch(`/api/parliamentary/voting/rebel/${encodeURIComponent(politicianName || '')}`);
      if (!res.ok) return { votes: [] };
      return res.json();
    },
    enabled: !!politicianName
  });

  const { data: recentVotesData } = useQuery({
    queryKey: ['td-recent-votes', politicianName],
    queryFn: async () => {
      const res = await fetch(`/api/parliamentary/voting/recent/${encodeURIComponent(politicianName || '')}?limit=3`);
      if (!res.ok) return { votes: [] };
      return res.json();
    },
    enabled: !!politicianName
  });
  
  const score = scoreData?.score;
  
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
  
  const overallScore = typeof score.overall_score === 'number' ? score.overall_score : null;
  const rating = overallScore !== null ? getScoreRating(overallScore) : null;

  const componentWeights = score.components || {};
  const buildPillar = (
    componentKey: keyof typeof componentWeights,
    defaults: {
      label: string;
      color: keyof typeof colorClasses;
      fallbackWeight: string;
      description: string;
    }
  ) => {
    const component = componentWeights[componentKey] as any;
    const weightPercent = component?.weight != null ? Math.round(component.weight * 100) : null;
    const rawScore = component?.score != null ? Number(component.score) : null;
    const available = component?.available === false ? false : Number.isFinite(rawScore);
    return {
      label: component?.label || defaults.label,
      color: defaults.color,
      score: available ? Number(rawScore) : null,
      weightLabel: weightPercent !== null ? `${weightPercent}%` : defaults.fallbackWeight,
      description: component?.description || defaults.description,
      breakdown: available && Array.isArray(component?.breakdown) ? component.breakdown : [],
      available
    };
  };

  const pillars = [
    buildPillar('impact', {
      label: 'Impact',
      color: 'emerald',
      fallbackWeight: '50%',
      description: `Last 90 days • ${score.total_stories || 0} articles`
    }),
    buildPillar('effectiveness', {
      label: 'Effectiveness',
      color: 'blue',
      fallbackWeight: '25%',
      description: 'Parliamentary workload and debate effectiveness.'
    }),
    buildPillar('constituency_service', {
      label: 'Constituency Service',
      color: 'orange',
      fallbackWeight: '15%',
      description: 'Local engagement, clinics, and casework impact.'
    }),
    buildPillar('engagement_transparency', {
      label: 'Engagement & Transparency',
      color: 'purple',
      fallbackWeight: '10%',
      description: 'Attendance, disclosure quality, and responsiveness.'
    })
  ];
  
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
              {score.image_url ? (
                <img 
                  src={score.image_url} 
                  alt={score.politician_name || score.name}
                  className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-white shadow-lg flex-shrink-0"
                />
              ) : (
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white text-3xl md:text-4xl font-bold border-4 border-white shadow-lg flex-shrink-0">
                  {(score.politician_name || score.name || '?').charAt(0)}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl md:text-5xl font-bold mb-3 text-gray-900 dark:text-white">
                  {score.politician_name || score.name}
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
                {score.offices.map((office: string, idx: number) => (
                  <Badge key={idx} className="gap-1 bg-yellow-500 hover:bg-yellow-600 text-white border-0">
                    <Crown className="w-3 h-3" />
                    {office}
                  </Badge>
                ))}
              </div>
            )}

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-4 text-sm">
              {score.yearsInDail && (
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>{score.yearsInDail} years in Dáil</span>
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
              <RankCard label="National Rank" rank={score.national_rank || score.ranks?.national} total="169" />
              <RankCard label="Constituency Rank" rank={score.constituency_rank || score.ranks?.constituency} total={`${getConstituencyTDCount(score.constituency)}`} />
              <RankCard label="Party Rank" rank={score.party_rank || score.ranks?.party} total={`${getPartyTDCount(score.party)}`} />
            </div>
          </Card>

          {/* Ideology Profile */}
          <Card className="p-6">
            <h2 className="font-bold text-xl mb-4">Ideology Profile</h2>
            {score.ideology ? (
              <>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-4 space-y-2">
                  <p>
                    Alignment scores are on a -10 to +10 scale. Higher positive values indicate a more traditional or establishment stance for that axis; negative values indicate progressive or reformist leanings.
                  </p>
                  <div>
                    Confidence: {formatConfidence(score.ideology.tdTotalWeight)} ({(score.ideology.tdTotalWeight ?? 0).toFixed(1)} signal weight)
                  </div>
                </div>
                <div className="space-y-3">
                  {IDEOLOGY_DIMENSION_LABELS &&
                    Object.entries(IDEOLOGY_DIMENSION_LABELS).map(([dimension, label]) => {
                      const rawValue = (score.ideology?.td?.[dimension] ?? 0);
                      const normalized = Math.max(0, Math.min(100, ((Number(rawValue) + 10) / 20) * 100));
                      return (
                        <div key={dimension} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs text-gray-700 dark:text-gray-300">
                            <span>{label}</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{Number(rawValue).toFixed(1)}</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
                              style={{ width: `${normalized}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>

                {score.ideology.party && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                      Party average ({score.party || 'Independent'})
                    </h3>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
                      Signals: {formatConfidence(score.ideology.partyTotalWeight)} ({(score.ideology.partyTotalWeight ?? 0).toFixed(1)} weight)
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                      {Object.entries(IDEOLOGY_SHORT_LABELS).map(([dimension, shortLabel]) => (
                        <div key={dimension} className="flex justify-between">
                          <span>{shortLabel}</span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {Number(score.ideology.party?.[dimension] ?? 0).toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!score.ideology.tdTotalWeight || score.ideology.tdTotalWeight <= 0) && (
                  <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    No recorded statements or news signals yet. As we collect more policy stances, this profile will update automatically.
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Ideology data is being loaded...
              </div>
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
                {newsArticles.slice(0, 3).map((article: any, idx: number) => (
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
                          <span>{new Date(article.published_date).toLocaleDateString('en-IE', { month: 'short', day: 'numeric' })}</span>
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
                  weight={pillar.weightLabel}
                  color={pillar.color}
                  description={pillar.description}
                  breakdown={pillar.breakdown}
                  available={pillar.available}
                />
              ))}
            </div>
          </Card>

          {/* Voting Analysis */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Vote className="w-6 h-6 text-blue-600" />
              Voting Record
            </h2>

            {votingStats ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30">
                    <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">Party Loyalty</div>
                    <div className="text-2xl font-bold text-blue-800 dark:text-blue-100">
                      {votingStats.partyLoyaltyRate}%
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Votes</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {votingStats.totalVotes}
                    </div>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800/30">
                    <div className="text-sm text-green-700 dark:text-green-300 mb-1">Voted Tá (Yes)</div>
                    <div className="text-2xl font-bold text-green-800 dark:text-green-100">
                      {votingStats.taVotes}
                    </div>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800/30">
                    <div className="text-sm text-red-700 dark:text-red-300 mb-1">Voted Níl (No)</div>
                    <div className="text-2xl font-bold text-red-800 dark:text-red-100">
                      {votingStats.nilVotes}
                    </div>
                  </div>
                </div>

                {/* Recent Votes Section */}
                {recentVotesData?.votes && recentVotesData.votes.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <Vote className="w-4 h-4" />
                      Recent Activity
                    </h3>
                    <div className="space-y-2">
                      {recentVotesData.votes.map((vote: any, idx: number) => (
                        <div key={idx} className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:border-blue-300 transition-colors">
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                                {vote.subject}
                              </h4>
                              {vote.description && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                  {vote.description}
                                </p>
                              )}
                              <div className="text-[10px] text-gray-400 mt-2 flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                {new Date(vote.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                            </div>
                            <Badge 
                              className={`whitespace-nowrap ${
                                vote.vote === 'ta' ? 'bg-green-100 text-green-800 hover:bg-green-200 border-green-200' : 
                                vote.vote === 'nil' ? 'bg-red-100 text-red-800 hover:bg-red-200 border-red-200' : 
                                'bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-200'
                              }`}
                              variant="outline"
                            >
                              {vote.vote === 'ta' ? 'Tá' : vote.vote === 'nil' ? 'Níl' : 'Staon'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rebel Votes Section */}
                {rebelVotesData?.votes && rebelVotesData.votes.length > 0 ? (
                  <div className="border rounded-lg p-4 border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-900/10">
                    <h3 className="font-semibold text-orange-800 dark:text-orange-200 mb-3 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" />
                      Rebel Votes ({rebelVotesData.votes.length})
                    </h3>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                      Votes where {politicianName} voted against their party position.
                    </p>
                    <div className="space-y-3">
                      {rebelVotesData.votes.slice(0, 3).map((vote: any, idx: number) => (
                        <div key={idx} className="bg-white dark:bg-gray-900 p-3 rounded border border-orange-100 dark:border-orange-800/30 shadow-sm">
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                              {vote.subject}
                            </h4>
                            <Badge variant="outline" className="whitespace-nowrap border-orange-200 text-orange-700">
                              {new Date(vote.date).toLocaleDateString()}
                            </Badge>
                          </div>
                          {vote.description && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
                              "{vote.description}"
                            </p>
                          )}
                          <div className="mt-2 flex gap-2 text-xs">
                            <span className="font-medium">Vote: {vote.vote === 'ta' ? 'Tá' : vote.vote === 'nil' ? 'Níl' : 'Abstain'}</span>
                            <span className="text-gray-400">|</span>
                            <span className="text-orange-600 dark:text-orange-400">Differs from party</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-100 dark:border-gray-700">
                    <Award className="w-4 h-4 text-blue-500" />
                    No rebel votes recorded. Consistently votes with party line.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Loading voting records...
              </div>
            )}
          </Card>

          {/* Debate Activity */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Debate Activity
              </h2>
              {debateActivity?.period && (
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Week {formatDateRange(debateActivity.period.start, debateActivity.period.end)}
                </span>
              )}
            </div>

            {debateMetricsLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            ) : debateMetricsError ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                Unable to load debate activity.
              </p>
            ) : debateActivity?.metrics ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3">
                    <div className="text-xs uppercase text-blue-600 dark:text-blue-300">Words</div>
                    <div className="text-lg font-semibold text-blue-700 dark:text-blue-200">
                      {debateActivity.metrics.wordsSpoken.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 p-3">
                    <div className="text-xs uppercase text-indigo-600 dark:text-indigo-300">Speeches</div>
                    <div className="text-lg font-semibold text-indigo-700 dark:text-indigo-200">
                      {debateActivity.metrics.speeches}
                    </div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3">
                    <div className="text-xs uppercase text-emerald-600 dark:text-emerald-300">Unique Topics</div>
                    <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-200">
                      {debateActivity.metrics.uniqueTopics}
                    </div>
                  </div>
                  <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 p-3">
                    <div className="text-xs uppercase text-orange-600 dark:text-orange-300">Minutes</div>
                    <div className="text-lg font-semibold text-orange-700 dark:text-orange-200">
                      {Number(debateActivity.metrics.metadata?.totalMinutes || 0).toFixed(1)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 p-3">
                    <div className="text-xs uppercase text-purple-600 dark:text-purple-300">Influence</div>
                    <div className="text-lg font-semibold text-purple-700 dark:text-purple-200">
                      {formatInfluenceScore(debateActivity.metrics.influenceScore)} / 100
                    </div>
                  </div>
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3">
                    <div className="text-xs uppercase text-amber-600 dark:text-amber-300">Effectiveness</div>
                    <div className="text-lg font-semibold text-amber-700 dark:text-amber-200">
                      {formatEffectivenessScore(debateActivity.metrics.effectivenessScore)} / 100
                    </div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3">
                    <div className="text-xs uppercase text-emerald-600 dark:text-emerald-300">Sentiment</div>
                    <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-200">
                      {formatSentimentScore(debateActivity.metrics.sentimentScore)}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Focus Areas</h3>
                  {debateActivity.issueFocus.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">No topic breakdown available for this period.</p>
                  ) : (
                    <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-200">
                      {debateActivity.issueFocus.slice(0, 4).map((topic: any) => (
                        <li key={topic.topic} className="flex justify-between">
                          <span>{topic.topic}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatPercentage(topic.percentage)} ({topic.minutes_spoken.toFixed(1)} mins)
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {debateActivity.chamberActivity && debateActivity.chamberActivity.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Chamber Split</h3>
                    <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-200">
                      {debateActivity.chamberActivity.map((item: any) => (
                        <li key={item.chamber} className="flex justify-between">
                          <span>{item.chamber}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{Number(item.minutes).toFixed(1)} mins</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">No debate activity recorded for this period.</p>
            )}

            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Powered by Oireachtas transcripts and AI summaries.
            </p>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Recent weekly trend</h3>
              {debateHistoryLoading ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">Loading debate history…</p>
              ) : debateHistoryError ? (
                <p className="text-xs text-red-500 dark:text-red-400">
                  {debateHistoryError instanceof Error ? debateHistoryError.message : 'Unable to load history'}
                </p>
              ) : debateHistory?.history?.length ? (
                <>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={[...debateHistory.history].reverse().map((entry: any) => ({
                          label: new Date(entry.periodEnd).toLocaleDateString('en-IE', {
                            month: 'short',
                            day: 'numeric',
                          }),
                          words: entry.wordsSpoken,
                        }))}
                        margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="words"
                          stroke="#1d4ed8"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                    {debateHistory.history.slice(0, 6).map((entry: any) => (
                      <li key={`${entry.periodStart}-${entry.periodEnd}`} className="flex justify-between">
                        <span>
                          {new Date(entry.periodStart).toLocaleDateString('en-IE', { month: 'short', day: 'numeric' })} –{' '}
                          {new Date(entry.periodEnd).toLocaleDateString('en-IE', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                      {entry.wordsSpoken.toLocaleString()} words · {entry.speeches} speeches · Eff {formatEffectivenessScore(entry.effectivenessScore)} · Infl {formatInfluenceScore(entry.influenceScore)} · Sentiment {formatSentimentScore(entry.sentimentScore)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  History will appear once multiple weeks of debate metrics are available.
                </p>
              )}
            </div>
          </Card>

          {/* Consistency Alerts */}
          <Card className="p-6 border border-amber-200 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-950/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <MessageSquare className="w-5 h-5 text-amber-600" />
                Consistency Alerts
              </h2>
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Premium</span>
            </div>
            {debateAlertsLoading ? (
              <div className="space-y-2">
                <div className="h-3 rounded bg-amber-200/60 dark:bg-amber-500/20 animate-pulse" />
                <div className="h-3 rounded bg-amber-200/60 dark:bg-amber-500/20 animate-pulse" />
              </div>
            ) : debateAlertsError ? (
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Unable to load alerts right now.
              </p>
            ) : debateAlerts.length === 0 ? (
              <p className="text-sm text-amber-800 dark:text-amber-200">
                No consistency or issue-focus alerts for this period.
              </p>
            ) : (
              <ul className="space-y-3">
                {debateAlerts.map((alert: any) => (
                  <li
                    key={alert.id}
                    className="rounded-lg border border-amber-200 bg-white/90 px-3 py-2 text-sm text-gray-800 shadow-sm dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-100"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{alert.summary}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[0.65rem] font-semibold ${
                              alert.status === 'resolved'
                                ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-200'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100'
                            }`}
                          >
                            {alert.status === 'resolved' ? 'Reviewed' : 'New'}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-amber-700/90 dark:text-amber-200">
                          {alert.type === 'flip_flop'
                            ? `${alert.previousPosition} → ${alert.currentPosition} on ${alert.topic}`
                            : `Focus on ${alert.topic} increased markedly`}
                        </div>
                      </div>
                      <div className="text-right text-xs text-amber-700 dark:text-amber-200">
                        {alert.confidence !== null && (
                          <div>{(alert.confidence * 100).toFixed(0)}% sure</div>
                        )}
                        <button
                          type="button"
                          onClick={() => updateAlertStatus.mutate({ id: alert.id, status: 'resolved' })}
                          disabled={alert.status === 'resolved' || updateAlertStatus.isLoading}
                          className="mt-2 rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-500/10"
                        >
                          {alert.status === 'resolved' ? 'Marked reviewed' : 'Mark reviewed'}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* News Sentiment */}
          {score.total_stories > 0 && (
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                News Coverage Analysis
              </h2>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-200">
                  <div className="text-3xl font-bold text-green-600">
                    {score.positive_stories || 0}
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">Positive</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-gray-200">
                  <div className="text-3xl font-bold text-gray-600">
                    {(score.total_stories || 0) - (score.positive_stories || 0) - (score.negative_stories || 0)}
                  </div>
                  <div className="text-sm text-gray-600">Neutral</div>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-200">
                  <div className="text-3xl font-bold text-red-600">
                    {score.negative_stories || 0}
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-300">Negative</div>
                </div>
              </div>

              {/* Sentiment bar */}
              <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-green-500"
                  style={{ width: `${((score.positive_stories || 0) / (score.total_stories || 1)) * 100}%` }}
                />
                <div
                  className="absolute top-0 h-full bg-red-500"
                  style={{ 
                    width: `${((score.negative_stories || 0) / (score.total_stories || 1)) * 100}%`,
                    right: 0
                  }}
                />
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
            
            {/* Historical Summary */}
            {score.historical_summary && (
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {score.historical_summary}
                </p>
              </div>
            )}
            
            <div className="grid md:grid-cols-2 gap-4">
              {score.seniority && (
                <InfoCard
                  icon={<Award className="w-5 h-5 text-purple-600" />}
                  label="Seniority Level"
                  value={score.seniority}
                />
              )}
              
              {score.firstElectedDate && (
                <InfoCard
                  icon={<Calendar className="w-5 h-5 text-green-600" />}
                  label="First Elected"
                  value={new Date(score.firstElectedDate).toLocaleDateString('en-IE', { year: 'numeric', month: 'long' })}
                />
              )}

              {score.currentTermStart && (
                <InfoCard
                  icon={<Calendar className="w-5 h-5 text-blue-600" />}
                  label="Current Term"
                  value={`Since ${new Date(score.currentTermStart).toLocaleDateString('en-IE', { year: 'numeric', month: 'short' })}`}
                />
              )}

              {score.wikipediaTitle && (
                <div className="md:col-span-2">
                  <a
                    href={`https://en.wikipedia.org/wiki/${encodeURIComponent(score.wikipediaTitle)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group"
                  >
                    <ExternalLink className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-700 dark:text-blue-300 group-hover:text-blue-800">
                      View Full Biography on Wikipedia
                    </span>
                  </a>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function PerformanceBar({ label, score, weight, color, description, breakdown, available = true }: any) {
  const colorClasses = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    cyan: 'bg-cyan-500',
    indigo: 'bg-indigo-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    green: 'bg-green-500'
  };

  const isAvailable = available && typeof score === 'number' && !Number.isNaN(score);
  const percentage = isAvailable ? Math.min(100, Math.max(0, score)) : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div>
          <span className="font-semibold text-gray-900 dark:text-white">{label}</span>
          <Badge variant="outline" className="ml-2 text-xs">{weight}</Badge>
        </div>
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
            className={`h-full ${colorClasses[color as keyof typeof colorClasses]} transition-all`}
            style={{ width: `${percentage}%` }}
          />
        ) : (
          <div className="h-full w-full bg-gray-300 dark:bg-gray-600 opacity-60" />
        )}
      </div>
      {isAvailable ? (
        Array.isArray(breakdown) && breakdown.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
            {breakdown.map((item: any) => (
              <li key={`${label}-${item.label}`} className="rounded border border-gray-200/70 dark:border-gray-700/70 p-2">
                <div className="flex items-center justify-between text-gray-700 dark:text-gray-200">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-right">
                    {item.score}/100
                    {typeof item.weight_percent === 'number' && (
                      <span className="ml-2 text-[10px] text-gray-500 dark:text-gray-400">
                        {item.weight_percent}% weight
                      </span>
                    )}
                  </span>
                </div>
                {item.detail && (
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    {item.detail}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          description && (
            <p className="text-xs text-gray-600 dark:text-gray-400">{description}</p>
          )
        )
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400">Not enough data yet.</p>
      )}
    </div>
  );
}

function RankCard({ label, rank, total }: any) {
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

function StatRow({ icon, label, value }: any) {
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

function InfoCard({ icon, label, value }: any) {
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
  if (!Number.isFinite(performanceScore)) {
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

function formatDateRange(start: string, end: string) {
  try {
    const formatter = new Intl.DateTimeFormat('en-IE', { month: 'short', day: 'numeric' });
    return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`;
  } catch {
    return `${start} – ${end}`;
  }
}

function formatSentimentScore(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '–';
  const percentage = (value * 100).toFixed(0);
  const sign = value > 0 ? '+' : '';
  return `${sign}${percentage}`;
}

function formatInfluenceScore(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '–';
  return value.toFixed(1);
}

function formatEffectivenessScore(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '–';
  return value.toFixed(1);
}

function formatPercentage(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '–';
  return `${(value * 100).toFixed(1)}%`;
}

