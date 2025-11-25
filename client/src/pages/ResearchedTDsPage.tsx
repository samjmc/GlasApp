/**
 * Researched TDs Page
 * Shows all TDs that have completed historical baseline research
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowRight,
  Search,
  Trophy,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Clock,
  CheckCircle2
} from 'lucide-react';

export default function ResearchedTDsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState<'all' | 'top' | 'bottom'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['researched-tds'],
    queryFn: async () => {
      const res = await fetch('/api/researched-tds');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const { data: stats } = useQuery({
    queryKey: ['research-stats'],
    queryFn: async () => {
      const res = await fetch('/api/researched-tds/stats');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  // Helper function to convert ELO to percentage
  const getScore = (td: any) => {
    if (td.overall_score) return td.overall_score;
    // Fallback: convert ELO to percentage (ELO - 1000) / 10
    return Math.round(((td.overall_elo || 1500) - 1000) / 10);
  };

  // Generate one-sentence description for a TD
  const getDescription = (td: any) => {
    // If we have a proper historical summary, use it
    if (td.historical_summary && !td.historical_summary.includes('Error during research')) {
      // Truncate to first sentence if needed
      const firstSentence = td.historical_summary.split('. ')[0] + '.';
      return firstSentence.length > 150 ? firstSentence.substring(0, 147) + '...' : firstSentence;
    }
    
    // Otherwise, generate a descriptive sentence from available data
    const party = td.party || 'Independent';
    const constituency = td.constituency || 'Unknown';
    const questions = (td.question_count_oral || 0) + (td.question_count_written || 0);
    const attendance = parseFloat(td.attendance_percentage || '0');
    const score = getScore(td);
    
    // Determine activity level
    let activityPhrase = '';
    if (questions > 300) activityPhrase = 'highly active parliamentarian';
    else if (questions > 150) activityPhrase = 'active TD';
    else if (questions > 50) activityPhrase = 'moderately active';
    else activityPhrase = 'TD';
    
    // Add performance context
    let performanceNote = '';
    if (score >= 60) {
      performanceNote = ` with strong performance record`;
    } else if (score >= 50) {
      performanceNote = ` showing solid engagement`;
    } else if (score >= 40) {
      performanceNote = ` with moderate parliamentary presence`;
    } else {
      performanceNote = ` focusing primarily on constituency work`;
    }
    
    // Add distinctive features
    let distinction = '';
    if (td.is_minister && td.ministerial_role) {
      distinction = ` Currently serving as ${td.ministerial_role}.`;
    } else if (td.offices && td.offices.length > 0) {
      distinction = ` Has held position of ${td.offices[0]}.`;
    } else if (attendance > 95) {
      distinction = ` Maintains excellent attendance record.`;
    } else if (questions > 200) {
      distinction = ` Asked ${questions} parliamentary questions.`;
    }
    
    return `${party} ${activityPhrase} representing ${constituency}${performanceNote}.${distinction}`;
  };

  // Filter and search TDs
  const filteredTDs = (data?.tds || []).filter((td: any) => {
    const matchesSearch = td.politician_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (td.party && td.party.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;
    
    const score = getScore(td);
    if (filterBy === 'top') return score >= 50;
    if (filterBy === 'bottom') return score < 45;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
          TD Performance Rankings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          All {data?.count || 174} active TDs ranked by performance • {data?.researched_count || 0} with AI historical research
        </p>
      </div>

      {/* Progress Banner */}
      {stats && (
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-2 border-blue-200">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500 rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100">
                  Research Progress
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {stats.stats.tds_researched} of {stats.stats.total_tds} TDs researched ({stats.stats.completion_percentage}% complete)
                </p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.stats.completion_percentage}%
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">Complete</div>
              </div>
              <div className="w-full md:w-64 bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-emerald-500 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${stats.stats.completion_percentage}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Search and Filter */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by TD name or party..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterBy === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterBy('all')}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              All TDs
            </Button>
            <Button
              variant={filterBy === 'top' ? 'default' : 'outline'}
              onClick={() => setFilterBy('top')}
              className="gap-2"
            >
              <Trophy className="w-4 h-4" />
              Top Performers
            </Button>
            <Button
              variant={filterBy === 'bottom' ? 'default' : 'outline'}
              onClick={() => setFilterBy('bottom')}
              className="gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              Needs Improvement
            </Button>
          </div>
        </div>
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between px-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredTDs.length} TDs
        </p>
        {data?.note && (
          <Badge variant="outline" className="gap-1">
            <Clock className="w-3 h-3" />
            More TDs being added
          </Badge>
        )}
      </div>

      {/* TD List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-4 bg-gray-100 rounded w-2/3"></div>
                </div>
                <div className="w-20 h-8 bg-gray-200 rounded"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredTDs.length > 0 ? (
        <div className="space-y-4">
          {filteredTDs.map((td: any) => (
            <Link 
              key={td.politician_name} 
              href={`/td/${encodeURIComponent(td.politician_name)}`}
            >
              <Card className="p-6 hover:shadow-xl transition-all border-2 border-transparent hover:border-emerald-300 dark:hover:border-emerald-600 cursor-pointer group">
                <div className="flex items-center gap-6">
                  {/* Rank Badge */}
                  <div className="flex-shrink-0">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold ${
                      td.rank <= 5 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' :
                      td.rank <= 10 ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white' :
                      'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}>
                      #{td.rank}
                    </div>
                  </div>

                  {/* TD Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {td.politician_name}
                      </h3>
                      {td.has_historical_research && (
                        <Badge variant="outline" className="text-[10px] bg-purple-50 border-purple-300 text-purple-700">
                          ✨ Researched
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {td.party || 'Unknown'}
                      </Badge>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {td.constituency || 'Unknown'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {getDescription(td)}
                    </p>
                  </div>

                  {/* Score Display */}
                  <div className="flex-shrink-0 text-right">
                    <div className="mb-2">
                      <div className={`text-4xl font-bold ${
                        getScore(td) >= 55 ? 'text-emerald-600 dark:text-emerald-400' :
                        getScore(td) >= 45 ? 'text-blue-600 dark:text-blue-400' :
                        getScore(td) >= 40 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {getScore(td)}<span className="text-2xl text-gray-400">/100</span>
                      </div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Performance Score
                      </div>
                    </div>
                    <Badge variant={
                      getScore(td) >= 55 ? 'default' :
                      getScore(td) >= 45 ? 'secondary' :
                      'outline'
                    } className="text-xs">
                      {getScore(td) >= 70 ? 'Excellent' :
                       getScore(td) >= 55 ? 'Good' :
                       getScore(td) >= 40 ? 'Average' :
                       getScore(td) >= 25 ? 'Below Average' :
                       'Poor'}
                    </Badge>
                  </div>

                  {/* Arrow Icon */}
                  <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No TDs Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your search or filter criteria
          </p>
        </Card>
      )}

      {/* Info Footer */}
      <Card className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200">
        <div className="flex items-start gap-4">
          <Sparkles className="w-6 h-6 text-purple-600 mt-1 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-lg text-purple-900 dark:text-purple-100 mb-2">
              About These Scores
            </h4>
            <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed mb-3">
              Showing all {data?.count || 174} active TDs. TDs with the "✨ Researched" badge have completed AI historical research 
              examining tribunal findings, achievements, and scandals for accurate baseline scoring. Others use default baselines 
              with real parliamentary activity data (questions, votes, attendance). All scores are 0-100 scale.
            </p>
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
                <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">
                  HISTORICAL RESEARCH
                </div>
                <div className="text-sm text-purple-900 dark:text-purple-100">
                  AI analyzes past record, tribunals, achievements
                </div>
              </div>
              <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
                <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">
                  CURRENT PERFORMANCE
                </div>
                <div className="text-sm text-purple-900 dark:text-purple-100">
                  Daily news updates, parliamentary activity
                </div>
              </div>
              <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
                <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">
                  TRANSPARENT SCORING
                </div>
                <div className="text-sm text-purple-900 dark:text-purple-100">
                  All sources documented, methodology public
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

