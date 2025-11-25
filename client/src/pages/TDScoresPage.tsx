/**
 * TD Scores Full Page
 * Complete TD rankings with filters, search, and detailed views
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Info
} from 'lucide-react';

type ViewMode = 'all' | 'top' | 'bottom' | 'movers' | 'constituency' | 'party';
type SortMode = 'score' | 'change' | 'name' | 'party';

export default function TDScoresPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('score');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConstituency, setSelectedConstituency] = useState('All');
  const [selectedParty, setSelectedParty] = useState('All');

  const { data: scores, isLoading } = useQuery({
    queryKey: ['td-scores-full', viewMode, sortMode, selectedConstituency, selectedParty],
    queryFn: async () => {
      const params = new URLSearchParams({
        view: viewMode,
        sort: sortMode,
        constituency: selectedConstituency,
        party: selectedParty
      });
      const res = await fetch(`/api/td-scores?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  // Filter by search
  const filteredScores = scores?.scores?.filter((td: any) =>
    td.politician_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    td.constituency.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          TD Performance Scores
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          All 160 TDs ranked by AI analysis of daily news coverage
        </p>
      </div>

      {/* How It Works Banner */}
      <Card className="p-6 mb-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Automated AI Scoring System
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
              Every morning at 6 AM, our AI reads Irish news from 6 major sources. When a TD is mentioned,
              the article is analyzed for impact on 5 dimensions. Scores update daily based on their actions.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">Transparency</Badge>
              <Badge variant="secondary" className="text-xs">Effectiveness</Badge>
              <Badge variant="secondary" className="text-xs">Integrity</Badge>
              <Badge variant="secondary" className="text-xs">Consistency</Badge>
              <Badge variant="secondary" className="text-xs">Constituency Service</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search TDs or constituencies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* View Mode */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('all')}
          >
            All TDs
          </Button>
          <Button
            variant={viewMode === 'top' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('top')}
            className="gap-1"
          >
            <TrendingUp className="w-3 h-3" />
            Top
          </Button>
          <Button
            variant={viewMode === 'bottom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('bottom')}
            className="gap-1"
          >
            <TrendingDown className="w-3 h-3" />
            Bottom
          </Button>
        </div>

        {/* Sort */}
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="score">Sort by Score</option>
          <option value="change">Sort by Change</option>
          <option value="name">Sort by Name</option>
          <option value="party">Sort by Party</option>
        </select>
      </div>

      {/* TD List */}
      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading TD scores...</p>
          </div>
        ) : filteredScores.length === 0 ? (
          <Card className="p-12 text-center">
            <h3 className="text-xl font-semibold mb-2">No TDs Found</h3>
            <p className="text-gray-600 mb-4">
              Try adjusting your search or filters
            </p>
          </Card>
        ) : (
          filteredScores.map((td: any, idx: number) => (
            <TDScoreRow key={td.id} td={td} rank={idx + 1} />
          ))
        )}
      </div>

      {/* Coming Soon Notice */}
      {filteredScores.length === 0 && !isLoading && (
        <Card className="p-8 text-center bg-gradient-to-r from-purple-50 to-pink-50">
          <h3 className="text-xl font-bold mb-2">Scores Coming Soon!</h3>
          <p className="text-gray-700 mb-4">
            Our automated AI system is being configured. TD scores will appear once
            the daily news scraper runs for the first time.
          </p>
          <p className="text-sm text-gray-600">
            Expected launch: Within 48 hours
          </p>
        </Card>
      )}
    </div>
  );
}

function TDScoreRow({ td, rank }: { td: any; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center gap-4">
        {/* Rank */}
        <div className="text-2xl font-bold text-gray-400 w-12 text-center">
          #{rank}
        </div>

        {/* TD Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-lg">{td.politician_name}</h3>
            <Badge variant="outline" className="text-xs">{td.party}</Badge>
          </div>
          <p className="text-sm text-gray-600">{td.constituency}</p>
        </div>

        {/* Score */}
        <div className="text-right">
          <div className="text-3xl font-bold text-emerald-600">
            {td.overall_elo}
          </div>
          <div className="text-xs text-gray-500 flex items-center justify-end gap-1">
            {td.weekly_elo_change >= 0 ? '+' : ''}{td.weekly_elo_change} this week
            {td.weekly_elo_change >= 0 ? 
              <TrendingUp className="w-3 h-3 text-green-500" /> : 
              <TrendingDown className="w-3 h-3 text-red-500" />
            }
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-5 gap-2 mb-4">
            <DimensionPill label="Transparency" score={td.transparency_elo} />
            <DimensionPill label="Effectiveness" score={td.effectiveness_elo} />
            <DimensionPill label="Integrity" score={td.integrity_elo} />
            <DimensionPill label="Consistency" score={td.consistency_elo} />
            <DimensionPill label="Service" score={td.constituency_service_elo} />
          </div>
          
          <Link href={`/local-representatives?td=${encodeURIComponent(td.politician_name)}`}>
            <Button size="sm" className="gap-2">
              View Full Profile & News
              <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      )}
    </Card>
  );
}

function DimensionPill({ label, score }: { label: string; score: number }) {
  const getColor = (score: number) => {
    if (score >= 1600) return 'bg-emerald-100 text-emerald-700';
    if (score >= 1500) return 'bg-blue-100 text-blue-700';
    if (score >= 1400) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };
  
  return (
    <div className={`text-center p-2 rounded-lg ${getColor(score)}`}>
      <div className="text-xs font-medium truncate">{label}</div>
      <div className="text-sm font-bold">{score}</div>
    </div>
  );
}



