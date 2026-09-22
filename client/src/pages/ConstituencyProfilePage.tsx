/**
 * Constituency Profile Page
 * Shows detailed information about a specific constituency, its TDs, and party representation
 */

import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MapPin,
  Users,
  Crown,
  Award,
  ChevronRight,
  Building2
} from 'lucide-react';

type PartyBreakdownEntry = {
  party: string;
  count: number;
  percentage: number;
};

type ConstituencyTD = {
  id: number;
  name: string;
  party: string | null;
  gender: string | null;
  overallScore: number | null;
  offices: { title: string; since?: string }[];
  committees: string[];
};

type ConstituencyDetail = {
  name: string;
  tdCount: number;
  averageScore: number | null;
  parties: PartyBreakdownEntry[];
  genderBreakdown: { male: number; female: number; unknown: number; femalePercentage: number };
  tds: ConstituencyTD[];
};

export default function ConstituencyProfilePage() {
  const { name } = useParams<{ name: string }>();

  const { data, isLoading } = useQuery<ConstituencyDetail | null>({
    queryKey: ['constituency-profile', name],
    queryFn: async () => {
      const res = await fetch(`/api/scores/constituency/${encodeURIComponent(name || '')}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch constituency data');
      const json = await res.json();
      return json.data as ConstituencyDetail;
    },
    enabled: !!name
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading constituency...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Constituency Not Found</h1>
          <p className="text-gray-600">No data available for this constituency yet.</p>
          <Link href="/constituencies">
            <Button className="mt-4">View All Constituencies</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const leadingParty = data.parties[0];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-blue-600 mb-2">
          <MapPin className="w-5 h-5" />
          <span className="text-sm font-medium">Constituency</span>
        </div>
        <h1 className="text-4xl font-bold mb-3">{data.name}</h1>
        <p className="text-xl text-gray-600">
          {data.tdCount} TDs representing this area
        </p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200">
          <div className="text-center">
            <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-blue-900">{data.tdCount}</div>
            <div className="text-sm text-blue-700">TDs</div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
          <div className="text-center">
            <Award className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-purple-900">{data.averageScore ?? 'N/A'}</div>
            <div className="text-sm text-purple-700">Avg Score</div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200">
          <div className="text-center">
            <Crown className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
            <div className="text-xl font-bold text-yellow-900 truncate">{leadingParty?.party ?? 'N/A'}</div>
            <div className="text-sm text-yellow-700">Leading Party</div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <div className="text-center">
            <Building2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-green-900">{data.parties.length}</div>
            <div className="text-sm text-green-700">Parties</div>
          </div>
        </Card>
      </div>

      {/* Gender Diversity */}
      <Card className="p-6 mb-8">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Users className="w-6 h-6" />
          Gender Representation
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>👨 Male: {data.genderBreakdown?.male || 0}</span>
            <span>👩 Female: {data.genderBreakdown?.female || 0}</span>
          </div>

          <div className="relative w-full h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-blue-500"
              style={{ width: `${100 - (data.genderBreakdown?.femalePercentage || 0)}%` }}
            />
            <div
              className="absolute top-0 h-full bg-pink-500"
              style={{
                width: `${data.genderBreakdown?.femalePercentage || 0}%`,
                left: `${100 - (data.genderBreakdown?.femalePercentage || 0)}%`
              }}
            />
          </div>

          <div className="text-center text-lg font-semibold text-purple-600">
            {data.genderBreakdown?.femalePercentage || 0}% Female
          </div>
        </div>
      </Card>

      {/* Party Breakdown */}
      <Card className="p-6 mb-8">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Building2 className="w-6 h-6" />
          Party Representation
        </h2>

        <div className="space-y-3">
          {data.parties.map((party) => (
            <div key={party.party} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="font-semibold text-gray-900 dark:text-white">
                  {party.party}
                </div>
                <Badge variant="secondary">
                  {party.count} {party.count === 1 ? 'TD' : 'TDs'}
                </Badge>
              </div>
              <div className="text-right">
                <div className="font-bold text-blue-600">{party.percentage}%</div>
                <div className="text-xs text-gray-500">of seats</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* TDs in Constituency */}
      <Card className="p-6 mb-8">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Users className="w-6 h-6" />
          Your TDs ({data.tds.length})
        </h2>

        <div className="space-y-3">
          {data.tds.map((td) => (
            <Link key={td.id} href={`/td/${encodeURIComponent(td.name)}`}>
              <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all border border-gray-200 dark:border-gray-700 hover:border-blue-300 group">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="font-semibold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                      {td.name}
                    </div>
                    {td.offices.length > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <Crown className="w-3 h-3" />
                        {td.offices[0].title}
                      </Badge>
                    )}
                    {td.gender && (
                      <span className="text-sm">{td.gender.toLowerCase() === 'male' ? '👨' : '👩'}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <Badge variant="outline">{td.party || 'Independent'}</Badge>
                    {td.committees.length > 0 && (
                      <>
                        <span>•</span>
                        <span>{td.committees.length} {td.committees.length === 1 ? 'committee' : 'committees'}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">{td.overallScore ?? 'N/A'}</div>
                    <div className="text-xs text-gray-500">Score</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
