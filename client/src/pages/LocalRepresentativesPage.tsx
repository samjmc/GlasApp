/**
 * Local Representatives Page
 * Shows TD scores and news articles for user's constituency
 */

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Info, 
  ExternalLink,
  Star,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useState } from 'react';

export default function LocalRepresentativesPage() {
  const [selectedConstituency, setSelectedConstituency] = useState('Dublin Central');

  const { data: localTDs, isLoading } = useQuery({
    queryKey: ['td-scores', selectedConstituency],
    queryFn: async () => {
      const res = await fetch(`/api/td-scores/constituency/${encodeURIComponent(selectedConstituency)}`);
      if (!res.ok) throw new Error('Failed to fetch TD scores');
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your local representatives...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">
          Your Local Representatives
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          AI-powered scoring of TDs based on news analysis. Scores update daily.
        </p>
      </div>

      {/* Info Banner */}
      <Card className="p-6 mb-6 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
              How Scores Work
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Each TD starts at 1500 points. News articles are analyzed daily by AI for impact on 5 dimensions: 
              Transparency, Effectiveness, Integrity, Consistency, and Constituency Service. 
              Positive stories increase scores, negative stories decrease them. All scores are backed by real news articles.
            </p>
          </div>
        </div>
      </Card>

      {/* Constituency Selector (for demo - in production use user's location) */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Constituency:</label>
        <select 
          value={selectedConstituency}
          onChange={(e) => setSelectedConstituency(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option>Dublin Central</option>
          <option>Cork South-Central</option>
          <option>Galway West</option>
          {/* Add all 43 constituencies */}
        </select>
      </div>

      {/* TD Cards */}
      <div className="space-y-6">
        {localTDs?.tds?.length === 0 && (
          <Card className="p-12 text-center">
            <h3 className="text-xl font-semibold mb-2">No TD Scores Yet</h3>
            <p className="text-gray-600 mb-4">
              Scores will appear once the daily news scraper runs and analyzes articles.
            </p>
            <Button variant="outline">
              Run Test Scrape
            </Button>
          </Card>
        )}

        {/* Example TD Card (this will be real data once DB connected) */}
        <TDScoreCard
          td={{
            name: 'Example TD',
            constituency: 'Dublin Central',
            party: 'Fianna Fáil',
            image_url: '/favicon.png',
            overall_elo: 1580,
            transparency_elo: 1550,
            effectiveness_elo: 1620,
            integrity_elo: 1540,
            consistency_elo: 1590,
            constituency_service_elo: 1600,
            weekly_elo_change: 12,
            total_stories: 45,
            positive_stories: 28,
            negative_stories: 12,
            recent_stories: [
              {
                id: 1,
                title: 'Minister secures funding for local hospital expansion',
                summary: 'Successfully negotiated €5m in capital funding for upgrading facilities',
                source: 'Irish Times',
                published_date: '2025-10-22',
                story_type: 'achievement',
                sentiment: 'positive',
                impact_score: 7,
                url: 'https://irishtimes.com/example'
              },
              {
                id: 2,
                title: 'TD criticized for missing crucial vote on housing bill',
                summary: 'Absent from Dáil during key vote on rent controls',
                source: 'The Journal',
                published_date: '2025-10-20',
                story_type: 'controversy',
                sentiment: 'negative',
                impact_score: -4,
                url: 'https://thejournal.ie/example'
              }
            ]
          }}
        />
      </div>

      {/* System Status */}
      <Card className="mt-8 p-6 bg-gray-50 dark:bg-gray-800/50">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          System Status
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-600 dark:text-gray-400">Last Update</div>
            <div className="font-semibold">Pending DB Connection</div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400">News Sources</div>
            <div className="font-semibold">6 Irish outlets</div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400">TDs Tracked</div>
            <div className="font-semibold">160 current</div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400">Update Frequency</div>
            <div className="font-semibold">Daily 6:00 AM</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TDScoreCard({ td }: { td: any }) {
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex flex-col md:flex-row gap-6">
        {/* TD Profile */}
        <div className="flex items-start gap-4 md:w-1/3">
          <img 
            src={td.image_url || '/favicon.png'} 
            alt={td.name}
            className="w-20 h-20 rounded-full object-cover ring-2 ring-emerald-500/20"
          />
          
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-1">{td.name}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {td.party}
            </p>
            <p className="text-sm text-gray-500">
              {td.constituency}
            </p>
            
            {/* Overall Score */}
            <div className="mt-3">
              <div className="text-3xl font-bold text-emerald-600">
                {td.overall_elo}
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                {td.weekly_elo_change >= 0 ? '+' : ''}{td.weekly_elo_change} this week
                {td.weekly_elo_change >= 0 ? 
                  <TrendingUp className="w-3 h-3 text-green-500" /> : 
                  <TrendingDown className="w-3 h-3 text-red-500" />
                }
              </div>
            </div>
          </div>
        </div>
        
        {/* Scores Grid */}
        <div className="md:w-2/3">
          {/* Dimensional Scores */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            <ScorePill label="Transparency" score={td.transparency_elo} />
            <ScorePill label="Effectiveness" score={td.effectiveness_elo} />
            <ScorePill label="Integrity" score={td.integrity_elo} />
            <ScorePill label="Consistency" score={td.consistency_elo} />
            <ScorePill label="Service" score={td.constituency_service_elo} />
          </div>
          
          {/* Story Stats */}
          <div className="flex items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="w-4 h-4" />
              {td.positive_stories} positive
            </div>
            <div className="flex items-center gap-1 text-red-600">
              <AlertCircle className="w-4 h-4" />
              {td.negative_stories} negative
            </div>
            <div className="text-gray-500">
              {td.neutral_stories} neutral
            </div>
          </div>
          
          {/* Recent Stories */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              📰 Recent News ({td.recent_stories?.length || 0})
            </h3>
            
            {td.recent_stories?.map((story: any) => (
              <div key={story.id} className="mb-3 pb-3 last:mb-0 last:pb-0 border-b last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <a 
                      href={story.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:text-emerald-600 flex items-center gap-1 group"
                    >
                      <span className="truncate">{story.title}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {story.summary}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge 
                        variant={
                          story.sentiment.includes('positive') ? 'success' : 
                          story.sentiment.includes('negative') ? 'destructive' : 
                          'secondary'
                        } 
                        className="text-xs capitalize"
                      >
                        {story.story_type.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-gray-500">{story.source}</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">{formatDate(story.published_date)}</span>
                    </div>
                  </div>
                  
                  <div className={`text-sm font-bold flex-shrink-0 ${story.impact_score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {story.impact_score >= 0 ? '+' : ''}{story.impact_score}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ScorePill({ label, score }: { label: string; score: number }) {
  const getColor = (score: number) => {
    if (score >= 1700) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    if (score >= 1600) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    if (score >= 1500) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    if (score >= 1400) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
    if (score >= 1300) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  };
  
  return (
    <div className={`text-center p-2 rounded-lg ${getColor(score)} transition-colors`}>
      <div className="text-xs font-medium truncate">{label}</div>
      <div className="text-sm font-bold">{score}</div>
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  
  return date.toLocaleDateString('en-IE', { month: 'short', day: 'numeric' });
}



