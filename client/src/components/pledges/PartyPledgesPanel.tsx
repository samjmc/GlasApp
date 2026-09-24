import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import {
  CATEGORY_LABELS,
  EVIDENCE_LABELS,
  STATUS_LABELS,
  percent,
  pledgesApi,
  type Pledge,
  type PledgeStatus,
} from "@/services/pledgesApi";
import { PledgePriorities } from "./PledgePriorities";

const STATUS_STYLE: Record<PledgeStatus, string> = {
  unassessed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  not_started: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  broken: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  superseded: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IE", { year: "numeric", month: "short", day: "numeric" });

/** One pledge, with its evidence loaded only when opened. */
function PledgeRow({ pledge }: { pledge: Pledge }) {
  const [open, setOpen] = useState(false);
  const detail = useQuery({
    queryKey: ["/api/pledges", pledge.id],
    queryFn: () => pledgesApi.get(pledge.id),
    enabled: open && pledge.evidenceCount > 0,
  });

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-medium">{pledge.title}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{pledge.description}</p>
        </div>
        <Badge className={STATUS_STYLE[pledge.status]}>{STATUS_LABELS[pledge.status]}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{CATEGORY_LABELS[pledge.category]}</span>
        <span>{pledge.electionYear} election</span>
        {pledge.targetDate && <span>Target {formatDate(pledge.targetDate)}</span>}
        <a href={pledge.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
          Where it was promised <ExternalLink className="h-3 w-3" />
        </a>
        {pledge.reviewedAt && <span>Reviewed {formatDate(pledge.reviewedAt)}</span>}
      </div>

      {pledge.statusNote && <p className="mt-2 text-sm">{pledge.statusNote}</p>}

      {pledge.evidenceCount > 0 && (
        <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs" onClick={() => setOpen(!open)}>
          {open ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
          Evidence ({pledge.evidenceCount})
        </Button>
      )}

      {open && (
        <ul className="mt-2 space-y-2 border-l-2 pl-3">
          {detail.isLoading && <li className="text-xs text-muted-foreground">Loading evidence…</li>}
          {detail.data?.evidence.map((item) => (
            <li key={item.id} className="text-sm">
              <span className="font-medium">{EVIDENCE_LABELS[item.kind]}</span>
              <span className="text-muted-foreground"> · {formatDate(item.occurredOn)}</span>
              <p>{item.summary}</p>
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">
                Source
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A party's pledge record: every pledge with its reviewed status, evidence and source.
 * No score is computed here: a status is set by a person reviewing sourced evidence.
 */
export function PartyPledgesPanel({ party }: { party: string }) {
  const pledges = useQuery({ queryKey: ["/api/pledges", "party", party], queryFn: () => pledgesApi.list(party) });
  const summaries = useQuery({ queryKey: ["/api/pledges/parties"], queryFn: pledgesApi.parties });
  const summary = summaries.data?.find((s) => s.party.toLowerCase() === party.toLowerCase());

  if (pledges.isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading pledges…</p>;
  }
  if (pledges.isError) {
    return <p className="py-8 text-center text-sm text-red-600">Could not load pledges. Please try again.</p>;
  }

  const list = pledges.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{party}: pledge record</CardTitle>
          <CardDescription>
            Each pledge links to where it was made. A status is set only after someone reviews dated, sourced evidence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summary ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Pledges tracked" value={String(summary.total)} />
              <Stat label="Delivered" value={String(summary.byStatus.delivered)} />
              <Stat label="Broken" value={String(summary.byStatus.broken)} />
              <Stat
                label="Delivery rate"
                value={percent(summary.deliveryRate)}
                hint="Delivered ÷ (delivered + broken)"
              />
              {summary.weightedDeliveryRate !== null && (
                <Stat
                  label="Weighted by priorities"
                  value={percent(summary.weightedDeliveryRate)}
                  hint="Your ranking if you have one, otherwise everyone's"
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No pledges have been recorded for this party yet.</p>
          )}
        </CardContent>
      </Card>

      {list.length > 0 && (
        <div className="space-y-3">
          {list.map((pledge) => (
            <PledgeRow key={pledge.id} pledge={pledge} />
          ))}
        </div>
      )}

      <PledgePriorities />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div title={hint}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
