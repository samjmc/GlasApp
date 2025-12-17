/**
 * Interactive Constituency Map
 * Hybrid dashboard with SVG map + sidebar panel
 * Shows all 43 Irish constituencies with layer toggles
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import OfficialElectoralMap from './OfficialElectoralMap';
import {
  Users,
  MapPin,
  Crown,
  TrendingUp,
  Building2,
  X,
  Layers,
  ChevronRight,
  TrendingDown,
  Award,
  AlertCircle
} from 'lucide-react';

type MapLayer = 'party' | 'performance' | 'gender' | 'government';

export function InteractiveConstituencyMap() {
  const [selectedConstituency, setSelectedConstituency] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<MapLayer>('party');

  // Fetch constituency data
  const { data: constituenciesData, isLoading } = useQuery({
    queryKey: ['constituency-map-data'],
    queryFn: async () => {
      const res = await fetch('/api/parliamentary/constituencies/summary');
      if (!res.ok) throw new Error('Failed to fetch constituencies summary');
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Fetch selected constituency details
  const { data: selectedData } = useQuery({
    queryKey: ['constituency-detail', selectedConstituency],
    queryFn: async () => {
      const res = await fetch(`/api/parliamentary/constituency/${encodeURIComponent(selectedConstituency!)}`);
      if (!res.ok) throw new Error('Failed to fetch constituency');
      const data = await res.json();
      return data.constituency;
    },
    enabled: !!selectedConstituency
  });

  const getConstituencyColor = (constituency: any): string => {
    // Note: logic is inside the map component usually, but we keep this helper if needed
    // The visual map component likely handles coloring internally based on passed data
    return '#94a3b8';
  };

  const constituencies = constituenciesData?.constituencies || [];
  const selectedInfo = selectedData;

  const LayerButton = ({ id, label, icon: Icon }: { id: MapLayer; label: string; icon: any }) => (
    <button
      onClick={() => setActiveLayer(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all shadow-sm border ${
        activeLayer === id
          ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Map Controls */}
      <div className="flex flex-wrap gap-2">
        <LayerButton id="party" label="Party Dominance" icon={Building2} />
        <LayerButton id="performance" label="Performance" icon={TrendingUp} />
        <LayerButton id="gender" label="Gender Balance" icon={Users} />
        <LayerButton id="government" label="Government" icon={Crown} />
      </div>

      {/* Map Container */}
      <div className="relative w-full h-[500px] lg:h-[600px] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-50 dark:bg-slate-900/50">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-500 font-medium">Loading map...</p>
            </div>
          </div>
        ) : (
          <OfficialElectoralMap
            onConstituencySelect={(name) => setSelectedConstituency(name)}
            height="100%"
            activeLayer={activeLayer}
            constituenciesData={constituencies}
          />
        )}

        {/* Floating Legend Overlay */}
        <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-xs bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-lg text-xs z-[400]">
          <div className="font-bold text-slate-900 dark:text-white mb-2 flex items-center justify-between">
            <span>
              {activeLayer === 'party' && 'Dominant Party'}
              {activeLayer === 'performance' && 'Avg TD Performance'}
              {activeLayer === 'gender' && 'Female Representation'}
              {activeLayer === 'government' && 'Gov vs Opposition'}
            </span>
          </div>
          
          {activeLayer === 'party' && (
            <div className="flex flex-wrap gap-2">
              <LegendItem color="#ef4444" label="SF" />
              <LegendItem color="#66BB6A" label="FF" />
              <LegendItem color="#1e3a8a" label="FG" />
              <LegendItem color="#e5e7eb" label="Other" />
            </div>
          )}

          {activeLayer === 'performance' && (
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500" />
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
          )}

          {activeLayer === 'gender' && (
            <div className="flex flex-wrap gap-2">
              <LegendItem color="#1e3a8a" label="0" />
              <LegendItem color="#60a5fa" label="2" />
              <LegendItem color="#9333ea" label="4+" />
            </div>
          )}

          {activeLayer === 'government' && (
            <div className="flex flex-wrap gap-2">
              <LegendItem color="#10b981" label="Gov" />
              <LegendItem color="#ef4444" label="Opp" />
              <LegendItem color="#fbbf24" label="Tied" />
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel - Slides in or appears below */}
      {selectedConstituency && (
        <div className="animate-in slide-in-from-bottom-4 duration-300">
          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <MapPin className="w-5 h-5 text-purple-600" />
                {selectedConstituency}
              </h3>
              <button
                onClick={() => setSelectedConstituency(null)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-5">
              {selectedInfo ? (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/50 text-center">
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{selectedInfo.tdCount}</div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-blue-700/70 dark:text-blue-300/70">TDs</div>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-800/50 text-center">
                      <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{selectedInfo.averageScore}</div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-purple-700/70 dark:text-purple-300/70">Avg Score</div>
                    </div>
                  </div>

                  {/* Representatives List */}
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-500" />
                      Representatives
                    </h4>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {selectedInfo.tds?.map((td: any) => (
                        <Link key={td.id} href={`/td/${encodeURIComponent(td.name)}`}>
                          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-sm transition-all cursor-pointer group bg-white dark:bg-slate-900">
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 transition-colors">
                                {td.name}
                              </div>
                              <div className="text-xs text-slate-500">
                                {td.party}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800">
                                {td.score}
                              </Badge>
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500" />
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>

                  <Link href={`/constituency/${encodeURIComponent(selectedConstituency)}`}>
                    <Button className="w-full rounded-xl h-12 text-base font-semibold shadow-lg shadow-purple-500/20">
                      View Constituency Profile
                      <ArrowRightIcon className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="py-12 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-300"></div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// Legend item component
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div 
        className="w-3 h-3 rounded-full shadow-sm" 
        style={{ backgroundColor: color }} 
      />
      <span className="text-slate-700 dark:text-slate-300 font-medium">{label}</span>
    </div>
  );
}

function ArrowRightIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}
