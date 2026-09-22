/**
 * Constituencies Listing Page
 * Interactive map + list view of all Irish constituencies
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OfficialElectoralMap from '@/components/OfficialElectoralMap';
import {
  MapPin,
  Users,
  TrendingUp,
  ChevronRight,
  Map as MapIcon,
  List
} from 'lucide-react';

interface ConstituencyParty {
  party: string;
  count: number;
}

interface ConstituencyTD {
  id: number;
  name: string;
  party: string | null;
  overallScore: number | null;
}

interface ConstituencyListItem {
  name: string;
  tdCount: number;
  averageScore: number | null;
  parties: ConstituencyParty[];
}

interface ConstituencySummaryData {
  constituencies: ConstituencyListItem[];
  totalConstituencies: number;
  totalTds: number;
}

interface ConstituencyDetail {
  tdCount: number;
  parties?: ConstituencyParty[];
  tds?: ConstituencyTD[];
}

export default function ConstituenciesPage() {
  const [selectedConstituency, setSelectedConstituency] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  const { data: summary, isLoading } = useQuery<ConstituencySummaryData>({
    queryKey: ['constituencies-summary'],
    queryFn: async () => {
      const res = await fetch('/api/scores/constituencies/summary');
      if (!res.ok) throw new Error('Failed to fetch constituencies');
      const json = await res.json();
      return json.data as ConstituencySummaryData;
    }
  });
  const data = summary?.constituencies;
  const scoredConstituencies = (data ?? []).filter((c) => c.averageScore !== null);

  // Fetch details for selected constituency
  const { data: selectedData } = useQuery<ConstituencyDetail>({
    queryKey: ['constituency-detail', selectedConstituency],
    queryFn: async () => {
      const res = await fetch(`/api/scores/constituency/${encodeURIComponent(selectedConstituency!)}`);
      if (!res.ok) throw new Error('Failed to fetch constituency');
      const json = await res.json();
      return json.data as ConstituencyDetail;
    },
    enabled: !!selectedConstituency
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded w-1/3 mb-8"></div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-32 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-3 flex items-center gap-3">
          <MapIcon className="w-10 h-10 text-blue-600" />
          Irish Constituencies
        </h1>
        <p className="text-xl text-gray-600">
          {data?.length || 0} constituencies across Ireland
        </p>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200">
          <div className="text-center">
            <MapPin className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-blue-900">{data?.length || 0}</div>
            <div className="text-sm text-blue-700">Constituencies</div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <div className="text-center">
            <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-green-900">{summary?.totalTds ?? 0}</div>
            <div className="text-sm text-green-700">Total TDs</div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
          <div className="text-center">
            <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-purple-900">
              {scoredConstituencies.length > 0
                ? Math.round(scoredConstituencies.reduce((sum, c) => sum + (c.averageScore ?? 0), 0) / scoredConstituencies.length)
                : 'N/A'}
            </div>
            <div className="text-sm text-purple-700">Avg Score</div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200">
          <div className="text-center">
            <MapPin className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-yellow-900">
              {data && data.length > 0 ? (data.reduce((sum, c) => sum + c.tdCount, 0) / data.length).toFixed(1) : 0}
            </div>
            <div className="text-sm text-yellow-700">Avg TDs/Area</div>
          </div>
        </Card>
      </div>

      {/* View Toggle */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'map' | 'list')} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="map" className="gap-2">
            <MapIcon className="w-4 h-4" />
            Map View
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            <List className="w-4 h-4" />
            List View
          </TabsTrigger>
        </TabsList>

        {/* Map View */}
        <TabsContent value="map">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Interactive Map */}
            <div className="lg:col-span-2">
              <Card className="overflow-hidden">
                <OfficialElectoralMap 
                  onConstituencySelect={(name) => setSelectedConstituency(name)} 
                  height="700px"
                />
              </Card>
            </div>

            {/* Sidebar - Selected Constituency Details */}
            <div className="lg:col-span-1">
              {selectedConstituency && selectedData ? (
                <Card className="p-6 sticky top-6">
                  <div className="mb-4">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {selectedConstituency}
                    </h2>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>{selectedData.tdCount} TDs</span>
                    </div>
                  </div>

                  {/* Party Breakdown */}
                  <div className="mb-6">
                    <h3 className="font-semibold mb-3">Party Representation</h3>
                    <div className="space-y-2">
                      {selectedData.parties?.map((p: ConstituencyParty, idx: number) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-sm">{p.party}</span>
                          <Badge variant="secondary">
                            {p.count} {p.count === 1 ? 'TD' : 'TDs'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* TDs List */}
                  <div className="mb-6">
                    <h3 className="font-semibold mb-3">TDs</h3>
                    <div className="space-y-2">
                      {selectedData.tds?.map((td: ConstituencyTD) => (
                        <Link key={td.id} href={`/td/${encodeURIComponent(td.name)}`}>
                          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer group">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600">
                                  {td.name}
                                </div>
                                <div className="text-xs text-gray-500">{td.party}</div>
                              </div>
                              <div className="text-sm font-bold text-blue-600">
                                {td.overallScore ?? 'N/A'}
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* View Full Profile */}
                  <Link href={`/constituency/${encodeURIComponent(selectedConstituency)}`}>
                    <Button className="w-full gap-2">
                      View Full Profile
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </Card>
              ) : (
                <Card className="p-6">
                  <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                    <MapIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium mb-2">Select a Constituency</p>
                    <p className="text-sm">Click on any constituency on the map to view details</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* List View */}
        <TabsContent value="list">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data || []).map((constituency: ConstituencyListItem) => (
              <Link key={constituency.name} href={`/constituency/${encodeURIComponent(constituency.name)}`}>
                <Card className="p-6 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-300 group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors mb-2">
                        {constituency.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Users className="w-4 h-4" />
                        <span>{constituency.tdCount} TDs</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </div>

                  {/* Party Breakdown */}
                  <div className="space-y-2 mb-4">
                    {constituency.parties.slice(0, 3).map((p: ConstituencyParty, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">{p.party}</span>
                        <Badge variant="secondary" className="text-xs">
                          {p.count} {p.count === 1 ? 'TD' : 'TDs'}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  {/* Average Score */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Avg Performance</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">
                        {constituency.averageScore ?? 'N/A'}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

