/**
 * The daily-vote questions a signed-in user and one TD have both answered: a one-line summary
 * by policy domain, then each question with both answers and the quote the TD's answer came from.
 */

import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { QuoteKind, SharedIssue, TdIssues } from '@shared/stancesApi';

/** `foreign_policy` → `Foreign policy`. */
export function humaniseDomain(domain: string): string {
  const text = domain.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** An ISO timestamp as "23 Sep 2026", or "" when it does not parse. */
export function formatStanceDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function QuoteKindBadge({ kind }: { kind: QuoteKind }) {
  return (
    <Badge variant="outline" className="shrink-0">
      {kind === 'direct' ? 'Direct' : 'Paraphrase'}
    </Badge>
  );
}

/** The outlet as an external link, then the date. */
export function StanceSource({ outlet, url, statedAt }: { outlet: string; url: string; statedAt: string }) {
  const date = formatStanceDate(statedAt);
  return (
    <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-1 font-semibold text-foreground underline underline-offset-4 hover:text-primary sm:min-h-0"
      >
        {outlet}
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
      {date && <span>· {date}</span>}
    </span>
  );
}

/** "Agrees on housing (2/2) · differs on foreign policy (0/1)". A domain agrees when at least half its items do. */
function summarise(items: SharedIssue[]): string {
  const order: string[] = [];
  const counts: Record<string, { agree: number; total: number }> = Object.create(null);
  items.forEach((item) => {
    if (!Object.prototype.hasOwnProperty.call(counts, item.domain)) {
      counts[item.domain] = { agree: 0, total: 0 };
      order.push(item.domain);
    }
    counts[item.domain].total += 1;
    if (item.agrees) counts[item.domain].agree += 1;
  });
  const text = order
    .map((domain) => {
      const { agree, total } = counts[domain];
      const verb = agree * 2 >= total ? 'agrees' : 'differs';
      return `${verb} on ${domain.replace(/_/g, ' ').toLowerCase()} (${agree}/${total})`;
    })
    .join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function IssueBreakdown({ issues, className }: { issues: TdIssues; className?: string }) {
  const total = issues.agree + issues.disagree;

  if (total === 0) {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <p className="text-sm font-semibold">No shared issues yet</p>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          This fills in as you answer daily-vote questions that this TD has spoken about.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {issues.items.length > 0
          ? summarise(issues.items)
          : `Agrees on ${issues.agree} of ${total} shared ${total === 1 ? 'issue' : 'issues'}`}
      </p>
      {issues.items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {issues.items.map((item) => (
            <li key={item.questionId} className="flex flex-col gap-2 rounded-xl bg-elevated p-3 sm:px-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="min-w-0 flex-1 text-[15px] font-bold leading-snug">{item.question}</span>
                <Badge variant={item.agrees ? 'default' : 'warn'} className="shrink-0">
                  {item.agrees ? 'Agrees' : 'Differs'}
                </Badge>
              </div>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-[13px]">
                <dt className="font-semibold text-muted-foreground">You:</dt>
                <dd>{item.yours}</dd>
                <dt className="font-semibold text-muted-foreground">They:</dt>
                <dd>{item.theirs}</dd>
              </dl>
              <div className="flex items-start gap-2">
                <QuoteKindBadge kind={item.quoteKind} />
                <blockquote className="min-w-0 text-sm leading-relaxed">“{item.quote}”</blockquote>
              </div>
              <StanceSource outlet={item.outlet} url={item.url} statedAt={item.statedAt} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
