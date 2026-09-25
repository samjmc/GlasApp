import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, ExternalLink, Loader2, Plus, Shield, Trash2 } from "lucide-react";
import { politicalParties } from "@shared/data";
import { EVIDENCE_KINDS, PLEDGE_CATEGORIES, PLEDGE_STATUSES } from "@shared/pledges";
import {
  CATEGORY_LABELS,
  EVIDENCE_LABELS,
  STATUS_LABELS,
  pledgesApi,
  type EvidenceKind,
  type NewPledgeInput,
  type Pledge,
  type PledgeCategory,
  type PledgeStatus,
} from "@/services/pledgesApi";

/**
 * Pledge tracking admin: record a party's promises with their source, attach dated and
 * sourced evidence, and set each pledge's status from that evidence. The server requires a
 * signed-in admin for every write and logs who made it.
 */

const PARTY_NAMES = politicalParties.map((p) => p.name);
const today = () => new Date().toISOString().slice(0, 10);
const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Please try again.");

const emptyPledge = (party: string): NewPledgeInput => ({
  party,
  title: "",
  description: "",
  category: "housing",
  electionYear: new Date().getFullYear(),
  targetDate: null,
  sourceUrl: "",
});

export default function AdminPage() {
  const [party, setParty] = useState(PARTY_NAMES[0] ?? "");
  const pledges = useQuery({ queryKey: ["/api/pledges", "party", party], queryFn: () => pledgesApi.list(party), enabled: !!party });

  return (
    <ProtectedRoute requireAdmin={true}>
      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Pledge tracking</h1>
            <p className="text-sm text-muted-foreground">
              Record promises with their source, add evidence, and set each status from that evidence.
            </p>
          </div>
          <Badge variant="outline">
            <Shield className="mr-1 h-4 w-4" /> Admin
          </Badge>
        </div>

        <div className="max-w-xs">
          <Label>Party</Label>
          <Select value={party} onValueChange={setParty}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARTY_NAMES.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <NewPledgeForm party={party} />

        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-lg">{party} pledges</CardTitle>
            <CardDescription>{pledges.data ? `${pledges.data.length} recorded` : "Loading…"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pledges.isError && <p className="text-sm text-destructive">Could not load pledges.</p>}
            {pledges.data?.length === 0 && <p className="text-sm text-muted-foreground">No pledges recorded for this party.</p>}
            {pledges.data?.map((pledge) => (
              <PledgeEditor key={pledge.id} pledge={pledge} />
            ))}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

function useInvalidatePledges() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["/api/pledges"] });
    queryClient.invalidateQueries({ queryKey: ["/api/pledges/parties"] });
  };
}

function NewPledgeForm({ party }: { party: string }) {
  const { toast } = useToast();
  const invalidate = useInvalidatePledges();
  const [form, setForm] = useState<NewPledgeInput>(emptyPledge(party));

  const create = useMutation({
    mutationFn: () => pledgesApi.create({ ...form, party, targetDate: form.targetDate || null }),
    onSuccess: () => {
      toast({ title: "Pledge recorded" });
      setForm(emptyPledge(party));
      invalidate();
    },
    onError: (error) => toast({ title: "Could not record pledge", description: messageOf(error), variant: "destructive" }),
  });

  const set = <K extends keyof NewPledgeInput>(key: K, value: NewPledgeInput[K]) => setForm({ ...form, [key]: value });
  const ready = form.title.trim() && form.description.trim() && /^https?:\/\//i.test(form.sourceUrl.trim());

  return (
    <Card>
      <CardHeader className="py-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Plus className="h-5 w-5" /> New pledge for {party}
        </CardTitle>
        <CardDescription>A source link is required: a pledge nobody can check is not recorded.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) create.mutate();
          }}
        >
          <div className="md:col-span-2">
            <Label htmlFor="pledge-title">Title</Label>
            <Input id="pledge-title" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="pledge-description">What was promised</Label>
            <Textarea id="pledge-description" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => set("category", v as PledgeCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLEDGE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="pledge-year">Election year</Label>
            <Input id="pledge-year" type="number" value={form.electionYear} onChange={(e) => set("electionYear", Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="pledge-target">Target date (optional)</Label>
            <Input id="pledge-target" type="date" value={form.targetDate ?? ""} onChange={(e) => set("targetDate", e.target.value || null)} />
          </div>
          <div>
            <Label htmlFor="pledge-source">Source link</Label>
            <Input id="pledge-source" type="url" placeholder="https://" value={form.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={!ready || create.isPending}>
              {create.isPending ? "Saving…" : "Record pledge"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PledgeEditor({ pledge }: { pledge: Pledge }) {
  const { toast } = useToast();
  const invalidate = useInvalidatePledges();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<PledgeStatus>(pledge.status);
  const [note, setNote] = useState(pledge.statusNote ?? "");

  const save = useMutation({
    mutationFn: () => pledgesApi.update(pledge.id, { status, statusNote: note.trim() || null }),
    onSuccess: () => {
      toast({ title: "Status saved" });
      invalidate();
    },
    onError: (error) => toast({ title: "Could not save", description: messageOf(error), variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: () => pledgesApi.remove(pledge.id),
    onSuccess: invalidate,
    onError: (error) => toast({ title: "Could not delete", description: messageOf(error), variant: "destructive" }),
  });

  const changed = status !== pledge.status || (note.trim() || null) !== (pledge.statusNote ?? null);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-medium">{pledge.title}</h4>
          <p className="text-xs text-muted-foreground">
            {CATEGORY_LABELS[pledge.category]} · {pledge.electionYear} ·{" "}
            <a href={pledge.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
              source <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Delete pledge" disabled={remove.isPending}>
              {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this pledge?</AlertDialogTitle>
              <AlertDialogDescription>
                Delete "{pledge.title}" and all its evidence? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => remove.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-[200px_1fr_auto] md:items-end">
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as PledgeStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLEDGE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Why (shown to readers)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="One sentence, based on the evidence" />
        </div>
        <Button onClick={() => save.mutate()} disabled={!changed || save.isPending}>
          {save.isPending ? "Saving…" : "Save status"}
        </Button>
      </div>

      <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs" onClick={() => setOpen(!open)}>
        {open ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
        Evidence ({pledge.evidenceCount})
      </Button>
      {open && <EvidenceEditor pledgeId={pledge.id} />}
    </div>
  );
}

function EvidenceEditor({ pledgeId }: { pledgeId: number }) {
  const { toast } = useToast();
  const invalidate = useInvalidatePledges();
  const detail = useQuery({ queryKey: ["/api/pledges", pledgeId], queryFn: () => pledgesApi.get(pledgeId) });
  const [kind, setKind] = useState<EvidenceKind>("policy_implemented");
  const [summary, setSummary] = useState("");
  const [occurredOn, setOccurredOn] = useState(today());
  const [sourceUrl, setSourceUrl] = useState("");
  const [divisionId, setDivisionId] = useState("");

  const add = useMutation({
    mutationFn: () =>
      pledgesApi.addEvidence(pledgeId, { kind, summary: summary.trim(), occurredOn, sourceUrl: sourceUrl.trim(), divisionId: divisionId.trim() || null }),
    onSuccess: () => {
      setSummary("");
      setSourceUrl("");
      setDivisionId("");
      invalidate();
    },
    onError: (error) => toast({ title: "Could not add evidence", description: messageOf(error), variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => pledgesApi.removeEvidence(id),
    onSuccess: invalidate,
    onError: (error) => toast({ title: "Could not delete evidence", description: messageOf(error), variant: "destructive" }),
  });

  const ready = summary.trim().length >= 3 && /^https?:\/\//i.test(sourceUrl.trim());

  return (
    <div className="mt-2 space-y-2 border-l-2 border-border pl-3">
      {detail.data?.evidence.map((item) => (
        <div key={item.id} className="flex items-start justify-between gap-2 text-sm">
          <div>
            <span className="font-medium">{EVIDENCE_LABELS[item.kind]}</span>
            <span className="text-muted-foreground"> · {item.occurredOn}</span>
            {item.divisionId && <span className="text-muted-foreground"> · {item.divisionId}</span>}
            <p>{item.summary}</p>
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
              {item.sourceUrl}
            </a>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete evidence"
                disabled={remove.isPending && remove.variables === item.id}
              >
                {remove.isPending && remove.variables === item.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this evidence?</AlertDialogTitle>
                <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => remove.mutate(item.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ))}

      <div className="grid gap-2 md:grid-cols-2">
        <Select value={kind} onValueChange={(v) => setKind(v as EvidenceKind)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVIDENCE_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {EVIDENCE_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
        <Textarea className="md:col-span-2" rows={2} placeholder="What happened" value={summary} onChange={(e) => setSummary(e.target.value)} />
        <Input type="url" placeholder="Source link (https://…)" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
        <Input placeholder="Dáil division id (optional)" value={divisionId} onChange={(e) => setDivisionId(e.target.value)} />
      </div>
      <Button size="sm" onClick={() => add.mutate()} disabled={!ready || add.isPending}>
        {add.isPending ? "Adding…" : "Add evidence"}
      </Button>
    </div>
  );
}
