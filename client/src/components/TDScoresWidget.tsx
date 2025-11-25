/**
 * TD Scores Widget for Homepage
 * Shows top performers, bottom performers, and biggest movers
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Zap,
  Crown,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { Link } from 'wouter';
import { TDQuickInfoModal } from './TDQuickInfoModal';

// Format time ago helper
function formatTimeAgo(dateString?: string): string {
  if (!dateString) return 'Never';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${Math.floor(diffHours / 24)} days ago`;
  } catch (e) {
    return 'Recently';
  }
}

export function TDScoresWidget() {
  const [selectedTDId, setSelectedTDId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['td-scores-widget-v2'],  // v2 to bust cache after adding image_url
    queryFn: async () => {
      const res = await fetch('/api/parliamentary/scores/widget');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 60000  // 1 minute
  });

  const handleInfoClick = (tdId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedTDId(tdId);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 md:p-8 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 border-2">
    <div className="space-y-6">
      {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-gray-200 dark:border-gray-700">
        <div>
            <h2 className="text-3xl md:text-4xl font-bold flex items-center gap-3 mb-2">
              <Sparkles className="w-8 h-8 text-emerald-500" />
            TD Performance Scores
          </h2>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
            AI-powered rankings updated daily from Irish news
          </p>
        </div>
          <Link href="/researched-tds">
            <Button variant="default" size="lg" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              View All TDs
              <ArrowRight className="w-5 h-5" />
          </Button>
        </Link>
      </div>

      {/* Stacked Full-Width Cards */}
        <div className="space-y-6">
        
        {/* Top Performers - Full Width */}
        <Card className="p-6 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-2 border-emerald-200 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-emerald-500 rounded-lg">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-emerald-900 dark:text-emerald-100">Top Performers</h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Best overall scores</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(data?.top_performers || []).map((td: any, idx: number) => (
              <div key={idx} className="group relative">
                <Link 
                  href={`/td/${encodeURIComponent(td.name)}`}
                  className="block"
                >
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white dark:bg-gray-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all cursor-pointer border border-emerald-100 dark:border-emerald-800/30 hover:border-emerald-300 shadow-sm hover:shadow-md">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500 text-white font-bold text-lg flex items-center justify-center">
                        {idx + 1}
                      </div>
                      {td.image_url ? (
                        <img 
                          src={td.image_url} 
                          alt={td.name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-emerald-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center text-white text-sm font-bold border-2 border-emerald-200 flex-shrink-0">
                          {td.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                          {td.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {td.party || 'Unknown'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleInfoClick(td.id, e)}
                        className="p-1.5 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors opacity-0 group-hover:opacity-100"
                        title="Quick Info"
                      >
                        <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </button>
                      <div className="text-right">
                        <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                          {td.overall_score || Math.round(((td.overall_elo || 1500) - 1000) / 10) || 'N/A'}
                        </div>
                        <div className="text-[10px] text-emerald-500 dark:text-emerald-600 uppercase tracking-wide">
                          Score /100
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
          
          <Link href="/researched-tds?filter=top">
            <Button variant="ghost" size="sm" className="w-full mt-4 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/20">
              See Top 20 →
            </Button>
          </Link>
        </Card>
        
        {/* Biggest Movers - Full Width */}
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-2 border-blue-200 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-blue-500 rounded-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-blue-900 dark:text-blue-100">Biggest Movers</h3>
              <p className="text-xs text-blue-700 dark:text-blue-300">Last 30 days</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(data?.biggest_movers || []).map((td: any, idx: number) => (
              <div key={idx} className="group relative">
                <Link 
                  href={`/td/${encodeURIComponent(td.name)}`}
                  className="block"
                >
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer border border-blue-100 dark:border-blue-800/30 hover:border-blue-300 shadow-sm hover:shadow-md">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full font-bold text-lg flex items-center justify-center ${(td.change_out_of_100 || td.change) > 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {(td.change_out_of_100 || td.change) > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                      </div>
                      {td.image_url ? (
                        <img 
                          src={td.image_url} 
                          alt={td.name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-blue-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white text-sm font-bold border-2 border-blue-200 flex-shrink-0">
                          {td.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                          {td.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {td.reason || 'Negative news coverage'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleInfoClick(td.id, e)}
                        className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors opacity-0 group-hover:opacity-100"
                        title="Quick Info"
                      >
                        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </button>
                      <div className="text-right">
                        <div className={`text-xl font-bold ${(td.change_out_of_100 || td.change) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {(td.change_out_of_100 || td.change) > 0 ? '+' : ''}{td.change_out_of_100?.toFixed(1) || Math.round(td.change) || 0}
                        </div>
                        <div className="text-[10px] text-blue-500 dark:text-blue-600 uppercase tracking-wide">
                          Change /100
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
          
          <Link href="/researched-tds?filter=movers">
            <Button variant="ghost" size="sm" className="w-full mt-4 text-blue-700 hover:text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/20">
              See All Movers →
            </Button>
          </Link>
        </Card>

        {/* Needs Improvement - Full Width */}
        <Card className="p-6 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-200 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-red-500 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-red-900 dark:text-red-100">Needs Improvement</h3>
              <p className="text-xs text-red-700 dark:text-red-300">Lowest scores</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(data?.bottom_performers || []).map((td: any, idx: number) => (
              <div key={idx} className="group relative">
                <Link 
                  href={`/td/${encodeURIComponent(td.name)}`}
                  className="block"
                >
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white dark:bg-gray-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer border border-red-100 dark:border-red-800/30 hover:border-red-300 shadow-sm hover:shadow-md">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500 text-white font-bold text-sm flex items-center justify-center">
                        {(data?.stats?.total_tds || 200) - idx}
                      </div>
                      {td.image_url ? (
                        <img 
                          src={td.image_url} 
                          alt={td.name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-red-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center text-white text-sm font-bold border-2 border-red-200 flex-shrink-0">
                          {td.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-red-600 transition-colors">
                          {td.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {td.party || 'Unknown'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleInfoClick(td.id, e)}
                        className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors opacity-0 group-hover:opacity-100"
                        title="Quick Info"
                      >
                        <Info className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </button>
                      <div className="text-right">
                        <div className="text-xl font-bold text-red-600 dark:text-red-400">
                          {td.overall_score || Math.round(((td.overall_elo || 1500) - 1000) / 10) || 'N/A'}
                        </div>
                        <div className="text-[10px] text-red-500 dark:text-red-600 uppercase tracking-wide">
                          Score /100
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
          
          <Link href="/researched-tds?filter=bottom">
            <Button variant="ghost" size="sm" className="w-full mt-4 text-red-700 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-900/20">
              See Bottom 20 →
            </Button>
          </Link>
        </Card>
        
      </div> {/* End Stacked Cards */}
    </div> {/* End space-y-6 wrapper */}

      {/* TD Quick Info Modal */}
      {selectedTDId && (
        <TDQuickInfoModal
          tdId={selectedTDId}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </Card>
  );
}
