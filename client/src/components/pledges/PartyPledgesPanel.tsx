import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ClipboardList, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/pulse/EmptyState";
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

const STATUS_VARIANT: Record<PledgeStatus, BadgeProps["variant"]> = {
  unassessed: "secondary",
  not_started: "secondary",
  in_progress: "default",
  delivered: "success",
  broken: "destructive",
  superseded: "warn",
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
    <div className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold">{pledge.title}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{pledge.description}</p>
        </div>
        <Badge variant={STATUS_VARIANT[pledge.status]} className="shrink-0">{STATUS_LABELS[pledge.status]}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{CATEGORY_LABELS[pledge.category]}</span>
        <span>{pledge.electionYear} election</span>
        {pledge.targetDate && <span>Target {formatDate(pledge.targetDate)}</span>}
        <a href={pledge.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline hover:text-foreground">
          Where it was promised <ExternalLink className="h-3 w-3" />
        </a>
        {pledge.reviewedAt && <span>Reviewed {formatDate(pledge.reviewedAt)}</span>}
      </div>

      {pledge.statusNote && <p className="mt-2 text-sm">{pledge.statusNote}</p>}

      {pledge.evidenceCount > 0 && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setOpen(!open)}>
          {open ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
          Evidence ({pledge.evidenceCount})
        </Button>
      )}

      {open && (
        <ul className="mt-3 flex flex-col gap-3 border-l-2 border-input pl-3">
          {detail.isLoading && <li className="text-xs text-muted-foreground">Loading evidence…</li>}
          {detail.data?.evidence.map((item) => (
            <li key={item.id} className="text-sm">
              <span className="font-medium">{EVIDENCE_LABELS[item.kind]}</span>
              <span className="text-muted-foreground"> · {formatDate(item.occurredOn)}</span>
              <p>{item.summary}</p>
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground underline hover:text-foreground">
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
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }
  if (pledges.isError) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Could not load pledges"
        action={<Button variant="secondary" onClick={() => pledges.refetch()}>Try again</Button>}
      >
        The pledge tracker did not answer.
      </EmptyState>
    );
  }

  const list = pledges.data ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl font-bold tracking-tight">{party}: pledge record</CardTitle>
          <CardDescription>
            Each pledge links to where it was made. A status is set only after someone reviews dated, sourced evidence.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {summary ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            <EmptyState icon={ClipboardList} title="No pledges tracked yet">
              The tracker starts empty on purpose. A pledge shows here once it is recorded with its source, then gets a
              status when the evidence is reviewed.
            </EmptyState>
          )}
          {list.length > 0 && (
            <div className="flex flex-col gap-3">
              {list.map((pledge) => (
                <PledgeRow key={pledge.id} pledge={pledge} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PledgePriorities />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div title={hint} className="flex flex-col gap-1 rounded-xl bg-elevated p-3">
      <div className="font-display text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-[13px] text-muted-foreground">{label}</div>
    </div>
  );
}
