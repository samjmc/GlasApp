/**
 * The debate record (docs/plans/debate-analysis.md): what TDs said in argued debates, found and
 * quoted by a model, checked word for word and scored by code under published rules.
 *
 *   TdDebateRecordCard   a TD profile's "Debates" tab: the term figure and recent debates
 *   DebateRecordPanel    the Dáil record page: one debate's speakers, points and quotes
 *
 * Not part of the TD score; both say so.
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Scale } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/pulse/EmptyState';
import { PartyLabel } from '@/components/pulse/Party';
import { RetryButton } from '@/components/data/RetryButton';
import { apiClient } from '@/lib/queryClient';
import { formatIsoDate } from '@/lib/isoDate';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import type { DebateItemView, DebateRecordParticipant, DebateRecordView, TdDebateRecord } from '@shared/parliamentApi';

type Envelope<T> = { success: true; data: T };
const get = <T,>(path: string) => apiClient.get<Envelope<T>>(path).then((r) => r.data);

const CLAIM_LABELS: Record<NonNullable<DebateItemView['claimType']>, string> = {
  figure: 'figure',
  named_source: 'named source',
  cost: 'cost',
  date: 'date',
};

const KIND_ORDER: Record<DebateItemView['kind'], number> = { specific_claim: 0, concession: 1, question: 2, commitment: 3 };

/** The rules in words, shown under both views so a reader can check any number. */
function RulesNote() {
  return (
    <p className="text-[13px] leading-relaxed text-muted-foreground">
      Points under the published rules: 1 per specific claim (at most 3 per speech) and 3 when someone on the other side
      of the House concedes a point to them. Questions and promises are shown but score nothing; speaking time and the
      vote do not count either. A model found and quoted these; code checked every quote against the transcript and gave
      every point. Replies to other speakers are not shown yet. <strong className="text-foreground">Not part of the TD score.</strong>
    </p>
  );
}

function itemLabel(item: DebateItemView, perspective: 'speaker' | 'target'): string {
  switch (item.kind) {
    case 'specific_claim':
      return item.claimType ? `Claim · ${CLAIM_LABELS[item.claimType]}` : 'Claim';
    case 'concession':
      return perspective === 'target'
        ? `${item.speaker} conceded${item.crossesHouse ? '' : ' (same side, no points)'}`
        : `Concession to ${item.to ?? 'another speaker'}${item.crossesHouse ? '' : ' (same side)'}`;
    case 'question':
      return item.addressee ? `Question to ${item.addressee}` : 'Question';
    case 'commitment':
      return item.due ? `Promise · ${item.due}` : 'Promise';
  }
}

function ItemList({ items, perspective = 'speaker' }: { items: DebateItemView[]; perspective?: 'speaker' | 'target' }) {
  const sorted = [...items].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((item, i) => (
        <li key={`${item.kind}-${i}`} className="flex flex-col gap-0.5 rounded-lg bg-elevated px-3 py-2">
          <span className="text-xs font-semibold text-muted-foreground">{itemLabel(item, perspective)}</span>
          <q className="text-sm leading-relaxed">{item.quote}</q>
        </li>
      ))}
    </ul>
  );
}

function Toggle({ open, onClick, children }: { open: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className="inline-flex min-h-[44px] items-center gap-1 self-start text-[13px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:min-h-0"
    >
      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      {children}
    </button>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-elevated p-3">
      <span className="font-display text-2xl font-bold tracking-tight">{value.toLocaleString('en-IE')}</span>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
    </div>
  );
}

export function TdDebateRecordCard({ tdId }: { tdId: number | undefined }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.parliament.tdDebateRecord(tdId ?? 0),
    queryFn: () => get<TdDebateRecord | null>(`/api/parliament/tds/${tdId}/debate-record`),
    enabled: !!tdId,
    staleTime: 5 * 60 * 1000,
  });
  const [open, setOpen] = useState<string | null>(null);

  const heading = (
    <div className="flex flex-col gap-1">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
        <Scale className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Debate record
      </h2>
      <span className="text-[13px] text-muted-foreground">Bill stages, motions and statements · rules {data?.rulesVersion ?? 'r1'}</span>
    </div>
  );

  let body;
  if (isLoading || !tdId) {
    body = <Skeleton className="h-32 rounded-xl" />;
  } else if (isError) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>Could not load the debate record.</span>
        <RetryButton variant="outline" size="sm" className="h-11 md:h-9" onRetry={() => refetch()} pending={isFetching} />
      </div>
    );
  } else if (!data) {
    body = (
      <EmptyState icon={Scale} title="No debates read yet" className="py-6">
        This TD has not spoken in an argued debate that has been read yet.
      </EmptyState>
    );
  } else {
    const roleLabel = data.role === 'office' ? 'TDs in government office' : 'TDs not in government office';
    body = (
      <>
        <div className="flex flex-col gap-1">
          {data.pointsPerDebate === null ? (
            <span className="text-sm text-muted-foreground">
              {data.debates} {data.debates === 1 ? 'debate' : 'debates'} read: a figure needs at least {data.minDebates}.
            </span>
          ) : (
            <>
              <span className="font-display text-3xl font-bold tracking-tight">
                {data.pointsPerDebate} <span className="text-base font-semibold text-muted-foreground">points per debate</span>
              </span>
              <span className="text-[13px] text-muted-foreground">
                Over {data.debates} debates. {roleLabel}: 75th percentile{' '}
                {data.cohortP75 === null ? '—' : <strong className="text-foreground">{data.cohortP75}</strong>} ({data.cohortSize} TDs).
              </span>
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Specific claims" value={data.totals.claims} note={`${data.totals.claimPoints} points`} />
          <Stat label="Concessions won" value={data.totals.concessionsReceived} note={`${data.totals.concessionPoints} points`} />
          <Stat label="Questions asked" value={data.totals.questions} note="no points" />
          <Stat label="Promises made" value={data.totals.commitments} note="no points" />
        </div>
        {data.recent.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">Recent debates</h3>
            <ul className="flex flex-col gap-2">
              {data.recent.map((d) => {
                const isOpen = open === d.debateId;
                const said = d.items.length + d.concededToThem.length;
                return (
                  <li key={d.debateId} className="flex flex-col gap-2 rounded-xl border p-3">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] text-muted-foreground">
                      <span>{formatIsoDate(d.date)}</span>
                      <strong className="text-foreground">{d.points} {d.points === 1 ? 'point' : 'points'}</strong>
                    </span>
                    <span className="text-[15px] font-bold leading-snug">{d.title}</span>
                    {said > 0 && (
                      <Toggle open={isOpen} onClick={() => setOpen(isOpen ? null : d.debateId)}>
                        {isOpen ? 'Hide' : 'Show'} what was said ({said})
                      </Toggle>
                    )}
                    {isOpen && (
                      <div className="flex flex-col gap-2">
                        {d.items.length > 0 && <ItemList items={d.items} />}
                        {d.concededToThem.length > 0 && <ItemList items={d.concededToThem} perspective="target" />}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      {heading}
      {body}
      <RulesNote />
    </Card>
  );
}

function ParticipantRow({ p }: { p: DebateRecordParticipant }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="flex min-w-0 flex-wrap items-baseline gap-2 text-[15px]">
          {/* A member who has left the Dáil before the roster was first read has no TD page. */}
          {p.tdId === null ? (
            <span className="font-bold">{p.name}</span>
          ) : (
            <Link href={`/td/${encodeURIComponent(p.name)}`} className="font-bold underline-offset-4 hover:underline">
              {p.name}
            </Link>
          )}
          {p.party && <PartyLabel party={p.party} short className="text-xs" />}
          {p.role === 'office' && <span className="text-xs text-muted-foreground">in government office</span>}
        </span>
        <strong className="text-sm">{p.points} {p.points === 1 ? 'point' : 'points'}</strong>
      </div>
      <span className="text-[13px] text-muted-foreground">
        {p.claims} {p.claims === 1 ? 'claim' : 'claims'} · {p.concessionsReceived} conceded to them · {p.questions}{' '}
        {p.questions === 1 ? 'question' : 'questions'} · {p.commitments} {p.commitments === 1 ? 'promise' : 'promises'} ·{' '}
        {p.words.toLocaleString('en-IE')} words
      </span>
      {p.items.length > 0 && (
        <>
          <Toggle open={open} onClick={() => setOpen(!open)}>
            {open ? 'Hide' : 'Show'} what they said ({p.items.length})
          </Toggle>
          {open && <ItemList items={p.items} />}
        </>
      )}
    </li>
  );
}

/** One debate's record on the Dáil record page. `debateId` null: the section is not grouped yet. */
export function DebateRecordPanel({ debateId }: { debateId: string | null }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.parliament.debateRecord(debateId ?? ''),
    queryFn: () => get<DebateRecordView | null>(`/api/parliament/debate-records/${encodeURIComponent(debateId!)}`),
    enabled: !!debateId,
    staleTime: 5 * 60 * 1000,
  });
  if (!debateId) return null;
  if (isLoading) return <Skeleton className="h-24 rounded-xl" />;
  if (isError) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>Could not load the debate record.</span>
        <RetryButton variant="outline" size="sm" className="h-11 md:h-9" onRetry={() => refetch()} pending={isFetching} />
      </div>
    );
  }
  if (!data) return null; // not an argued debate, or not read yet
  return (
    <section className="flex flex-col gap-3" aria-label="Debate record">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">Debate record</h3>
        <span className="text-xs font-semibold text-muted-foreground">
          The whole debate{data.firstDate !== data.lastDate ? `, ${formatIsoDate(data.firstDate)} – ${formatIsoDate(data.lastDate)}` : ''} · most
          points first
        </span>
      </div>
      <ol className="flex flex-col gap-2">
        {data.participants.map((p) => (
          <ParticipantRow key={p.memberCode} p={p} />
        ))}
      </ol>
      <RulesNote />
    </section>
  );
}
