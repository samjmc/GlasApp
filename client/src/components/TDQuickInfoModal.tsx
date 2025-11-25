/**
 * TD Quick Info Modal
 * Shows enhanced TD details in a modal popup
 * Used for drilldown functionality from homepage widgets
 */

import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import {
  User,
  MapPin,
  Award,
  Users as UsersIcon,
  Calendar,
  ExternalLink,
  Crown,
  Briefcase,
  TrendingUp,
  X
} from 'lucide-react';

interface TDQuickInfoModalProps {
  tdId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function TDQuickInfoModal({ tdId, isOpen, onClose }: TDQuickInfoModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['td-quick-info', tdId],
    queryFn: async () => {
      const res = await fetch(`/api/parliamentary/td/${tdId}/summary`);
      if (!res.ok) throw new Error('Failed to fetch TD info');
      const data = await res.json();
      return data.summary;
    },
    enabled: isOpen && !!tdId
  });

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        {isLoading ? (
          <div className="py-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading TD details...</p>
          </div>
        ) : data ? (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {data.name}
                  </DialogTitle>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="secondary" className="text-sm">
                      {data.party}
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      <MapPin className="w-3 h-3 mr-1" />
                      {data.constituency}
                    </Badge>
                    {data.gender && (
                      <Badge variant="outline" className="text-sm">
                        {data.gender?.toLowerCase() === 'male' ? '👨' : '👩'} {data.gender}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Performance Score */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg p-4 border-2 border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-gray-900 dark:text-white">Performance Score</span>
                  </div>
                  <div className="text-3xl font-bold text-blue-600">
                    {data.score || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Key Stats */}
              <div className="grid grid-cols-2 gap-4">
                {data.yearsInDail !== null && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Experience</span>
                    </div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {data.yearsInDail} years
                    </div>
                  </div>
                )}

                {data.committeeCount > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                      <UsersIcon className="w-4 h-4" />
                      <span className="text-sm">Committees</span>
                    </div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {data.committeeCount}
                    </div>
                  </div>
                )}

                {data.officeCount > 0 && (
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg p-3 border-2 border-yellow-200">
                    <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 mb-1">
                      <Crown className="w-4 h-4" />
                      <span className="text-sm">Offices</span>
                    </div>
                    <div className="text-xl font-bold text-yellow-800 dark:text-yellow-300">
                      {data.officeCount}
                    </div>
                  </div>
                )}
              </div>

              {/* Current Office */}
              {data.topOffice && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border-2 border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-purple-900 dark:text-purple-100">Current Position</span>
                  </div>
                  <p className="text-purple-800 dark:text-purple-200 font-medium">
                    {data.topOffice}
                  </p>
                </div>
              )}

              {/* Top Committee */}
              {data.topCommittee && (
                <div className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <UsersIcon className="w-4 h-4" />
                    <span>Primary Committee</span>
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {data.topCommittee}
                  </p>
                </div>
              )}

              {/* Wikipedia Link */}
              {data.wikipediaTitle && (
                <a
                  href={`https://en.wikipedia.org/wiki/${encodeURIComponent(data.wikipediaTitle)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="text-sm">View Wikipedia Profile</span>
                </a>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Link href={`/td/${data.name}`} className="flex-1">
                  <Button variant="default" className="w-full gap-2">
                    <User className="w-4 h-4" />
                    View Full Profile
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
            <p>Failed to load TD details</p>
            <Button onClick={onClose} variant="outline" className="mt-4">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

