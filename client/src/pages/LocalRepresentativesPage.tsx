/**
 * Local Representatives Page
 * Shows TD scores for a chosen constituency
 */

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  Info,
  Newspaper,
  Clock
} from 'lucide-react';
import { useState } from 'react';
import { queryKeys } from '@/lib/queryKeys';

type TDScore = {
  id: number;
  name: string;
  constituency: string | null;
  party: string | null;
  imageUrl: string | null;
  overallScore: number | null;
  label: string | null;
  overallElo: number;
  newsScore: number | null;
  parliamentaryScore: number | null;
  debateScore: number | null;
  eloChange7d: number;
  totalStories: number;
  lastScoredAt: string | null;
};

type ConstituencyScores = {
  name: string;
  tdCount: number;
  averageScore: number | null;
  tds: TDScore[];
};

export default function LocalRepresentativesPage() {
  const [selectedConstituency, setSelectedConstituency] = useState('Dublin Central');

  const { data: constituencyNames } = useQuery<string[]>({
    queryKey: queryKeys.constituencies.list(),
    queryFn: async () => {
      const res = await fetch('/api/scores/constituencies');
      if (!res.ok) throw new Error('Failed to fetch constituencies');
      const json = await res.json();
      return ((json.data ?? []) as { name: string }[]).map((c) => c.name);
    },
    staleTime: 60 * 60 * 1000,
  });

  const { data: localTDs, isLoading } = useQuery<ConstituencyScores | null>({
    queryKey: queryKeys.td.constituencyScores(selectedConstituency),
    queryFn: async () => {
      const res = await fetch(`/api/scores/constituency/${encodeURIComponent(selectedConstituency)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch TD scores');
      const json = await res.json();
      return json.data as ConstituencyScores;
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

  const tds = localTDs?.tds ?? [];
  const lastScoredAt = tds
    .map((td) => td.lastScoredAt)
    .filter((at): at is string => !!at)
    .sort()
    .pop();

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">
          Your Local Representatives
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          AI-powered scoring of TDs based on news analysis and parliamentary records. Scores update daily.
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
              Each TD starts at 1500 Elo points. News articles are analysed daily by AI and move the rating up or down;
              parliamentary activity and debate contributions add their own components. The overall score is shown on a
              0-100 scale.
            </p>
          </div>
        </div>
      </Card>

      {/* Constituency Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Constituency:</label>
        <select
          value={selectedConstituency}
          onChange={(e) => setSelectedConstituency(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          {(constituencyNames ?? [selectedConstituency]).map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* TD Cards */}
      <div className="space-y-6">
        {tds.length === 0 && (
          <Card className="p-12 text-center">
            <h3 className="text-xl font-semibold mb-2">No TD Scores Yet</h3>
            <p className="text-gray-600 mb-4">
              Scores will appear once the daily news scraper runs and analyzes articles.
            </p>
          </Card>
        )}

        {tds.map((td) => (
          <TDScoreCard key={td.id} td={td} />
        ))}
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
            <div className="font-semibold">
              {lastScoredAt ? new Date(lastScoredAt).toLocaleDateString('en-IE') : 'Not yet scored'}
            </div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400">TDs in constituency</div>
            <div className="font-semibold">{localTDs?.tdCount ?? 0}</div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400">Average Score</div>
            <div className="font-semibold">{localTDs?.averageScore ?? 'N/A'}</div>
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

function TDScoreCard({ td }: { td: TDScore }) {
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex flex-col md:flex-row gap-6">
        {/* TD Profile */}
        <div className="flex items-start gap-4 md:w-1/3">
          <img
            src={td.imageUrl || '/favicon.png'}
            alt={td.name}
            className="w-20 h-20 rounded-full object-cover ring-2 ring-emerald-500/20"
          />

          <div className="flex-1">
            <h2 className="text-xl font-bold mb-1">{td.name}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {td.party || 'Independent'}
            </p>
            <p className="text-sm text-gray-500">
              {td.constituency}
            </p>

            {/* Overall Score */}
            <div className="mt-3">
              <div className="text-3xl font-bold text-emerald-600">
                {td.overallScore ?? 'N/A'}
                {td.overallScore !== null && <span className="text-base text-gray-400">/100</span>}
              </div>
              {td.label && <div className="text-xs text-gray-500">{td.label}</div>}
              <div className="text-xs text-gray-500 flex items-center gap-1">
                {td.eloChange7d >= 0 ? '+' : ''}{td.eloChange7d} Elo this week
                {td.eloChange7d >= 0 ?
                  <TrendingUp className="w-3 h-3 text-green-500" /> :
                  <TrendingDown className="w-3 h-3 text-red-500" />
                }
              </div>
            </div>
          </div>
        </div>

        {/* Scores Grid */}
        <div className="md:w-2/3">
          {/* Component Scores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <ScorePill label="Overall" score={td.overallScore} />
            <ScorePill label="News" score={td.newsScore} />
            <ScorePill label="Parliament" score={td.parliamentaryScore} />
            <ScorePill label="Debates" score={td.debateScore} />
          </div>

          {/* Story Stats */}
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Newspaper className="w-4 h-4" />
              {td.totalStories} news stories analysed
            </div>
            <div className="text-gray-500">
              Elo {td.overallElo}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ScorePill({ label, score }: { label: string; score: number | null }) {
  const getColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
    if (score >= 70) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    if (score >= 60) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    if (score >= 50) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    if (score >= 40) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
    if (score >= 30) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  };

  return (
    <div className={`text-center p-2 rounded-lg ${getColor(score)} transition-colors`}>
      <div className="text-xs font-medium truncate">{label}</div>
      <div className="text-sm font-bold">{score ?? 'N/A'}</div>
    </div>
  );
}
