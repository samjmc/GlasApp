/**
 * TD Profile Page - Unified ELO Scoring Display
 * Shows comprehensive TD performance with all dimensions
 */

import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Award, Users, FileText, BarChart3, Crown, Briefcase, Calendar, ExternalLink, MapPin } from 'lucide-react';
import { TDRatingCard } from '@/components/TDRatingCard';

export default function TDProfilePage() {
  const { name } = useParams<{ name: string }>();
  
  // Fetch TD data
  const { data: scoreData, isLoading } = useQuery({
    queryKey: ['td-profile', name],
    queryFn: async () => {
      const res = await fetch(`/api/parliamentary/scores/td/${encodeURIComponent(name || '')}`);
      if (!res.ok) {
        throw new Error('Failed to fetch TD score');
      }
      const data = await res.json();
      
      // The scores endpoint returns { success: true, td: {...} } format
      // Convert to { score: {...} } format for compatibility
      if (data.td) {
        return { score: data.td };
      }
      return data;
    },
    enabled: !!name
  });
  
  const score = scoreData?.score;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading TD profile...</p>
        </div>
      </div>
    );
  }
  
  if (!score) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">TD Not Found</h1>
          <p className="text-gray-600">No performance data available for this TD yet.</p>
        </Card>
      </div>
    );
  }
  
  const getELORating = (elo: number) => {
    if (elo >= 1700) return { label: 'Excellent', color: 'text-emerald-600', bgColor: 'bg-emerald-50' };
    if (elo >= 1600) return { label: 'Very Good', color: 'text-green-600', bgColor: 'bg-green-50' };
    if (elo >= 1500) return { label: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (elo >= 1400) return { label: 'Average', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    return { label: 'Below Average', color: 'text-orange-600', bgColor: 'bg-orange-50' };
  };
  
  const rating = getELORating(score.overall_elo);
  const confidencePercent = Math.round(score.confidence_score * 100);
  
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">{score.politician_name}</h1>
            <p className="text-xl text-gray-600">{score.party || 'Independent'} • {score.constituency}</p>
          </div>
          
          <div className="text-right">
            <div className="text-5xl font-bold text-emerald-600 mb-1">
              {score.overall_elo}
            </div>
            <Badge className={`${rating.bgColor} ${rating.color} border-0 text-sm`}>
              {rating.label}
            </Badge>
          </div>
        </div>
      </div>
      
      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">National Rank</p>
              <p className="text-2xl font-bold">#{score.national_rank || '—'}</p>
            </div>
            <Award className="w-8 h-8 text-gray-400" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Constituency Rank</p>
              <p className="text-2xl font-bold">#{score.constituency_rank || '—'}</p>
            </div>
            <Users className="w-8 h-8 text-gray-400" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Party Rank</p>
              <p className="text-2xl font-bold">#{score.party_rank || '—'}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-gray-400" />
          </div>
        </Card>
      </div>
      
      {/* Score Breakdown */}
      <Card className="p-6 mb-8">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Score Breakdown
        </h2>
        
        <div className="space-y-4">
          <ScoreComponent 
            label="News Impact"
            score={score.news_elo}
            weight="40%"
            description={`Based on ${score.total_stories} news articles`}
          />
          <ScoreComponent 
            label="Parliamentary Activity"
            score={score.parliamentary_elo}
            weight="30%"
            description={`${score.questions_asked} questions, ${score.attendance_percentage || 0}% attendance`}
          />
          <ScoreComponent 
            label="Legislative Work"
            score={score.legislative_elo}
            weight="10%"
            description="Bills proposed & passed (coming soon)"
            comingSoon
          />
          <ScoreComponent 
            label="Constituency Service"
            score={score.constituency_work_elo}
            weight="15%"
            description="Local clinics & casework (coming soon)"
            comingSoon
          />
          <ScoreComponent 
            label="Public Trust"
            score={score.public_trust_elo}
            weight="5%"
            description="User ratings (coming soon)"
            comingSoon
          />
        </div>
      </Card>
      
      {/* Dimensional Scores */}
      <Card className="p-6 mb-8">
        <h2 className="text-xl font-bold mb-6">Performance Dimensions</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <DimensionCard 
            label="Transparency"
            score={score.transparency_elo}
            description="Openness & disclosure"
          />
          <DimensionCard 
            label="Effectiveness"
            score={score.effectiveness_elo}
            description="Gets things done"
          />
          <DimensionCard 
            label="Integrity"
            score={score.integrity_elo}
            description="Ethics & honesty"
          />
          <DimensionCard 
            label="Consistency"
            score={score.consistency_elo}
            description="Keeps promises"
          />
          <DimensionCard 
            label="Constituency Service"
            score={score.constituency_service_elo}
            description="Helps constituents"
          />
        </div>
      </Card>
      
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard 
          label="News Articles"
          value={score.total_stories}
          subtext={`${score.positive_stories} positive, ${score.negative_stories} negative`}
          icon={<FileText className="w-5 h-5" />}
        />
        <StatCard 
          label="Questions Asked"
          value={score.questions_asked}
          subtext="Parliamentary questions"
          icon={<BarChart3 className="w-5 h-5" />}
        />
        <StatCard 
          label="Attendance"
          value={score.attendance_percentage ? `${score.attendance_percentage}%` : 'N/A'}
          subtext="Dáil attendance"
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard 
          label="Data Quality"
          value={`${confidencePercent}%`}
          subtext={`${score.data_sources_count}/5 sources`}
          icon={<Award className="w-5 h-5" />}
        />
      </div>
      
      {/* Enhanced Profile Data */}
      {score.offices && score.offices.length > 0 && (
        <Card className="p-6 mb-8 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-200">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-600" />
            Government Positions
          </h2>
          <div className="space-y-2">
            {score.offices.map((office: string, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-yellow-600" />
                <span className="font-medium text-gray-900 dark:text-white">{office}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {score.committees && score.committees.length > 0 && (
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Users className="w-6 h-6" />
            Committee Memberships
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {score.committees.map((committee: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {committee.name || committee}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Background Info */}
      {(score.gender || score.yearsInDail || score.wikipediaTitle) && (
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Background</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {score.gender && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-2xl">{score.gender?.toLowerCase() === 'male' ? '👨' : '👩'}</span>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Gender</p>
                  <p className="font-medium text-gray-900 dark:text-white capitalize">{score.gender}</p>
                </div>
              </div>
            )}
            
            {score.yearsInDail !== null && score.yearsInDail !== undefined && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Experience</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {score.yearsInDail} {score.yearsInDail === 1 ? 'year' : 'years'} in Dáil
                  </p>
                </div>
              </div>
            )}

            {score.seniority && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Award className="w-6 h-6 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Seniority Level</p>
                  <p className="font-medium text-gray-900 dark:text-white">{score.seniority}</p>
                </div>
              </div>
            )}

            {score.firstElectedDate && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Calendar className="w-6 h-6 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">First Elected</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {new Date(score.firstElectedDate).toLocaleDateString('en-IE', { year: 'numeric', month: 'long' })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {score.wikipediaTitle && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <a
                href={`https://en.wikipedia.org/wiki/${encodeURIComponent(score.wikipediaTitle)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View Full Biography on Wikipedia</span>
              </a>
            </div>
          )}
        </Card>
      )}

      {/* User Rating Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Rate This TD</h2>
        <p className="text-gray-600 mb-4">
          Share your opinion on {score.politician_name}'s performance. Your rating helps build the public trust score.
        </p>
        <TDRatingCard 
          tdName={score.politician_name}
          constituency={score.constituency}
          party={score.party}
        />
      </div>
      
      {/* Info */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>How scores work:</strong> TD performance is calculated from multiple sources including news analysis,
          parliamentary activity, legislative work, and constituency service. Scores update daily as new data comes in.
          Higher scores indicate better overall performance.
        </p>
      </Card>
    </div>
  );
}

function ScoreComponent({ label, score, weight, description, comingSoon = false }: any) {
  const percentage = ((score - 1000) / 1000) * 100;
  
  return (
    <div className={`${comingSoon ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{label}</span>
          <span className="text-xs text-gray-500">{weight}</span>
          {comingSoon && <Badge variant="outline" className="text-xs">Coming Soon</Badge>}
        </div>
        <span className="text-lg font-bold">{score}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
        <div 
          className="bg-emerald-600 h-2 rounded-full transition-all"
          style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
        />
      </div>
      <p className="text-xs text-gray-600">{description}</p>
    </div>
  );
}

function DimensionCard({ label, score, description }: any) {
  const rating = score >= 1600 ? 'Excellent' : score >= 1500 ? 'Good' : score >= 1400 ? 'Average' : 'Below Avg';
  const color = score >= 1600 ? 'text-emerald-600' : score >= 1500 ? 'text-blue-600' : score >= 1400 ? 'text-yellow-600' : 'text-orange-600';
  
  return (
    <Card className="p-4 text-center hover:shadow-md transition-shadow">
      <p className="text-sm font-medium text-gray-600 mb-2">{label}</p>
      <p className={`text-3xl font-bold mb-1 ${color}`}>{score}</p>
      <p className="text-xs text-gray-500 mb-2">{rating}</p>
      <p className="text-xs text-gray-600">{description}</p>
    </Card>
  );
}

function StatCard({ label, value, subtext, icon }: any) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-600">{label}</p>
        <div className="text-gray-400">{icon}</div>
      </div>
      <p className="text-2xl font-bold mb-1">{value}</p>
      <p className="text-xs text-gray-500">{subtext}</p>
    </Card>
  );
}

