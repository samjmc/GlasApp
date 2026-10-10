/**
 * The question record (docs/plans/question-sessions.md): what ministers committed to in reply to a
 * member's question, found and quoted by a model, checked word for word and scored by code.
 *
 *   TdQuestionRecordCard   a TD profile's "Debates" tab, under the debate record
 *   QuestionRecordPanel    the Dáil record page: one question section's exchanges
 *
 * Not part of the TD score; both say so.
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, MessageSquareQuote } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/pulse/EmptyState';
import { RetryButton } from '@/components/data/RetryButton';
import { apiClient } from '@/lib/queryClient';
import { formatIsoDate } from '@/lib/isoDate';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import type { QuestionCommitmentView, QuestionFormatName, QuestionRecordView, TdQuestionRecord } from '@shared/parliamentApi';

type Envelope<T> = { success: true; data: T };
const get = <T,>(path: string) => apiClient.get<Envelope<T>>(path).then((r) => r.data);

const FORMAT_LABELS: Record<QuestionFormatName, string> = {
  oral_pq: 'Oral questions',
  topical_issue: 'Topical Issues',
  leaders_questions: "Leaders' Questions",
  rapid: 'Questions on legislation',
};
const TYPE_LABELS: Record<QuestionCommitmentView['type'], string> = {
  action: 'Specific commitment',
  follow_up: 'Follow-up (no points)',
  general: 'General undertaking (no points)',
};

/** The rules in words, shown under both views so a reader can check any number. */
function RulesNote() {
  return (
    <p className="text-[13px] leading-relaxed text-muted-foreground">
      Points under the published rules: 2 for each exchange in which a minister commits to a specific, checkable action
      in reply to a member on the other side of the House. Follow-ups (a reply, a meeting) and general undertakings are
      shown but score nothing, and so is whether a question was answered. A model found and quoted these; code checked
      every quote against the transcript and gave every point. <strong className="text-foreground">Not part of the TD score.</strong>
    </p>
  );
}

function Commitments({ items }: { items: QuestionCommitmentView[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((c, i) => (
        <li key={`${c.type}-${i}`} className="flex flex-col gap-0.5 rounded-lg bg-elevated px-3 py-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {TYPE_LABELS[c.type]} · {c.minister}
            {c.due ? ` · ${c.due}` : ''}
          </span>
          <q className="text-sm leading-relaxed">{c.quote}</q>
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

export function TdQuestionRecordCard({ tdId }: { tdId: number | undefined }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.parliament.tdQuestionRecord(tdId ?? 0),
    queryFn: () => get<TdQuestionRecord | null>(`/api/parliament/tds/${tdId}/question-record`),
    enabled: !!tdId,
    staleTime: 5 * 60 * 1000,
  });
  const [open, setOpen] = useState<string | null>(null);

  let body;
  if (isLoading || !tdId) {
    body = <Skeleton className="h-28 rounded-xl" />;
  } else if (isError) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>Could not load the question record.</span>
        <RetryButton variant="outline" size="sm" className="h-11 md:h-9" onRetry={() => refetch()} pending={isFetching} />
      </div>
    );
  } else if (!data) {
    body = (
      <EmptyState icon={MessageSquareQuote} title="No questions read yet" className="py-6">
        No question time exchange of this TD has been read yet.
      </EmptyState>
    );
  } else {
    body = (
      <>
        {data.formats.length > 0 && (
          <ul className="flex flex-col gap-2">
            {data.formats.map((f) => (
              <li key={f.format} className="flex flex-col gap-1 rounded-xl bg-elevated p-3">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-bold">{FORMAT_LABELS[f.format]}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {f.points} {f.points === 1 ? 'point' : 'points'}
                  </span>
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {f.asked} asked · a specific commitment secured in {f.securedExchanges} · {f.followUps} follow-ups
                </span>
                {f.perTen !== null && (
                  <span className="text-[13px] text-muted-foreground">
                    <strong className="text-foreground">{f.perTen}</strong> per 10 asked; backbench 75th percentile{' '}
                    {f.cohortP75 === null ? '—' : <strong className="text-foreground">{f.cohortP75}</strong>} ({f.cohortSize} TDs)
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {data.answers && (
          <p className="text-[13px] text-muted-foreground">
            As a minister: answered {data.answers.answered} exchanges; {data.answers.withClaim} with a specific figure or
            source, {data.answers.withCommitment} with a specific commitment. Shown, never scored or ranked.
          </p>
        )}
        {data.recent.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">Recent commitments to their questions</h3>
            <ul className="flex flex-col gap-2">
              {data.recent.map((x) => {
                const isOpen = open === x.exchangeId;
                return (
                  <li key={x.exchangeId} className="flex flex-col gap-2 rounded-xl border p-3">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] text-muted-foreground">
                      <span>
                        {x.date ? formatIsoDate(x.date) : ''} · {FORMAT_LABELS[x.format]}
                      </span>
                      <strong className="text-foreground">
                        {x.points} {x.points === 1 ? 'point' : 'points'}
                      </strong>
                    </span>
                    <span className="text-[15px] font-bold leading-snug">{x.title}</span>
                    <Toggle open={isOpen} onClick={() => setOpen(isOpen ? null : x.exchangeId)}>
                      {isOpen ? 'Hide' : 'Show'} what the minister said ({x.commitments.length})
                    </Toggle>
                    {isOpen && <Commitments items={x.commitments} />}
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
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <MessageSquareQuote className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Question record
        </h2>
        <span className="text-[13px] text-muted-foreground">Oral questions, Topical Issues and Leaders&apos; Questions · rules {data?.rulesVersion ?? 'q1'}</span>
      </div>
      {body}
      <RulesNote />
    </Card>
  );
}

/** One question section's exchanges on the Dáil record page; nothing for a section that is not one. */
export function QuestionRecordPanel({ sectionId }: { sectionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.parliament.questionRecord(sectionId),
    queryFn: () => get<QuestionRecordView | null>(`/api/parliament/question-records/${encodeURIComponent(sectionId)}`),
    staleTime: 5 * 60 * 1000,
  });
  if (isLoading) return <Skeleton className="h-16 rounded-xl" />;
  if (!data) return null; // not a question section, or not read yet
  return (
    <section className="flex flex-col gap-3" aria-label="Question record">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">Question record</h3>
        <span className="text-xs font-semibold text-muted-foreground">{FORMAT_LABELS[data.format]}</span>
      </div>
      <ol className="flex flex-col gap-2">
        {data.exchanges.map((x) => (
          <li key={x.exchangeId} className="flex flex-col gap-2 rounded-xl border p-3">
            <span className="flex flex-wrap items-baseline gap-x-2 text-[15px]">
              {x.askers.map((a, i) => (
                <span key={a.memberCode} className="inline-flex items-baseline gap-1">
                  {a.tdId === null ? (
                    <span className="font-bold">{a.name}</span>
                  ) : (
                    <Link href={`/td/${encodeURIComponent(a.name)}`} className="font-bold underline-offset-4 hover:underline">
                      {a.name}
                    </Link>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {a.points} {a.points === 1 ? 'point' : 'points'}
                    {i < x.askers.length - 1 ? ',' : ''}
                  </span>
                </span>
              ))}
            </span>
            {x.commitments.length > 0 ? <Commitments items={x.commitments} /> : <span className="text-[13px] text-muted-foreground">No commitment made.</span>}
          </li>
        ))}
      </ol>
      <RulesNote />
    </section>
  );
}
