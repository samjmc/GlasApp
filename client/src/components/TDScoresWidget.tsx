/**
 * TD Scores Widget for Homepage
 * Shows top performers, bottom performers, and biggest movers
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { Link } from 'wouter';
import { TDQuickInfoModal } from './TDQuickInfoModal';

interface TDCompactRowProps {
  td: any;
  variant: 'emerald' | 'blue' | 'red';
  showChange?: boolean;
  onInfoClick: (id: number, e: React.MouseEvent) => void;
}

function TDCompactRow({ td, variant, showChange, onInfoClick }: TDCompactRowProps) {
  const colors = {
    emerald: {
      text: 'text-emerald-900 dark:text-emerald-50',
      subtext: 'text-emerald-700 dark:text-emerald-300',
      score: 'text-emerald-600 dark:text-emerald-400',
      hover: 'hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10',
      icon: 'text-emerald-600 dark:text-emerald-400'
    },
    blue: {
      text: 'text-blue-900 dark:text-blue-50',
      subtext: 'text-blue-700 dark:text-blue-300',
      score: 'text-blue-600 dark:text-blue-400',
      hover: 'hover:bg-blue-50/50 dark:hover:bg-blue-900/10',
      icon: 'text-blue-600 dark:text-blue-400'
    },
    red: {
      text: 'text-red-900 dark:text-red-50',
      subtext: 'text-red-700 dark:text-red-300',
      score: 'text-red-600 dark:text-red-400',
      hover: 'hover:bg-red-50/50 dark:hover:bg-red-900/10',
      icon: 'text-red-600 dark:text-red-400'
    }
  };

  const style = colors[variant];
  const score = showChange 
    ? (td.change_out_of_100 || td.change) 
    : (td.overall_score || Math.round(((td.overall_elo || 1500) - 1000) / 10));

  return (
    <Link href={`/td/${encodeURIComponent(td.name)}`}>
      <div className={`group flex items-center justify-between py-2 px-3 -mx-3 rounded-lg transition-colors cursor-pointer ${style.hover}`}>
        {/* Profile Photo */}
        {td.image_url ? (
          <img 
            src={td.image_url} 
            alt={td.name}
            className="w-9 h-9 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700 flex-shrink-0 mr-3"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white text-sm font-bold border-2 border-gray-200 dark:border-gray-700 flex-shrink-0 mr-3">
            {td.name.charAt(0)}
          </div>
        )}
        
        <div className="flex-1 min-w-0 pr-3">
          <div className={`font-medium text-sm truncate ${style.text}`}>
            {td.name}
          </div>
          <div className={`text-xs truncate opacity-80 ${style.subtext}`}>
            {td.party || 'Unknown'}
          </div>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={(e) => onInfoClick(td.id, e)}
            className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded ${style.icon}`}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
          
          <div className="text-right min-w-[3rem]">
            <div className={`text-sm font-bold ${showChange ? (score > 0 ? 'text-green-600' : 'text-red-600') : style.score}`}>
              {showChange && score > 0 ? '+' : ''}{typeof score === 'number' ? score.toFixed(showChange ? 1 : 0) : 'N/A'}
            </div>
            <div className="text-[9px] uppercase tracking-wider opacity-60">
              {showChange ? 'Change' : '/100'}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function TDScoresWidget() {
  const [selectedTDId, setSelectedTDId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['td-scores-widget-v2'],
    queryFn: async () => {
      const res = await fetch('/api/parliamentary/scores/widget');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 60000
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
        <div className="animate-pulse">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                {[1, 2, 3, 4, 5].map(j => (
                  <div key={j} className="h-8 bg-gray-100 rounded"></div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border bg-white dark:bg-gray-900 shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 lg:divide-x dark:divide-gray-800">
        
        {/* Top Performers */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">Top Performers</h3>
            <Link href="/researched-tds?filter=top" className="text-xs text-emerald-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-0.5">
            {(data?.top_performers || []).slice(0, 5).map((td: any) => (
              <TDCompactRow 
                key={td.id} 
                td={td} 
                variant="emerald" 
                onInfoClick={handleInfoClick}
              />
            ))}
          </div>
        </div>

        {/* Biggest Movers */}
        <div className="space-y-3 lg:pl-12">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">Biggest Movers</h3>
            <Link href="/researched-tds?filter=movers" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-0.5">
            {(data?.biggest_movers || []).slice(0, 5).map((td: any) => (
              <TDCompactRow 
                key={td.id} 
                td={td} 
                variant="blue" 
                showChange={true}
                onInfoClick={handleInfoClick}
              />
            ))}
          </div>
        </div>

        {/* Lowest Scores */}
        <div className="space-y-3 lg:pl-12">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">Needs Improvement</h3>
            <Link href="/researched-tds?filter=bottom" className="text-xs text-red-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-0.5">
            {(data?.bottom_performers || []).slice(0, 5).map((td: any) => (
              <TDCompactRow 
                key={td.id} 
                td={td} 
                variant="red" 
                onInfoClick={handleInfoClick}
              />
            ))}
          </div>
        </div>

      </div>

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
