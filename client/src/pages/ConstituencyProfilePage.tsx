/**
 * Constituency profile: who represents the area, how they score, and the party and gender mix.
 */

import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Landmark, MapPin, SearchX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/PageHeader';
import { ScoreRing } from '@/components/pulse/ScoreRing';
import { StatTile } from '@/components/pulse/Stat';
import { PartyDot, PartyLabel, TDAvatar } from '@/components/pulse/Party';
import { EmptyState } from '@/components/pulse/EmptyState';
import { RetryButton } from '@/components/data/RetryButton';
import { PartyMixBar } from '@/components/data/PartyMixBar';
import { partyStyle } from '@/lib/parties';
import { formatScore } from '@/lib/score';

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
  imageUrl?: string | null;
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

function BackLink() {
  return (
    <Link
      href="/constituencies"
      className="inline-flex min-h-11 items-center gap-1 self-start rounded-md text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      Constituencies
    </Link>
  );
}

export default function ConstituencyProfilePage() {
  const { name } = useParams<{ name: string }>();

  const { data, isLoading, isError, refetch, isFetching } = useQuery<ConstituencyDetail | null>({
    queryKey: ['constituency-profile', name],
    queryFn: async () => {
      const res = await fetch(`/api/scores/constituency/${encodeURIComponent(name || '')}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch constituency data');
      const json = await res.json();
      return json.data as ConstituencyDetail;
    },
    enabled: !!name,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-12 w-72 rounded-xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <EmptyState
          icon={SearchX}
          title={isError ? 'Could not load this constituency' : 'Constituency not found'}
          action={
            isError ? (
              <RetryButton onRetry={() => refetch()} pending={isFetching} />
            ) : (
              <Button asChild variant="secondary">
                <Link href="/constituencies">See all constituencies</Link>
              </Button>
            )
          }
        >
          {isError
            ? 'The scores service did not answer. Check your connection and try again.'
            : 'There is no Dáil constituency with that name. Pick one from the list.'}
        </EmptyState>
      </div>
    );
  }

  const leadingParty = data.parties[0];
  const g = data.genderBreakdown;
  const knownGender = (g?.male ?? 0) + (g?.female ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            Constituency
          </span>
        }
        title={data.name}
        description={`${data.tdCount} ${data.tdCount === 1 ? 'TD represents' : 'TDs represent'} this area in the Dáil.`}
        right={<ScoreRing value={data.averageScore} size={96} label="Average score" caption="average" />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="TDs" value={data.tdCount} />
        <StatTile label="Average score" value={formatScore(data.averageScore)} />
        <StatTile
          label="Leading party"
          value={<span className="text-xl">{leadingParty ? partyStyle(leadingParty.party).short : '—'}</span>}
          sub={leadingParty ? `${leadingParty.count} of ${data.tdCount} seats` : undefined}
        />
        <StatTile label="Parties" value={data.parties.length} />
      </div>

      <section aria-labelledby="tds-heading" className="flex flex-col gap-3">
        <h2 id="tds-heading" className="font-display text-xl font-bold tracking-tight">
          Your TDs
        </h2>
        {data.tds.length === 0 ? (
          <EmptyState icon={Landmark} title="No TDs listed">
            We have no sitting TDs recorded for this constituency yet.
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.tds.map((td) => (
              <li key={td.id}>
                <Link
                  href={`/td/${encodeURIComponent(td.name)}`}
                  className="flex h-full items-center gap-4 rounded-2xl border bg-card p-4 transition-colors hover:bg-elevated active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <TDAvatar name={td.name} party={td.party} imageUrl={td.imageUrl} size="lg" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="truncate font-display text-lg font-bold leading-tight tracking-tight">{td.name}</span>
                    <PartyLabel party={td.party ?? 'Independent'} />
                    <span className="flex flex-wrap gap-1.5">
                      {td.offices.length > 0 && <Badge variant="secondary">{td.offices[0].title}</Badge>}
                      {td.committees.length > 0 && (
                        <Badge variant="outline">
                          {td.committees.length} {td.committees.length === 1 ? 'committee' : 'committees'}
                        </Badge>
                      )}
                    </span>
                  </span>
                  <ScoreRing value={td.overallScore} size={56} label={`${td.name} overall score`} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl font-bold tracking-tight">Party representation</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <PartyMixBar parties={data.parties} className="h-3" />
            <ul className="flex flex-col divide-y">
              {data.parties.map((p) => (
                <li key={p.party} className="flex items-center justify-between gap-3 py-2.5">
                  <PartyLabel party={p.party} link className="text-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {p.count} {p.count === 1 ? 'seat' : 'seats'} ·{' '}
                    <span className="font-display font-bold text-foreground">{p.percentage}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl font-bold tracking-tight">Gender split</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {knownGender === 0 ? (
              <EmptyState title="Not recorded yet">Gender is not recorded for these TDs yet.</EmptyState>
            ) : (
              <>
                <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                  <span className="h-full rounded-l-full bg-primary" style={{ width: `${(g.female / data.tdCount) * 100}%` }} />
                  <span className="h-full bg-foreground/60" style={{ width: `${(g.male / data.tdCount) * 100}%` }} />
                  {g.unknown > 0 && (
                    <span className="h-full flex-1 rounded-r-full border border-dashed border-input" />
                  )}
                </div>
                <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <li className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                    Women <span className="font-display font-bold">{g.female}</span>
                  </li>
                  <li className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-foreground/60" aria-hidden="true" />
                    Men <span className="font-display font-bold">{g.male}</span>
                  </li>
                  {g.unknown > 0 && (
                    <li className="inline-flex items-center gap-2 text-muted-foreground">
                      <PartyDot party={null} />
                      Not recorded {g.unknown}
                    </li>
                  )}
                </ul>
                <p className="font-display text-2xl font-bold tracking-tight">{g.femalePercentage}% women</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
