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

  // Get color for constituency based on active layer
  const getConstituencyColor = (constituency: any): string => {
    if (!constituency) return '#94a3b8'; // gray-400

    switch (activeLayer) {
      case 'party':
        // Color by dominant party
        const dominantParty = constituency.parties?.[0]?.party;
        return getPartyColor(dominantParty);
      
      case 'performance':
        // Color by average score
        const score = constituency.averageScore || 50;
        if (score >= 70) return '#10b981'; // green-500
        if (score >= 60) return '#3b82f6'; // blue-500
        if (score >= 50) return '#eab308'; // yellow-500
        return '#f97316'; // orange-500
      
      case 'gender':
        // Stepped color scheme based on female TD count (0-5)
        const femaleCount = constituency.genderBreakdown?.female || 0;
        switch (femaleCount) {
          case 0: return '#1e3a8a';  // Deep blue - 0 female TDs
          case 1: return '#3b82f6';  // Blue - 1 female TD
          case 2: return '#60a5fa';  // Light blue - 2 female TDs
          case 3: return '#c084fc';  // Light purple - 3 female TDs
          case 4: return '#9333ea';  // Purple - 4 female TDs
          case 5: return '#6b21a8';  // Deep purple - 5 female TDs
          default: return '#9ca3af'; // Gray fallback
        }
      
      case 'government':
        // Color by government vs opposition dominance
        const governmentParties = ['Fianna Fáil', 'Fine Gael', 'Green Party'];
        const governmentSupportingIndependents = [
          'Seán Canney', 'Marian Harkin', 'Barry Heneghan', 'Noel Grealish',
          'Michael Lowry', 'Kevin Boxer Moran', 'Verona Murphy', 'Gillian Toole'
        ];
        
        let governmentTDs = 0;
        let oppositionTDs = 0;
        
        if (constituency.tds && constituency.tds.length > 0) {
          constituency.tds.forEach((td: any) => {
            if (governmentParties.includes(td.party) || 
                governmentSupportingIndependents.includes(td.name)) {
              governmentTDs++;
            } else {
              oppositionTDs++;
            }
          });
        }
        
        if (governmentTDs === oppositionTDs) return '#fbbf24'; // Amber - Even split
        return governmentTDs > oppositionTDs ? '#10b981' : '#ef4444'; // Green or Red
      
      default:
        return '#94a3b8';
    }
  };

  const constituencies = constituenciesData?.constituencies || [];
  const selectedInfo = selectedData;

  return (
    <div className="grid lg:grid-cols-3 gap-6 relative">
      {/* Map Section */}
      <div className="lg:col-span-2 relative z-0">
        <Card className="p-6">
          {/* Layer Controls */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-5 h-5 text-gray-600" />
              <span className="font-semibold">Map Layer:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeLayer === 'party' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveLayer('party')}
                className="gap-2"
              >
                <Building2 className="w-4 h-4" />
                Party Dominance
              </Button>
              <Button
                variant={activeLayer === 'performance' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveLayer('performance')}
                className="gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                Performance
              </Button>
              <Button
                variant={activeLayer === 'gender' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveLayer('gender')}
                className="gap-2"
              >
                <Users className="w-4 h-4" />
                Gender Balance
              </Button>
              <Button
                variant={activeLayer === 'government' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveLayer('government')}
                className="gap-2"
              >
                <Crown className="w-4 h-4" />
                Government
              </Button>
            </div>
          </div>

          {/* Legend */}
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-sm font-semibold mb-2">Legend:</div>
            {activeLayer === 'party' ? (
              <div className="space-y-2">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                  Shows which party has the most TDs in each constituency
                </div>
                <div className="flex flex-wrap gap-4 text-xs">
                  <LegendItem color="#ef4444" label="Sinn Féin" />
                  <LegendItem color="#66BB6A" label="Fianna Fáil" />
                  <LegendItem color="#1e3a8a" label="Fine Gael" />
                  <LegendItem color="#e5e7eb" label="Mixed/Other" />
                </div>
              </div>
            ) : activeLayer === 'gender' ? (
              // Stepped legend for gender layer
              <div className="space-y-3">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Gender Representation
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                  Number of female TDs per constituency
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: '#1e3a8a' }}></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">0 female</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: '#3b82f6' }}></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">1 female</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: '#60a5fa' }}></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">2 female</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: '#c084fc' }}></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">3 female</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: '#9333ea' }}></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">4 female</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: '#6b21a8' }}></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">5 female</span>
                  </div>
                </div>
                <div className="text-gray-500 dark:text-gray-400 text-xs italic pt-2 border-t border-gray-200">
                  Dáil: 44 female (25.4%), 129 male (74.6%)
                </div>
              </div>
            ) : activeLayer === 'government' ? (
              // Government vs Opposition legend
              <div className="space-y-3">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Government vs Opposition Control
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                  Shows constituencies with more government or opposition TDs
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-5 rounded border-2 border-gray-400" style={{ backgroundColor: '#10b981' }}></div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Majority Government</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-5 rounded border-2 border-gray-400" style={{ backgroundColor: '#fbbf24' }}></div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Tied</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-5 rounded border-2 border-gray-400" style={{ backgroundColor: '#ef4444' }}></div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Majority Opposition</span>
                  </div>
                </div>
                <div className="text-gray-500 dark:text-gray-400 text-xs pt-2 border-t border-gray-200">
                  <div className="mb-1">Gov: FF, FG, Green + 8 Independents</div>
                  <div>89 Government • 84 Opposition</div>
                </div>
              </div>
            ) : (
              // Gradient slider for performance layer only
              <div className="space-y-2">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                  Average performance score of all TDs in each constituency
                </div>
                <div className="relative h-8 rounded-lg overflow-hidden" style={{
                  background: 'linear-gradient(to right, rgb(239, 68, 68), rgb(168, 85, 247))'
                }}>
                  <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-semibold text-white drop-shadow-md">
                    <span>
                      {Math.round(Math.min(...constituencies.map(c => c.averageScore || 0)))}
                    </span>
                    <span>
                      {Math.round(Math.max(...constituencies.map(c => c.averageScore || 0)))}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Lower Performance</span>
                  <span>Higher Performance</span>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Leaflet Map */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden relative">
            {isLoading ? (
              <div className="flex items-center justify-center h-[600px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading map data...</p>
                </div>
              </div>
            ) : (
              <>
                <OfficialElectoralMap 
                  onConstituencySelect={(name) => setSelectedConstituency(name)}
                  height="700px"
                  activeLayer={activeLayer}
                  constituenciesData={constituencies}
                />

                <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  43 constituencies displayed • Click any to see details
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Sidebar Panel */}
      <div className="lg:col-span-1 space-y-4 relative z-0">
        {selectedConstituency ? (
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                {selectedConstituency}
              </h3>
              <button
                onClick={() => setSelectedConstituency(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedInfo ? (
              <div className="space-y-4">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
                    <div className="text-2xl font-bold text-blue-600">{selectedInfo.tdCount}</div>
                    <div className="text-xs text-blue-700 dark:text-blue-300">TDs</div>
                  </div>
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200">
                    <div className="text-2xl font-bold text-purple-600">{selectedInfo.averageScore}</div>
                    <div className="text-xs text-purple-700 dark:text-purple-300">Avg Score</div>
                  </div>
                </div>

                {/* Party Breakdown */}
                <div>
                  <h4 className="font-semibold mb-2 text-sm">Party Breakdown</h4>
                  <div className="space-y-2">
                    {selectedInfo.partyBreakdown?.slice(0, 4).map((party: any) => (
                      <div key={party.party} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{party.party}</span>
                        <Badge variant="secondary">{party.count} TD{party.count > 1 ? 's' : ''}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gender Balance */}
                {selectedInfo?.genderBreakdown && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm">Gender Representation</h4>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">👨 {selectedInfo.genderBreakdown.male || 0} Male</span>
                      <span className="text-sm font-medium">👩 {selectedInfo.genderBreakdown.female || 0} Female</span>
                    </div>
                    <div className="w-full h-3 bg-gradient-to-r from-blue-400 via-gray-200 to-pink-400 rounded-full overflow-hidden">
                      <div className="h-full relative">
                        <div 
                          className="absolute left-0 top-0 h-full bg-blue-500/60"
                          style={{ width: `${100 - (selectedInfo.genderBreakdown.femalePercentage || 0)}%` }}
                        />
                        <div 
                          className="absolute right-0 top-0 h-full bg-pink-500/60"
                          style={{ width: `${selectedInfo.genderBreakdown.femalePercentage || 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-center mt-1 text-gray-600 dark:text-gray-400">
                      {selectedInfo.genderBreakdown.male || 0}M / {selectedInfo.genderBreakdown.female || 0}F
                    </div>
                  </div>
                )}

                {/* TDs List */}
                <div>
                  <h4 className="font-semibold mb-2 text-sm">Your TDs</h4>
                  <div className="space-y-2">
                    {selectedInfo.tds?.map((td: any) => (
                      <Link key={td.id} href={`/td/${encodeURIComponent(td.name)}`}>
                        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group cursor-pointer">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate group-hover:text-blue-600">
                              {td.name}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {td.party}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-blue-600">{td.score}</span>
                            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Full Details Button */}
                <Link href={`/constituency/${encodeURIComponent(selectedConstituency)}`}>
                  <Button className="w-full gap-2">
                    View Full Details
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32">
                <div className="animate-pulse text-gray-500">Loading...</div>
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-6">
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">Select a Constituency</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Click any area on the map to see detailed information
              </p>
              <div className="mt-6 text-left space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <span>43 constituencies</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span>173 TDs</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                  <span>11 political parties</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Top & Bottom 3 Performance - Shows when Performance layer is active */}
        {activeLayer === 'performance' && constituencies.length > 0 && (
          <Card className="p-6">
            <div className="space-y-6">
              {/* Top 3 Performers */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <h3 className="text-lg font-bold text-green-900 dark:text-green-100">Top 3 Performers</h3>
                </div>
                <div className="space-y-2">
                  {constituencies
                    .filter(c => c.averageScore > 0)
                    .sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0))
                    .slice(0, 3)
                    .map((constituency, index) => (
                      <div
                        key={constituency.name}
                        className="flex items-center justify-between p-3 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => setSelectedConstituency(constituency.name)}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                            ${index === 0 ? 'bg-yellow-400 text-yellow-900 shadow-lg' : ''}
                            ${index === 1 ? 'bg-gray-300 text-gray-700 shadow-md' : ''}
                            ${index === 2 ? 'bg-orange-400 text-orange-900 shadow-md' : ''}
                          `}>
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                              {constituency.name}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {constituency.tdCount} TDs
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span className="font-bold text-xl text-green-700 dark:text-green-400">
                            {constituency.averageScore}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Bottom 3 Performers */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <h3 className="text-lg font-bold text-red-900 dark:text-red-100">Bottom 3 Performers</h3>
                </div>
                <div className="space-y-2">
                  {constituencies
                    .filter(c => c.averageScore > 0)
                    .sort((a, b) => (a.averageScore || 0) - (b.averageScore || 0))
                    .slice(0, 3)
                    .map((constituency, index) => {
                      const totalConstituencies = constituencies.filter(c => c.averageScore > 0).length;
                      const rank = totalConstituencies - index; // Worst = highest rank number
                      return (
                        <div
                          key={constituency.name}
                          className="flex items-center justify-between p-3 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg border border-red-200 dark:border-red-800 hover:shadow-md transition-all cursor-pointer"
                          onClick={() => setSelectedConstituency(constituency.name)}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-red-200 text-red-900 shrink-0">
                              {rank}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                                {constituency.name}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                {constituency.tdCount} TDs
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <TrendingDown className="w-4 h-4 text-red-600" />
                            <span className="font-bold text-xl text-red-700 dark:text-red-400">
                              {constituency.averageScore}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// Helper function to get party colors
function getPartyColor(party: string): string {
  const colors: Record<string, string> = {
    'Fianna Fáil': '#66BB6A', // Green
    'Fine Gael': '#2196F3', // Blue
    'Sinn Féin': '#4CAF50', // Dark Green
    'Labour Party': '#EF5350', // Red
    'Social Democrats': '#AB47BC', // Purple
    'Green Party': '#8BC34A', // Light Green
    'People Before Profit-Solidarity': '#E91E63', // Pink
    'Aontú': '#FF9800', // Orange
    'Independent': '#9E9E9E', // Gray
    'Independent Ireland': '#00BCD4' // Cyan
  };
  return colors[party] || '#9E9E9E';
}

// Legend item component
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div 
        className="w-4 h-4 rounded border border-gray-300" 
        style={{ backgroundColor: color }} 
      />
      <span>{label}</span>
    </div>
  );
}

