/**
 * Quick Stats Bar - Sticky stats showing at a glance info
 */

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';

export function QuickStatsBar() {
  const { data } = useQuery({
    queryKey: ['td-stats'],
    queryFn: async () => {
      const res = await fetch('/api/parliamentary/scores/widget');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    staleTime: 10 * 60 * 1000 // Cache for 10 minutes
  });

  const stats = data?.stats || {};
  const totalTDs = stats.total_tds || 160;
  const articlesAnalyzed = stats.articles_analyzed || 0;
  const lastUpdate = stats.last_update ? new Date(stats.last_update) : new Date();
  
  // Calculate time ago
  const now = new Date();
  const diffMs = now.getTime() - lastUpdate.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const timeAgo = diffHours < 1 ? 'Just now' : diffHours === 1 ? '1h ago' : `${diffHours}h ago`;

  return (
    <div className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400">👥 TDs Tracked:</span>
            <Badge variant="secondary" className="font-semibold">
              {totalTDs}
            </Badge>
          </div>
          
          <div className="hidden sm:block w-px h-4 bg-gray-300 dark:bg-gray-700"></div>
          
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400">📰 Articles:</span>
            <Badge variant="secondary" className="font-semibold">
              {articlesAnalyzed.toLocaleString()}
            </Badge>
          </div>
          
          <div className="hidden sm:block w-px h-4 bg-gray-300 dark:bg-gray-700"></div>
          
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400">🔄 Updated:</span>
            <Badge variant="secondary" className="font-semibold">
              {timeAgo}
            </Badge>
          </div>
          
          <div className="hidden md:block w-px h-4 bg-gray-300 dark:bg-gray-700"></div>
          
          <div className="hidden md:flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400">📡 Sources:</span>
            <Badge variant="secondary" className="font-semibold">
              11
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

