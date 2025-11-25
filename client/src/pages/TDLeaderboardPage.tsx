/**
 * TD Leaderboard - Unified ELO Rankings
 * Shows all TDs ranked by overall performance
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, TrendingDown, Award } from 'lucide-react';

export default function TDLeaderboardPage() {
  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ['td-leaderboard-v2'],  // v2 to bust cache after adding image_url
    queryFn: async () => {
      const res = await fetch('/api/unified-td-scores/leaderboard/all');
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      return res.json();
    },
    staleTime: 60000,  // 1 minute
    refetchInterval: 60000 // Refresh every minute
  });
  
  const tds = leaderboardData?.leaderboard || [];
  
  const getELORating = (elo: number) => {
    if (elo >= 1700) return { label: 'Excellent', color: 'bg-emerald-100 text-emerald-800' };
    if (elo >= 1600) return { label: 'Very Good', color: 'bg-green-100 text-green-800' };
    if (elo >= 1500) return { label: 'Good', color: 'bg-blue-100 text-blue-800' };
    if (elo >= 1400) return { label: 'Average', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Below Average', color: 'bg-orange-100 text-orange-800' };
  };
  
  const getMedalColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-500';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-orange-600';
    return 'text-gray-300';
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading TD leaderboard...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-10 h-10 text-emerald-600" />
          <h1 className="text-4xl font-bold">TD Performance Leaderboard</h1>
        </div>
          <p className="text-lg text-gray-600">
          Real-time rankings based on national impact, parliamentary effectiveness, transparency, and constituency service.
          Scores update daily as new data comes in.
        </p>
      </div>
      
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <p className="text-sm text-gray-600 mb-1">Total TDs Scored</p>
          <p className="text-3xl font-bold">{tds.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600 mb-1">Highest Score</p>
          <p className="text-3xl font-bold text-emerald-600">
            {tds[0]?.overall_elo || '—'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600 mb-1">Average Score</p>
          <p className="text-3xl font-bold">
            {tds.length > 0 ? Math.round(tds.reduce((sum: number, td: any) => sum + td.overall_elo, 0) / tds.length) : '—'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600 mb-1">Last Updated</p>
          <p className="text-sm font-medium">
            {tds[0]?.last_updated ? new Date(tds[0].last_updated).toLocaleString() : '—'}
          </p>
        </Card>
      </div>
      
      {/* Leaderboard */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-blue-600 p-6 text-white">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6" />
            National Rankings
          </h2>
        </div>
        
        <div className="divide-y">
          {tds.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-lg mb-2">No TDs scored yet</p>
              <p className="text-sm">Scores will appear as news articles mention TDs</p>
            </div>
          ) : (
            tds.map((td: any, index: number) => {
              const rank = index + 1;
              const rating = getELORating(td.overall_elo);
              const showMedal = rank <= 3;
              
              return (
                <Link
                  key={td.id}
                  href={`/td/${encodeURIComponent(td.politician_name)}`}
                  className="block hover:bg-gray-50 transition-colors"
                >
                  <div className="p-4 sm:p-6">
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="flex-shrink-0 w-12 text-center">
                        {showMedal ? (
                          <Trophy className={`w-8 h-8 mx-auto ${getMedalColor(rank)}`} />
                        ) : (
                          <div className="text-2xl font-bold text-gray-400">#{rank}</div>
                        )}
                      </div>
                      
                      {/* Profile Photo */}
                      {td.image_url ? (
                        <img 
                          src={td.image_url} 
                          alt={td.politician_name}
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-gray-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white text-lg font-bold border-2 border-gray-200 flex-shrink-0">
                          {td.politician_name.charAt(0)}
                        </div>
                      )}
                      
                      {/* TD Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold mb-1 truncate">
                          {td.politician_name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                          <span>{td.party || 'Independent'}</span>
                          <span className="text-gray-300">•</span>
                          <span>{td.constituency}</span>
                        </div>
                      </div>
                      
                      {/* Score Components */}
                      <div className="hidden md:flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">News</p>
                          <p className="text-sm font-semibold">{td.news_elo || '—'}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">Parliament</p>
                          <p className="text-sm font-semibold">{td.parliamentary_elo || '—'}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">Articles</p>
                          <p className="text-sm font-semibold">{td.total_stories || 0}</p>
                        </div>
                      </div>
                      
                      {/* Overall Score */}
                      <div className="flex-shrink-0 text-right">
                        <div className="text-3xl font-bold text-emerald-600 mb-1">
                          {td.overall_elo}
                        </div>
                        <Badge className={`${rating.color} border-0 text-xs`}>
                          {rating.label}
                        </Badge>
                        {td.weekly_elo_change !== 0 && (
                          <div className={`text-xs mt-1 flex items-center justify-end gap-1 ${
                            td.weekly_elo_change > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {td.weekly_elo_change > 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {Math.abs(td.weekly_elo_change)} (7d)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </Card>
      
      {/* Info */}
      <Card className="mt-8 p-6 bg-blue-50 border-blue-200">
        <h3 className="font-bold mb-2 flex items-center gap-2">
          <Award className="w-5 h-5 text-blue-600" />
          How Rankings Work
        </h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>
            <strong>Glas Score</strong> combines multiple performance pillars with transparent weighting:
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Impact (50%)</strong> – News coverage, sentiment shifts, and debate influence</li>
            <li><strong>Effectiveness (25%)</strong> – Parliamentary workload, legislative output, and debate effectiveness</li>
            <li><strong>Constituency Service (15%)</strong> – Clinics, casework delivery, and local focus</li>
            <li><strong>Engagement & Transparency (10%)</strong> – Attendance, disclosures, and responsiveness</li>
          </ul>
          <p className="mt-3">
            Scores update automatically as new data comes in. Click any TD to see their full performance profile and pillar breakdowns.
          </p>
        </div>
      </Card>
    </div>
  );
}

