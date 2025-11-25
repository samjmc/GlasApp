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
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  BarChart3,
  Crown,
  Calendar,
  ExternalLink,
  MessageSquare,
  Vote,
  ChevronLeft,
  Share2,
  Building2,
  Target,
  Scale
} from 'lucide-react';
import { PartyPollingWidget } from '@/components/PartyPollingWidget';

export default function PartyProfilePage() {
  const { name } = useParams<{ name: string }>();
  
  const { data: partyData, isLoading, error } = useQuery({
    queryKey: ['party-profile', name],
    queryFn: async () => {
      const res = await fetch(`/api/parliamentary/scores/parties`);
      if (!res.ok) {
        if (res.status >= 500) throw new Error('Server error - please try again later');
        throw new Error('Failed to load party data');
      }
      const data = await res.json();
      const party = data.parties?.find((p: any) => 
        p.name.toLowerCase() === (name || '').toLowerCase()
      );
      if (!party) throw new Error('PARTY_NOT_FOUND');
      return party;
    },
    enabled: !!name,
    retry: (failureCount, error) => {
      // Don't retry if party not found
      if (error instanceof Error && error.message === 'PARTY_NOT_FOUND') return false;
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
  
  const party = partyData;
  
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
  
  const overallScore = party.overall_score || 50;
  const rating = getScoreRating(overallScore);
  
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
  
  const getDimensionColor = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 7) return value > 0 ? 'bg-blue-600' : 'bg-red-600';
    if (absValue >= 4) return value > 0 ? 'bg-blue-500' : 'bg-red-500';
    if (absValue >= 2) return value > 0 ? 'bg-blue-400' : 'bg-red-400';
    return 'bg-gray-400';
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
      <div className="relative overflow-hidden rounded-2xl mb-6 border-2" style={{ borderColor: party.color }}>
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900 to-gray-800 opacity-95"></div>
        <div className="relative z-10 p-8 md:p-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start gap-6">
              {party.logo ? (
                <div className="w-20 h-20 rounded-lg bg-white p-2 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <img 
                    src={party.logo} 
                    alt={`${party.name} logo`}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
                  style={{ backgroundColor: party.color }}
                >
                  {party.abbreviation || party.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                  {party.name}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-gray-300">
                  <Badge variant="outline" className="bg-white/10 text-white border-white/30">
                    {party.government_status === 'coalition' ? '👔 Government' : '📢 Opposition'}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{party.active_members} Active TDs</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Overall Score */}
            <div className="text-center md:text-right">
              <div className="text-6xl font-bold text-white mb-2">
                {overallScore}<span className="text-3xl text-gray-400">/100</span>
              </div>
              <Badge className={`${rating.bgColor} ${rating.color} border-2 ${rating.borderColor} text-sm px-4 py-1`}>
                {rating.label}
              </Badge>
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
                <span className="font-bold text-lg">#{party.rank}</span>
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
                value={party.active_members} 
              />
              <StatRow 
                icon={<MessageSquare className="w-4 h-4" />} 
                label="Avg Questions per TD" 
                value={party.transparency_score || 0} 
              />
              <StatRow 
                icon={<Vote className="w-4 h-4" />} 
                label="Avg Votes per TD" 
                value={party.policy_consistency_score || 0} 
              />
              <StatRow 
                icon={<Building2 className="w-4 h-4" />} 
                label="Status" 
                value={party.government_status === 'coalition' ? 'Government' : 'Opposition'} 
              />
            </div>
          </Card>

          {/* Party TDs List */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Active TDs ({party.active_members})
            </h2>
            <PartyTDsList partyName={party.name} />
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
                label="Parliamentary Activity"
                score={party.parliamentary_activity_score || 50}
                color="blue"
                description={`Avg ${party.parliamentary_activity_score || 50}/100 across ${party.active_members} TDs`}
              />
              <PerformanceBar 
                label="Transparency"
                score={Math.min(100, (party.transparency_score || 0))}
                color="cyan"
                description={`Avg ${party.transparency_score || 0} questions per TD`}
              />
              <PerformanceBar 
                label="Policy Consistency"
                score={Math.min(100, (party.policy_consistency_score || 0) / 2)}
                color="purple"
                description={`Avg ${party.policy_consistency_score || 0} votes per TD`}
              />
            </div>
          </Card>

          {/* 8 Dimensional Political Compass */}
          <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-2 border-indigo-200">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Scale className="w-6 h-6 text-indigo-600" />
              8-Dimensional Political Compass
            </h2>
            
            <div className="space-y-4">
              <DimensionBar
                label="Economic"
                value={party.ideology?.economic || 0}
                leftLabel="Left-wing"
                rightLabel="Right-wing"
                description={getDimensionLabel('economic', party.ideology?.economic || 0)}
              />
              <DimensionBar
                label="Social"
                value={party.ideology?.social || 0}
                leftLabel="Progressive"
                rightLabel="Conservative"
                description={getDimensionLabel('social', party.ideology?.social || 0)}
              />
              <DimensionBar
                label="Cultural"
                value={party.ideology?.cultural || 0}
                leftLabel="Progressive"
                rightLabel="Traditional"
                description={getDimensionLabel('cultural', party.ideology?.cultural || 0)}
              />
              <DimensionBar
                label="Globalism"
                value={party.ideology?.globalism || 0}
                leftLabel="Nationalist"
                rightLabel="Globalist"
                description={getDimensionLabel('globalism', party.ideology?.globalism || 0)}
              />
              <DimensionBar
                label="Environmental"
                value={party.ideology?.environmental || 0}
                leftLabel="Industry"
                rightLabel="Green"
                description={getDimensionLabel('environmental', party.ideology?.environmental || 0)}
              />
              <DimensionBar
                label="Authority"
                value={party.ideology?.authority || 0}
                leftLabel="Libertarian"
                rightLabel="Authoritarian"
                description={getDimensionLabel('authority', party.ideology?.authority || 0)}
              />
              <DimensionBar
                label="Welfare"
                value={party.ideology?.welfare || 0}
                leftLabel="Free Market"
                rightLabel="Welfare State"
                description={getDimensionLabel('welfare', party.ideology?.welfare || 0)}
              />
              <DimensionBar
                label="Technocratic"
                value={party.ideology?.technocratic || 0}
                leftLabel="Populist"
                rightLabel="Expert-led"
                description={getDimensionLabel('technocratic', party.ideology?.technocratic || 0)}
              />
            </div>

            <div className="mt-6 pt-4 border-t border-indigo-200 dark:border-indigo-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                💡 These scores represent the party's ideological position on each dimension.
                Scores range from -10 (strongly left/progressive) to +10 (strongly right/conservative).
              </p>
            </div>
          </Card>

          {/* Public Opinion Polling Widget */}
          <PartyPollingWidget 
            partyId={party.id}
            partyName={party.name}
            performanceScore={overallScore}
          />
        </div>
      </div>
    </div>
  );
}

// Performance Bar Component
function PerformanceBar({ label, score, color, description }: {
  label: string;
  score: number;
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
        <span className="font-bold text-lg">{score}<span className="text-sm text-gray-400">/100</span></span>
      </div>
      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors[color]} transition-all duration-500`}
          style={{ width: `${score}%` }}
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
function PartyTDsList({ partyName }: { partyName: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['party-tds', partyName],
    queryFn: async () => {
      // Get all active TDs and filter by party
      const allRes = await fetch('/api/parliamentary/scores/all');
      if (!allRes.ok) throw new Error('Failed to fetch TDs');
      const allData = await allRes.json();
      
      console.log(`[PartyTDsList] Filtering for party: "${partyName}"`);
      console.log(`[PartyTDsList] Total TDs fetched: ${allData.scores?.length || 0}`);
      
      const partyTDs = (allData.scores || []).filter((td: any) => {
        const matches = td.party?.toLowerCase().trim() === partyName.toLowerCase().trim();
        if (matches) {
          console.log(`[PartyTDsList] ✓ Match: ${td.politician_name} (${td.party})`);
        }
        return matches;
      });
      
      console.log(`[PartyTDsList] Filtered to ${partyTDs.length} TDs for party "${partyName}"`);
      return { tds: partyTDs };
    }
  });

  if (isLoading) {
    return <div className="text-center py-4 text-gray-500">Loading TDs...</div>;
  }

  const tds = data?.tds || [];

  if (tds.length === 0) {
    return <div className="text-center py-4 text-gray-500 text-sm">No active TDs found</div>;
  }

  return (
    <div className="space-y-2">
      {tds.map((td: any) => (
        <Link key={td.politician_name} href={`/td/${encodeURIComponent(td.politician_name)}`}>
          <div className="group p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {td.politician_name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {td.constituency}
                </div>
              </div>
              <div className="text-right ml-2">
                <div className="text-lg font-bold text-blue-600">
                  {td.overall_score || Math.round(((td.overall_elo || 1500) - 1000) / 10)}
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
