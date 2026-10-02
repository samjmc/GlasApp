import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Shield } from "lucide-react";
import type { AbsenceKind } from "@shared/parliamentApi";
import { LEAVE_REASON_LABELS, leaveWatchApi, type LeaveAlertView } from "@/services/leaveWatchApi";

/**
 * Leave watch: long runs of sitting days with no vote and no speech that no documented leave
 * covers, found once a week. The Oireachtas gives no reason for an absence, so nothing here is
 * guessed: confirm a leave only when a public source says so, otherwise dismiss it. A dismissed
 * run that doubles in length comes back.
 */

const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Please try again.");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default function LeaveWatchPage() {
  const [scope, setScope] = useState<"open" | "all">("open");
  const alerts = useQuery({ queryKey: ["/api/parliament/admin/leave-alerts", scope], queryFn: () => leaveWatchApi.list(scope) });

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Leave watch</h1>
          <p className="text-sm text-muted-foreground">
            TDs with a long run of sitting days and no vote and no speech, listed every Monday. If a public source explains it,
            confirm it and those days stop counting against the TD. If you find nothing, dismiss it. Never guess a reason.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          <Shield className="mr-1 h-4 w-4" /> Admin
        </Badge>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Button size="sm" variant={scope === "open" ? "default" : "outline"} onClick={() => setScope("open")}>
          Open
        </Button>
        <Button size="sm" variant={scope === "all" ? "default" : "outline"} onClick={() => setScope("all")}>
          All, with decisions
        </Button>
        <span className="text-muted-foreground">
          {alerts.data ? `${alerts.data.length} shown` : "Loading…"}
        </span>
      </div>

      {alerts.isError && <p className="text-sm text-destructive">Could not load the leave watch.</p>}
      {alerts.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">{scope === "open" ? "Nothing to review." : "No alerts yet. The first list is made on Monday."}</p>
      )}
      {alerts.data?.map((alert) => (
        <AlertCard key={alert.id} alert={alert} />
      ))}
    </div>
  );
}

function AlertCard({ alert }: { alert: LeaveAlertView }) {
  const open = alert.status === "open";
  return (
    <Card>
      <CardHeader className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg">
              {alert.tdId ? (
                <Link href={`/td/${encodeURIComponent(alert.name)}`} className="underline-offset-2 hover:underline">
                  {alert.name}
                </Link>
              ) : (
                alert.name
              )}
              {alert.party && <span className="ml-2 text-sm font-normal text-muted-foreground">{alert.party}</span>}
            </CardTitle>
            <CardDescription>
              {alert.sittingDays} sitting days, {day(alert.from)} to {day(alert.to)}
            </CardDescription>
          </div>
          {!open && <Badge variant="secondary">{alert.status}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Hints alert={alert} />
        {open ? <Review alert={alert} /> : <Decision alert={alert} />}
      </CardContent>
    </Card>
  );
}

function Hints({ alert }: { alert: LeaveAlertView }) {
  if (alert.hints.length === 0) {
    return <p className="text-sm text-muted-foreground">No news found that points to leave. Search for a statement from the TD or their party.</p>;
  }
  return (
    <div>
      <p className="text-sm font-medium">News that may explain it (read it, it is not a reason)</p>
      <ul className="mt-1 space-y-1 text-sm">
        {alert.hints.map((hint) => (
          <li key={hint.url}>
            <a href={hint.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
              {hint.title} <ExternalLink className="h-3 w-3" />
            </a>
            <span className="text-muted-foreground"> · {day(hint.publishedAt.slice(0, 10))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Decision({ alert }: { alert: LeaveAlertView }) {
  if (!alert.resolvedAt) return null;
  const who = alert.resolvedBy === "watch" ? "the weekly job" : alert.resolvedBy;
  return (
    <p className="text-sm text-muted-foreground">
      {alert.status === "confirmed" ? "Confirmed" : alert.status === "dismissed" ? "Dismissed" : "Closed"} by {who} on {day(alert.resolvedAt.slice(0, 10))}
      {alert.resolutionNote ? `: ${alert.resolutionNote}` : "."}
    </p>
  );
}

function Review({ alert }: { alert: LeaveAlertView }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<AbsenceKind>("medical_leave");
  const [from, setFrom] = useState(alert.from);
  const [to, setTo] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [note, setNote] = useState("");
  const [dismissNote, setDismissNote] = useState("");

  const done = () => queryClient.invalidateQueries({ queryKey: ["/api/parliament/admin/leave-alerts"] });
  const confirm = useMutation({
    mutationFn: () => leaveWatchApi.confirm(alert.id, { reason, from, to: to || null, sourceUrl: sourceUrl.trim(), note: note.trim() || null }),
    onSuccess: () => {
      toast({ title: "Leave recorded", description: "It counts from the next daily sync." });
      done();
    },
    onError: (error) => toast({ title: "Could not confirm", description: messageOf(error), variant: "destructive" }),
  });
  const dismiss = useMutation({
    mutationFn: () => leaveWatchApi.dismiss(alert.id, dismissNote.trim() || null),
    onSuccess: () => {
      toast({ title: "Dismissed", description: "It comes back if the silence doubles." });
      done();
    },
    onError: (error) => toast({ title: "Could not dismiss", description: messageOf(error), variant: "destructive" }),
  });

  const ready = /^https:\/\//i.test(sourceUrl.trim()) && /^\d{4}-\d{2}-\d{2}$/.test(from);

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) confirm.mutate();
        }}
      >
        <div>
          <Label>Reason</Label>
          <Select value={reason} onValueChange={(v) => setReason(v as AbsenceKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(LEAVE_REASON_LABELS) as AbsenceKind[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {LEAVE_REASON_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`source-${alert.id}`}>Public source (https link)</Label>
          <Input id={`source-${alert.id}`} type="url" placeholder="https://" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`from-${alert.id}`}>Leave starts (as the source says)</Label>
          <Input id={`from-${alert.id}`} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`to-${alert.id}`}>Leave ends (empty while it goes on)</Label>
          <Input id={`to-${alert.id}`} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor={`note-${alert.id}`}>What the source says (shown to readers; no medical detail)</Label>
          <Input id={`note-${alert.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Leave announced by the party on 3 March" />
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={!ready || confirm.isPending}>
            {confirm.isPending ? "Saving…" : "Confirm leave"}
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <Label htmlFor={`dismiss-${alert.id}`}>Found no public reason? Dismiss it (optional note)</Label>
          <Input id={`dismiss-${alert.id}`} value={dismissNote} onChange={(e) => setDismissNote(e.target.value)} placeholder="e.g. Searched the party site and news, nothing" />
        </div>
        <Button variant="outline" onClick={() => dismiss.mutate()} disabled={dismiss.isPending}>
          {dismiss.isPending ? "Saving…" : "Dismiss"}
        </Button>
      </div>
    </div>
  );
}
