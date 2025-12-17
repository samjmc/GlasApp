/**
 * Researched TDs Page
 * Shows all TDs ranked by performance in a simple, clean list
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Search,
  Sparkles,
  Info,
  Filter,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Re-defining TDQuickInfoModal import properly below
import { TDQuickInfoModal } from '@/components/TDQuickInfoModal';


export default function ResearchedTDsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParty, setSelectedParty] = useState<string>('all');
  const [selectedConstituency, setSelectedConstituency] = useState<string>('all');
  const [selectedTDId, setSelectedTDId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['researched-tds'],
    queryFn: async () => {
      const res = await fetch('/api/researched-tds');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  // Extract unique lists for filters
  const { parties, constituencies } = useMemo(() => {
    if (!data?.tds) return { parties: [], constituencies: [] };
    
    const p = new Set<string>();
    const c = new Set<string>();
    
    data.tds.forEach((td: any) => {
      if (td.party) p.add(td.party);
      if (td.constituency) c.add(td.constituency);
    });
    
    return {
      parties: Array.from(p).sort(),
      constituencies: Array.from(c).sort()
    };
  }, [data?.tds]);

  // Helper function to convert ELO to percentage
  const getScore = (td: any) => {
    if (td.overall_score) return td.overall_score;
    // Fallback: convert ELO to percentage (ELO - 1000) / 10
    return Math.round(((td.overall_elo || 1500) - 1000) / 10);
  };

  const handleInfoClick = (tdId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedTDId(tdId);
    setIsModalOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedParty('all');
    setSelectedConstituency('all');
  };

  const hasActiveFilters = searchTerm || selectedParty !== 'all' || selectedConstituency !== 'all';

  // Filter and sort TDs
  const filteredTDs = (data?.tds || [])
    .filter((td: any) => {
      const matchesSearch = searchTerm === '' || 
        td.politician_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesParty = selectedParty === 'all' || td.party === selectedParty;
      
      const matchesConstituency = selectedConstituency === 'all' || td.constituency === selectedConstituency;

      return matchesSearch && matchesParty && matchesConstituency;
    })
    .sort((a: any, b: any) => {
        // Sort by rank/score
        return (a.rank || 999) - (b.rank || 999);
    });

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <PageHeader
        title="TD Rankings"
        description={`All ${data?.count || 174} active TDs ranked by performance`}
        className="mb-6"
      />

      {/* Filters Section */}
      <div className="space-y-3 mb-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-xl w-full"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={selectedParty} onValueChange={setSelectedParty}>
            <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-xl h-10">
              <SelectValue placeholder="All Parties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Parties</SelectItem>
              {parties.map(party => (
                <SelectItem key={party} value={party}>{party}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedConstituency} onValueChange={setSelectedConstituency}>
            <SelectTrigger className="w-full sm:w-[200px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-xl h-10">
              <SelectValue placeholder="All Constituencies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Constituencies</SelectItem>
              {constituencies.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters}
              className="h-10 px-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Simple List */}
      <Card className="bg-white dark:bg-gray-900 border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
             {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-6 h-6 bg-gray-100 rounded"></div>
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 h-4 bg-gray-100 rounded"></div>
                  <div className="w-8 h-4 bg-gray-100 rounded"></div>
                </div>
             ))}
          </div>
        ) : filteredTDs.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredTDs.map((td: any, index: number) => {
              const score = getScore(td);
              return (
                <Link 
                  key={td.politician_name} 
                  href={`/td/${encodeURIComponent(td.politician_name)}`}
                >
                  <div className="group flex items-center justify-between p-3 sm:px-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                    
                    {/* Rank & Info */}
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className="w-6 text-sm font-medium text-gray-400 text-center shrink-0">
                        {td.rank || index + 1}
                      </div>

                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                         {td.image_url ? (
                            <img 
                              src={td.image_url} 
                              alt={td.politician_name}
                              className="w-8 h-8 rounded-full object-cover border border-gray-100 dark:border-gray-800 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                              {td.politician_name.charAt(0)}
                            </div>
                          )}
                        
                        <div className="min-w-0">
                           <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                              {td.politician_name}
                            </h3>
                            {td.has_historical_research && (
                                <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                            )}
                           </div>
                           <div className="text-xs text-gray-500 truncate">
                            {td.party || 'Independent'}
                           </div>
                        </div>
                      </div>
                    </div>

                    {/* Score & Action */}
                    <div className="flex items-center gap-3 sm:gap-4 shrink-0 pl-2">
                       <button
                          onClick={(e) => handleInfoClick(td.id, e)}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Info className="w-4 h-4" />
                        </button>

                       <div className="text-right w-12">
                          <div className={`text-sm font-bold ${
                            score >= 70 ? 'text-emerald-600' :
                            score >= 50 ? 'text-blue-600' :
                            score >= 40 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {score}
                          </div>
                       </div>
                    </div>

                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500">
            <Filter className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No TDs match your filters</p>
            <Button variant="link" onClick={clearFilters} className="mt-2">
              Clear filters
            </Button>
          </div>
        )}
      </Card>

      {selectedTDId && (
        <TDQuickInfoModal
          tdId={selectedTDId}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
