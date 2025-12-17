/**
 * Party Rankings Widget
 * Shows parliamentary performance rankings for political parties
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { PartyQuickInfoModal } from './PartyQuickInfoModal';

interface PartyCompactRowProps {
  party: any;
  variant: 'emerald' | 'blue' | 'purple';
  onInfoClick: (partyName: string, e: React.MouseEvent) => void;
}

function PartyCompactRow({ party, variant, onInfoClick }: PartyCompactRowProps) {
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
    purple: {
      text: 'text-purple-900 dark:text-purple-50',
      subtext: 'text-purple-700 dark:text-purple-300',
      score: 'text-purple-600 dark:text-purple-400',
      hover: 'hover:bg-purple-50/50 dark:hover:bg-purple-900/10',
      icon: 'text-purple-600 dark:text-purple-400'
    }
  };

  const style = colors[variant];

  return (
    <Link href={`/party/${encodeURIComponent(party.name)}`}>
      <div className={`group flex items-center justify-between py-2 px-3 -mx-3 rounded-lg transition-colors cursor-pointer ${style.hover}`}>
        {/* Party Logo */}
        {party.logo ? (
          <div className="w-9 h-9 rounded-lg bg-white p-1.5 flex items-center justify-center flex-shrink-0 border border-gray-200 dark:border-gray-700 mr-3">
            <img 
              src={party.logo} 
              alt={`${party.name} logo`}
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div 
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 border-2 border-gray-200 dark:border-gray-700 mr-3"
            style={{ backgroundColor: party.color }}
          >
            {party.abbreviation || party.name.substring(0, 2)}
          </div>
        )}
        
        <div className="flex-1 min-w-0 pr-3">
          <div className={`font-medium text-sm truncate ${style.text}`}>
            {party.name}
          </div>
          <div className={`text-xs truncate opacity-80 ${style.subtext}`}>
            {party.government_status === 'coalition' ? 'Government' : 'Opposition'} • {party.active_members || 0} TDs
          </div>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={(e) => onInfoClick(party.name, e)}
            className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded ${style.icon}`}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
          
          <div className="text-right min-w-[3rem]">
            <div className={`text-sm font-bold ${style.score}`}>
              {party.overall_score || 50}
            </div>
            <div className="text-[9px] uppercase tracking-wider opacity-60">
              /100
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function PartyRankingsWidget() {
  const [selectedParty, setSelectedParty] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['party-rankings-v3'],  // v3 for new design
    queryFn: async () => {
      const res = await fetch('/api/parliamentary/scores/parties');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 60000  // 1 minute
  });

  const handleInfoClick = (partyName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedParty(partyName);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
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

  const parties = data?.parties || [];
  const governmentParties = parties.filter((p: any) => p.government_status === 'coalition');
  const oppositionParties = parties.filter((p: any) => p.government_status !== 'coalition');
  const topParties = [...parties].sort((a: any, b: any) => (b.overall_score || 0) - (a.overall_score || 0)).slice(0, 5);

  return (
    <Card className="p-6 border bg-white dark:bg-gray-900 shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 lg:divide-x dark:divide-gray-800">
        
        {/* Top Performers */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">Top Performers</h3>
          </div>
          <div className="space-y-0.5">
            {topParties.map((party: any) => (
              <PartyCompactRow 
                key={party.name} 
                party={party} 
                variant="emerald" 
                onInfoClick={handleInfoClick}
              />
            ))}
          </div>
        </div>

        {/* Government Parties */}
        <div className="space-y-3 lg:pl-12">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">Government</h3>
          </div>
          <div className="space-y-0.5">
            {governmentParties.map((party: any) => (
              <PartyCompactRow 
                key={party.name} 
                party={party} 
                variant="blue" 
                onInfoClick={handleInfoClick}
              />
            ))}
          </div>
        </div>

        {/* Opposition Parties */}
        <div className="space-y-3 lg:pl-12">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">Opposition</h3>
          </div>
          <div className="space-y-0.5">
            {oppositionParties.map((party: any) => (
              <PartyCompactRow 
                key={party.name} 
                party={party} 
                variant="purple" 
                onInfoClick={handleInfoClick}
              />
            ))}
          </div>
        </div>

      </div>

      {/* Party Quick Info Modal */}
      {selectedParty && (
        <PartyQuickInfoModal
          partyName={selectedParty}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </Card>
  );
}
