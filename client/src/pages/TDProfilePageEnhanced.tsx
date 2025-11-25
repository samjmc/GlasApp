/**
 * Enhanced TD Profile Page
 * Comprehensive TD profile with modern design, polling data, and rich analytics
 */

import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Award,
  Users,
  FileText,
  BarChart3,
  Crown,
  Building2,
  Calendar,
  ExternalLink,
  MapPin,
  MessageSquare,
  Vote,
  LineChart,
  ChevronLeft,
  Share2
} from 'lucide-react';

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
  
  const { data: scoreData, isLoading } = useQuery({
    queryKey: ['td-profile', name],
    queryFn: async () => {
      const res = await fetch(`/api/parliamentary/scores/td/${encodeURIComponent(name || '')}`);
      if (!res.ok) throw new Error('Failed to fetch TD score');
      const data = await res.json();
      return data.td ? { score: data.td } : data;
    },
    enabled: !!name
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
  
  const score = scoreData?.score;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading TD profile...</p>
        </div>
      </div>
    );
  }
  
  if (!score) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">TD Not Found</h1>
          <p className="text-gray-600 mb-6">No performance data available for this TD yet.</p>
          <Link href="/">
            <Button>Return to Homepage</Button>
          </Link>
        </Card>
      </div>
    );
  }
  
  const getScoreRating = (value: number) => {
    if (value >= 85) return { label: 'Excellent', color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-300' };
    if (value >= 75) return { label: 'Very Good', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-300' };
    if (value >= 65) return { label: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-300' };
    if (value >= 50) return { label: 'Average', color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300' };
    return { label: 'Needs Work', color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-300' };
  };
  
  const overallScore = typeof score.overall_score === 'number' ? score.overall_score : null;
  const rating = overallScore !== null ? getScoreRating(overallScore) : null;

  const components = score.components || {};
  const componentList = [
    {
      key: 'impact',
      fallbackWeight: '50%',
      color: 'emerald',
      defaultDescription: `Latest 90 day news & debate resonance`,
    },
    {
      key: 'effectiveness',
      fallbackWeight: '25%',
      color: 'blue',
      defaultDescription: `Parliamentary workload and debate effectiveness`,
    },
    {
      key: 'constituency_service',
      fallbackWeight: '15%',
      color: 'orange',
      defaultDescription: `Clinics, casework and local focus`,
    },
    {
      key: 'engagement_transparency',
      fallbackWeight: '10%',
      color: 'purple',
      defaultDescription: `Attendance, openness and accessibility`,
    },
  ].map((item) => {
    const data = (components as any)[item.key] || {};
    const weightPercent = data.weight != null ? Math.round(data.weight * 100) : null;
    const rawScore = data.score != null ? Number(data.score) : null;
    const available = data.available === false ? false : Number.isFinite(rawScore);
    return {
      label: data.label || item.key.replace('_', ' '),
      score: available ? Number(rawScore) : null,
      weightLabel: weightPercent !== null ? `${weightPercent}%` : item.fallbackWeight,
      breakdown: available && Array.isArray(data.breakdown) ? data.breakdown : [],
      color: item.color,
      description: data.description || item.defaultDescription,
      available
    };
  });
  
  // Real polling data
  const pollingData = {
    partyNationalPolling: partyPolling?.latest_support ? parseFloat(partyPolling.latest_support) : null,
    partyChange30d: partyPolling?.support_30d_change ? parseFloat(partyPolling.support_30d_change) : 0,
    trend: partyPolling?.support_30d_trend || 'stable',
    lastPollDate: partyPolling?.latest_poll_date || null,
    pollSource: partyPolling?.latest_poll_source || null,
    constituencyPolling: null,
    reelectionChance: calculateReelectionChance(overallScore, partyPolling?.latest_support ? parseFloat(partyPolling.latest_support) : null)
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
      <Card className="p-6 md:p-8 mb-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-2 border-blue-200">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-4xl md:text-5xl font-bold mb-3 text-gray-900 dark:text-white">
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
              <RankCard label="National Rank" rank={score.national_rank} total="173" />
              <RankCard label="Constituency Rank" rank={score.constituency_rank} total={`${getConstituencyTDCount(score.constituency)}`} />
              <RankCard label="Party Rank" rank={score.party_rank} total={`${getPartyTDCount(score.party)}`} />
            </div>
          </Card>

          {/* Key Stats */}
          <Card className="p-6">
            <h2 className="font-bold text-xl mb-4">Key Statistics</h2>
            <div className="space-y-3">
              <StatRow icon={<FileText className="w-4 h-4" />} label="News Articles" value={score.total_stories || 0} />
              <StatRow 
                icon={<MessageSquare className="w-4 h-4" />} 
                label="Questions Asked" 
                value={score.questions_asked || 0} 
              />
              <StatRow 
                icon={<Vote className="w-4 h-4" />} 
                label="Attendance" 
                value={score.attendance_percentage ? `${score.attendance_percentage}%` : 'N/A'} 
              />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-bold text-xl mb-4">Ideology Profile</h2>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-4 space-y-2">
              <p>
                Alignment scores are on a -10 to +10 scale. Higher positive values indicate a more traditional or establishment stance for that axis; negative values indicate progressive or reformist leanings.
              </p>
              <div>
                Confidence: {formatConfidence(score.ideology?.tdTotalWeight)} ({score.ideology?.tdTotalWeight?.toFixed(1) || 0} signal weight)
              </div>
            </div>
            <div className="space-y-3">
              {IDEOLOGY_DIMENSION_LABELS &&
                Object.entries(IDEOLOGY_DIMENSION_LABELS).map(([dimension, label]) => {
                  const rawValue = score.ideology?.td?.[dimension] ?? 0;
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

            {(score.ideology?.party || score.ideology?.partyTotalWeight) && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                  Party average ({score.party || 'Independent'})
                </h3>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
                  Signals: {formatConfidence(score.ideology?.partyTotalWeight)} ({score.ideology?.partyTotalWeight?.toFixed(1) || 0} weight)
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                  {Object.entries(IDEOLOGY_SHORT_LABELS).map(([dimension, shortLabel]) => (
                    <div key={dimension} className="flex justify-between">
                      <span>{shortLabel}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {Number(score.ideology?.party?.[dimension] ?? 0).toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!score.ideology?.tdTotalWeight && (
              <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                No recorded statements or news signals yet. As we collect more policy stances, this profile will update automatically.
              </div>
            )}
          </Card>

          {/* Polling Section */}
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200">
            <h2 className="font-bold text-xl mb-4 flex items-center gap-2">
              <LineChart className="w-5 h-5 text-purple-600" />
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
              {componentList.map((component) => (
                <PerformanceBar
                  key={component.label}
                  label={component.label}
                  score={component.score}
                  weight={component.weightLabel}
                  color={component.color}
                  description={component.description}
                  breakdown={component.breakdown}
                  available={component.available}
                />
              ))}
            </div>
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

          {/* Committees */}
          {score.committees && score.committees.length > 0 && (
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Committee Memberships
              </h2>
              <div className="grid md:grid-cols-2 gap-3">
                {score.committees.map((committee: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {committee.name || committee}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

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
    purple: 'bg-purple-500',
    orange: 'bg-orange-500'
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
                  <span>
                    {item.score}/100
                    {typeof item.weight_percent === 'number' && (
                      <span className="ml-2 text-[10px] text-gray-500 dark:text-gray-400">{item.weight_percent}% weight</span>
                    )}
                  </span>
                </div>
                {item.detail && (
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{item.detail}</p>
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

