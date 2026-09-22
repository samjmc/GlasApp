/**
 * TD Quick Info Modal
 * Shows enhanced TD details in a modal popup
 * Used for drilldown functionality from homepage widgets
 */

import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import {
  Users as UsersIcon,
  Award,
  Briefcase
} from 'lucide-react';

interface TDQuickInfoModalProps {
  tdId: number;
  isOpen: boolean;
  onClose: () => void;
}

interface TDSummary {
  id: number;
  name: string;
  party: string | null;
  constituency: string | null;
  overallScore: number | null;
  label: string | null;
  nationalRank: number | null;
  officeCount: number;
  committeeCount: number;
  topOffice: string | null;
  topCommittee: string | null;
}

/** Modal with quick summary info for a TD. */
export function TDQuickInfoModal({ tdId, isOpen, onClose }: TDQuickInfoModalProps) {
  const { data, isLoading } = useQuery<TDSummary>({
    queryKey: ['td-quick-info', tdId],
    queryFn: async () => {
      const res = await fetch(`/api/scores/td/${tdId}/summary`);
      if (!res.ok) throw new Error('Failed to fetch TD info');
      const json = await res.json();
      return json.data as TDSummary;
    },
    enabled: isOpen && !!tdId
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90%] max-w-md rounded-2xl p-0 overflow-hidden border-0 shadow-2xl bg-white dark:bg-gray-900">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <p className="text-sm text-gray-500">Loading details...</p>
          </div>
        ) : data ? (
          <div className="flex flex-col max-h-[85vh]">
            {/* Header with Score */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-6 pb-8 text-center relative border-b dark:border-gray-800">
               <DialogClose className="absolute right-4 top-4 rounded-full p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                <span className="sr-only">Close</span>
              </DialogClose>

              <div className="inline-flex items-center justify-center p-3 mb-4 rounded-full bg-white dark:bg-gray-800 shadow-sm ring-1 ring-emerald-100 dark:ring-emerald-900">
                 <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {data.overallScore ?? 'N/A'}
                 </div>
              </div>

              <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {data.name}
              </DialogTitle>

              <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-emerald-700 dark:text-emerald-300">{data.party || 'Independent'}</span>
                <span>•</span>
                <span>{data.constituency}</span>
              </div>
              {data.label && (
                <div className="mt-2 text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{data.label}</div>
              )}
            </div>

            {/* Content Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Key Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-1 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                    <Award className="w-3.5 h-3.5" />
                    National Rank
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {data.nationalRank ? `#${data.nationalRank}` : 'N/A'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                   <div className="flex items-center gap-2 mb-1 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                    <UsersIcon className="w-3.5 h-3.5" />
                    Committees
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {data.committeeCount} memberships
                  </div>
                </div>
              </div>

              {/* Roles Section */}
              <div className="space-y-3">
                 {data.topOffice && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-1.5 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Current Role</h4>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.topOffice}</p>
                    </div>
                  </div>
                )}

                {data.topCommittee && (
                  <div className="flex items-start gap-3">
                     <div className="mt-1 p-1.5 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      <UsersIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Primary Committee</h4>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.topCommittee}</p>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
              <Link href={`/td/${encodeURIComponent(data.name)}`}>
                <Button className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm hover:shadow transition-all">
                  View Full Profile
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-gray-500 mb-4">Unable to load information</p>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
