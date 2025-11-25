/**
 * Party Rankings Widget
 * Shows parliamentary performance rankings for political parties
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Users, TrendingUp, Building2, Info, ArrowRight } from 'lucide-react';
import { PartyQuickInfoModal } from './PartyQuickInfoModal';

export function PartyRankingsWidget() {
  const [selectedParty, setSelectedParty] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['party-rankings-v2'],  // v2 to bust cache after adding logos
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
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const parties = data?.parties || [];

  return (
    <Card className="p-6 md:p-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 shadow-lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                Party Performance Rankings
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Based on parliamentary activity and attendance
              </p>
            </div>
          </div>
        </div>

        {/* Party Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {parties.map((party: any) => (
            <div
              key={party.name}
              className="group relative"
            >
              <Link href={`/party/${encodeURIComponent(party.name)}`}>
                <div className="flex items-center justify-between gap-3 p-4 rounded-lg bg-white dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer border border-blue-100 dark:border-blue-800/30 hover:border-blue-300 shadow-sm hover:shadow-md">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Rank Badge */}
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full font-bold text-lg flex items-center justify-center text-white ${
                        party.rank === 1
                          ? 'bg-yellow-500'
                          : party.rank === 2
                          ? 'bg-gray-400'
                          : party.rank === 3
                          ? 'bg-orange-600'
                          : 'bg-blue-500'
                      }`}
                    >
                      {party.rank === 1 ? <Crown className="w-5 h-5" /> : party.rank}
                    </div>

                    {/* Party Logo */}
                    {party.logo ? (
                      <div className="w-10 h-10 rounded-lg bg-white p-1.5 flex items-center justify-center flex-shrink-0 border border-gray-200">
                        <img 
                          src={party.logo} 
                          alt={`${party.name} logo`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: party.color }}
                      >
                        {party.abbreviation || party.name.substring(0, 2)}
                      </div>
                    )}

                    {/* Party Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {party.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{ borderColor: party.color, color: party.color }}
                        >
                          {party.government_status === 'coalition' ? 'Government' : 'Opposition'}
                        </Badge>
                        <span className="text-[10px]">{party.active_members || 0} TDs</span>
                      </div>
                    </div>
                  </div>

                  {/* Score & Arrow */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleInfoClick(party.name, e)}
                      className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors opacity-0 group-hover:opacity-100"
                      title="Quick Info"
                    >
                      <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </button>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {party.overall_score}<span className="text-sm text-gray-400">/100</span>
                      </div>
                      <div className="text-[10px] text-blue-500 dark:text-blue-600 uppercase tracking-wide">
                        Score
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border border-blue-200/50">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="text-gray-700 dark:text-gray-300">
                Score based on parliamentary questions per TD & attendance
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-gray-700 dark:text-gray-300">
                {parties.length} parties ranked
              </span>
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
      </div>
    </Card>
  );
}
