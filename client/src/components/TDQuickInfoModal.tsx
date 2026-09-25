/**
 * TD quick info: a short summary of one TD in a dialog, with a link to the full profile.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Briefcase, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScoreRing } from '@/components/pulse/ScoreRing';
import { PartyLabel } from '@/components/pulse/Party';
import { StatTile } from '@/components/pulse/Stat';
import { RetryButton } from '@/components/data/RetryButton';
import { queryKeys } from '@/lib/queryKeys';

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
  const { data, isLoading, isError, refetch, isFetching } = useQuery<TDSummary>({
    queryKey: queryKeys.td.quickInfo(tdId),
    queryFn: async () => {
      const res = await fetch(`/api/scores/td/${tdId}/summary`);
      if (!res.ok) throw new Error('Failed to fetch TD info');
      const json = await res.json();
      return json.data as TDSummary;
    },
    enabled: isOpen && !!tdId,
  });

  const roles = data
    ? [
        { icon: Briefcase, label: 'Current role', value: data.topOffice },
        { icon: Users, label: 'Main committee', value: data.topCommittee },
      ].filter((r) => r.value)
    : [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <DialogTitle className="sr-only">Loading TD</DialogTitle>
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : data ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-2 text-center">
              <ScoreRing value={data.overallScore} size={96} label="Overall score" />
              <DialogTitle className="font-display text-2xl font-bold tracking-tight">{data.name}</DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <PartyLabel party={data.party ?? 'Independent'} />
                  {data.constituency && <span className="text-sm text-muted-foreground">· {data.constituency}</span>}
                </div>
              </DialogDescription>
              {data.label && <span className="text-[13px] font-semibold text-muted-foreground">{data.label}</span>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatTile label="National rank" value={data.nationalRank ? `#${data.nationalRank}` : '—'} />
              <StatTile label="Committees" value={data.committeeCount} />
            </div>

            {roles.length > 0 && (
              <dl className="flex flex-col gap-3">
                {roles.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted-foreground">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <dt className="text-[13px] text-muted-foreground">{label}</dt>
                      <dd className="text-sm font-semibold">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            )}

            <Button asChild size="lg" className="w-full">
              <Link href={`/td/${encodeURIComponent(data.name)}`}>View full profile</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <DialogTitle className="font-display text-lg font-bold">This TD did not load</DialogTitle>
            <DialogDescription>{isError ? 'Check your connection and try again.' : 'No details yet.'}</DialogDescription>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {isError && <RetryButton onRetry={() => refetch()} pending={isFetching} />}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
