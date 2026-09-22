/**
 * Party Quick Info Modal
 * Shows party analytics and member breakdown
 * Used for drilldown functionality from homepage party widgets
 */

import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import {
  Users,
  TrendingUp,
  MapPin,
  X,
  ChevronRight
} from 'lucide-react';

interface PartyQuickInfoModalProps {
  partyName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface PartyMember {
  id: number;
  name: string;
  constituency: string | null;
  overallScore: number | null;
}

interface PartyDetail {
  party: string;
  size: number;
  averageScore: number | null;
  genderBreakdown: { male: number; female: number; unknown: number; femalePercentage: number };
  constituencyCount: number;
  members: PartyMember[];
}

/** Modal with quick summary info for a political party. */
export function PartyQuickInfoModal({ partyName, isOpen, onClose }: PartyQuickInfoModalProps) {
  const { data, isLoading } = useQuery<PartyDetail>({
    queryKey: ['party-quick-info', partyName],
    queryFn: async () => {
      const res = await fetch(`/api/scores/party/${encodeURIComponent(partyName)}`);
      if (!res.ok) throw new Error('Failed to fetch party info');
      const json = await res.json();
      return json.data as PartyDetail;
    },
    enabled: isOpen && !!partyName
  });

  if (!isOpen) return null;

  const topMembers = data
    ? [...data.members].sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0)).slice(0, 5)
    : [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        {isLoading ? (
          <div className="py-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading party details...</p>
          </div>
        ) : data ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {data.party}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Key Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg p-4 border-2 border-blue-200 text-center">
                  <div className="flex items-center justify-center gap-2 text-blue-600 mb-2">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                    {data.size}
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    TDs
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border-2 border-purple-200 text-center">
                  <div className="flex items-center justify-center gap-2 text-purple-600 mb-2">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                    {data.averageScore ?? 'N/A'}
                  </div>
                  <div className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    Avg Score
                  </div>
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg p-4 border-2 border-yellow-200 text-center">
                  <div className="flex items-center justify-center gap-2 text-yellow-600 mb-2">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">
                    {data.constituencyCount}
                  </div>
                  <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Constituencies
                  </div>
                </div>
              </div>

              {/* Gender Diversity */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Gender Diversity
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">
                        👨 Male: {data.genderBreakdown?.male || 0}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        👩 Female: {data.genderBreakdown?.female || 0}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full rounded-full transition-all"
                        style={{ width: `${100 - (data.genderBreakdown?.femalePercentage || 0)}%` }}
                      />
                      <div
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all -mt-3"
                        style={{ width: `${data.genderBreakdown?.femalePercentage || 0}%`, marginLeft: `${100 - (data.genderBreakdown?.femalePercentage || 0)}%` }}
                      />
                    </div>
                    <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {data.genderBreakdown?.femalePercentage ?? 0}% Female
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Members */}
              {topMembers.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                    Top Members (by score)
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {topMembers.map((member) => (
                      <Link
                        key={member.id}
                        href={`/td/${encodeURIComponent(member.name)}`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                            {member.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {member.constituency}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            {member.overallScore ?? 'N/A'}
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Link href={`/party/${encodeURIComponent(data.party)}`} className="flex-1">
                  <Button variant="default" className="w-full gap-2">
                    <Users className="w-4 h-4" />
                    View Full Party Profile
                  </Button>
                </Link>
                <Button variant="outline" onClick={onClose} className="gap-2">
                  <X className="w-4 h-4" />
                  Close
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-gray-600">
            <p>Failed to load party details</p>
            <Button onClick={onClose} variant="outline" className="mt-4">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
