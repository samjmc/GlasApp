import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Landmark, MessagesSquare, Trophy, Users } from "lucide-react";
import { apiClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { formatIsoDate } from "@/lib/isoDate";
import { partyStyle } from "@/lib/parties";
import { scoreTone, TONE_BG, TONE_TEXT } from "@/lib/score";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PartyLabel, TDAvatar } from "@/components/pulse/Party";
import { DivisionBar } from "@/components/pulse/VoteChip";
import { Segmented } from "@/components/pulse/Segmented";
import { EmptyState } from "@/components/pulse/EmptyState";
import type {
  ParliamentStatus,
  DivisionSummary,
  DivisionDetail,
  DebateSectionSummary,
  DebateSectionDetail,
  LeaderboardEntry,
  LeaderboardMetric,
  PartyParliamentSummary,
} from "@shared/parliamentApi";
import { LEADERBOARD_METRICS } from "@shared/parliamentApi";

type ApiEnvelope<T> = { success: true; data: T; meta?: { total: number } };

async function getParliament<T>(path: string): Promise<ApiEnvelope<T>> {
  return apiClient.get<ApiEnvelope<T>>(path);
}

const PAGE_SIZE = 20;

const formatPct = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)}%`);
const formatOne = (value: number | null) => (value === null ? "—" : value.toFixed(1));
const formatCount = (value: number) => value.toLocaleString("en-IE");
const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;

const METRICS: Record<LeaderboardMetric, { label: string; desc: string; format: (v: number) => string }> = {
  attendance: {
    label: "Attendance",
    desc: "Share of Dáil votes a TD cast while a member.",
    format: (v) => `${v.toFixed(1)}%`,
  },
  participation: {
    label: "Participation",
    desc: "Debate sections a TD spoke in, per 10 sitting days.",
    format: (v) => v.toFixed(1),
  },
  questions: {
    label: "Questions",
    desc: "Parliamentary questions put to ministers, oral and written.",
    format: formatCount,
  },
};

const ORDER_OPTIONS: Array<{ value: "desc" | "asc"; label: string }> = [
  { value: "desc", label: "Top" },
  { value: "asc", label: "Bottom" },
];

type Tab = "divisions" | "debates" | "leaderboard" | "parties";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "divisions", label: "Divisions" },
  { key: "debates", label: "Debates" },
  { key: "leaderboard", label: "Leaderboards" },
  { key: "parties", label: "Parties" },
];

/** Tá / Níl / Staon colours, shared by counts, bars and legends. */
const VOTE_TONES = [
  { key: "ta", label: "Tá", text: "text-score-high", bg: "bg-score-high" },
  { key: "nil", label: "Níl", text: "text-warn", bg: "bg-warn" },
  { key: "staon", label: "Staon", text: "text-score-mid", bg: "bg-score-mid" },
] as const;

const tdLinkClass =
  "truncate rounded-sm font-bold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const expandButtonClass =
  "flex w-full items-start gap-3 rounded-xl p-4 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

const EMPTY_RECORD = "The Dáil record has not been loaded yet. It fills in after the next parliament sync.";

/** A tab's panel: plain on phone, a card on md+ (the boards' phone and desktop layouts). */
function Panel({ title, meta, action, children }: { title: string; meta?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 md:rounded-2xl md:border md:bg-card md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-display text-[22px] font-bold leading-tight tracking-tight">{title}</h2>
          {meta && <p className="text-[13px] text-muted-foreground">{meta}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ListSkeleton({ rows = 5, className = "h-28" }: { rows?: number; className?: string }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn("rounded-xl", className)} />
      ))}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronDown
      aria-hidden="true"
      className={cn("mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
    />
  );
}

function PagerControls({
  offset,
  limit,
  total,
  onPrev,
  onNext,
}: {
  offset: number;
  limit: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (total <= limit && offset === 0) return null;
  return (
    <nav aria-label="Pages" className="grid grid-cols-2 items-center gap-2 sm:flex sm:justify-between">
      <Button variant="outline" className="h-12 sm:h-10" onClick={onPrev} disabled={offset === 0}>
        <ChevronLeft aria-hidden="true" />
        Newer
      </Button>
      <span className="col-span-2 row-start-2 text-center text-[13px] text-muted-foreground sm:text-sm">
        {formatCount(offset + 1)}–{formatCount(Math.min(offset + limit, total))} of {formatCount(total)}
      </span>
      <Button variant="outline" className="h-12 sm:h-10" onClick={onNext} disabled={offset + limit >= total}>
        Older
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}

function TdLink({ name }: { name: string | null }) {
  if (!name) return <span className="font-bold text-muted-foreground">Unknown TD</span>;
  return (
    <Link href={`/td/${encodeURIComponent(name)}`} className={tdLinkClass}>
      {name}
    </Link>
  );
}

function OutcomePill({ outcome, className }: { outcome: string | null; className?: string }) {
  if (!outcome) return null;
  const variant = outcome.toLowerCase() === "carried" ? "success" : outcome.toLowerCase() === "lost" ? "warn" : "secondary";
  return <span className={cn(badgeVariants({ variant }), "shrink-0 px-2.5 py-1", className)}>{outcome}</span>;
}

/** "40 Tá · 2 Níl": only the non-zero counts, each in its vote colour. */
function VoteCounts({ counts }: { counts: Record<"ta" | "nil" | "staon", number> }) {
  const parts = VOTE_TONES.filter((t) => counts[t.key] > 0);
  if (parts.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="whitespace-nowrap font-bold">
      {parts.map((t, i) => (
        <span key={t.key}>
          {i > 0 && <span className="text-muted-foreground"> · </span>}
          <span className={t.text}>
            {counts[t.key]} {t.label}
          </span>
        </span>
      ))}
    </span>
  );
}

function DivisionBreakdown({ detail }: { detail: DivisionDetail }) {
  const voted = detail.taCount + detail.nilCount + detail.staonCount;
  const maxParty = Math.max(1, ...detail.byParty.map((r) => r.ta + r.nil + r.staon));
  const totals = { ta: detail.taCount, nil: detail.nilCount, staon: detail.staonCount };
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {VOTE_TONES.map((t) => (
          <div key={t.key} className="flex flex-col gap-0.5 rounded-xl bg-elevated px-3 py-2.5 sm:px-4 sm:py-3">
            <span className="text-xs font-semibold text-muted-foreground">{t.label}</span>
            <span className={cn("font-display text-2xl font-bold leading-tight sm:text-3xl", t.text)}>{totals[t.key]}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">
          How each party voted <span className="font-medium text-muted-foreground">· {plural(voted, "TD", "TDs")} voted</span>
        </h3>
        <span className="flex gap-3 text-xs font-semibold text-muted-foreground" aria-hidden="true">
          {VOTE_TONES.map((t) => (
            <span key={t.key} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-sm", t.bg)} />
              {t.label}
            </span>
          ))}
        </span>
      </div>
      {detail.byParty.length === 0 ? (
        <p className="text-sm text-muted-foreground">No party breakdown for this vote.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {detail.byParty.map((row) => {
            const total = row.ta + row.nil + row.staon;
            return (
              <li
                key={row.party}
                className="grid min-h-9 grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)_auto] items-center gap-3 text-[13px] sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]"
              >
                <PartyLabel party={row.party} short className="text-[13px] font-semibold text-foreground sm:hidden" />
                <PartyLabel party={row.party} className="hidden text-[13px] font-semibold text-foreground sm:inline-flex" />
                <span
                  className="flex h-2 overflow-hidden rounded-full bg-elevated"
                  style={{ width: `${Math.max(4, Math.round((total / maxParty) * 100))}%` }}
                  aria-hidden="true"
                >
                  {VOTE_TONES.map((t) => (
                    <span key={t.key} className={cn("basis-0", t.bg)} style={{ flexGrow: row[t.key] }} />
                  ))}
                </span>
                <span className="text-right">
                  <VoteCounts counts={row} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {detail.uri && (
        <a
          href={detail.uri}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-sm text-sm font-bold text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Official record on oireachtas.ie
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      )}
    </>
  );
}

function DivisionsSection() {
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.parliament.divisions(PAGE_SIZE, offset),
    queryFn: () => getParliament<DivisionSummary[]>(`/api/parliament/divisions?limit=${PAGE_SIZE}&offset=${offset}`),
  });

  const {
    data: detailResp,
    isLoading: detailLoading,
    isError: detailError,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: queryKeys.parliament.division(expandedId ?? ""),
    queryFn: () => getParliament<DivisionDetail>(`/api/parliament/divisions/${encodeURIComponent(expandedId!)}`),
    enabled: !!expandedId,
  });

  const divisions = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const detail = detailResp?.data;

  return (
    <Panel
      title="Divisions"
      meta={total > 0 ? `${plural(total, "recorded Dáil vote", "recorded Dáil votes")}. Pick one to see how each party voted.` : undefined}
    >
      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorDisplay variant="inline" title="Could not load divisions" onRetry={() => refetch()} />
      ) : divisions.length === 0 ? (
        <EmptyState icon={Landmark} title="No divisions yet">
          {EMPTY_RECORD}
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {divisions.map((division) => {
              const isExpanded = expandedId === division.id;
              const title = division.debateTitle || division.subject || "Division";
              const subject = division.debateTitle ? division.subject : null;
              return (
                <article key={division.id} className="rounded-xl border bg-card">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedId(isExpanded ? null : division.id)}
                    className={expandButtonClass}
                  >
                    <span className="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_12rem] md:items-center md:gap-6">
                      <span className="flex min-w-0 flex-col gap-1.5">
                        <span className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
                            {formatIsoDate(division.date)}
                            {division.isBill && <span className={badgeVariants({ variant: "secondary" })}>Bill</span>}
                          </span>
                          <OutcomePill outcome={division.outcome} className="md:hidden" />
                        </span>
                        <span className="text-base font-bold leading-snug">{title}</span>
                        {subject && <span className="line-clamp-2 text-[13px] text-muted-foreground">{subject}</span>}
                      </span>
                      <span className="flex flex-col gap-2">
                        <OutcomePill outcome={division.outcome} className="hidden self-start md:inline-flex" />
                        <DivisionBar ta={division.taCount} nil={division.nilCount} />
                        {division.staonCount > 0 && (
                          <span className="text-xs font-semibold text-score-mid">Staon {division.staonCount}</span>
                        )}
                      </span>
                    </span>
                    <Chevron open={isExpanded} />
                  </button>
                  {isExpanded && (
                    <div className="flex flex-col gap-4 border-t p-4" aria-live="polite">
                      {detailLoading ? (
                        <ListSkeleton rows={4} className="h-9" />
                      ) : detail ? (
                        <DivisionBreakdown detail={detail} />
                      ) : detailError ? (
                        <ErrorDisplay variant="inline" title="Could not load this division" onRetry={() => refetchDetail()} />
                      ) : (
                        <p className="text-sm text-muted-foreground">No detail available for this vote.</p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <PagerControls
            offset={offset}
            limit={PAGE_SIZE}
            total={total}
            onPrev={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            onNext={() => setOffset((o) => o + PAGE_SIZE)}
          />
        </>
      )}
    </Panel>
  );
}

function DebateSpeakers({ detail }: { detail: DebateSectionDetail }) {
  const maxWords = Math.max(1, ...detail.speakers.map((s) => s.words));
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Who spoke most</h3>
        <span className="text-xs font-semibold text-muted-foreground">By words spoken</span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {detail.speakers.map((speaker, index) => (
          <li
            key={speaker.memberCode ?? `${speaker.name}-${index}`}
            className="grid min-h-12 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3"
          >
            <TDAvatar name={speaker.name ?? "?"} party={speaker.party} size="sm" />
            <span className="flex min-w-0 flex-col gap-1.5">
              <span className="flex min-w-0 items-baseline gap-2 text-[15px]">
                <TdLink name={speaker.name} />
                {speaker.party && <PartyLabel party={speaker.party} short className="shrink-0 text-xs" />}
              </span>
              <span className="h-1 rounded-full bg-elevated" aria-hidden="true">
                <span
                  className="block h-1 rounded-full"
                  style={{
                    width: `${Math.max(2, Math.round((speaker.words / maxWords) * 100))}%`,
                    backgroundColor: partyStyle(speaker.party).dot,
                  }}
                />
              </span>
            </span>
            <span className="flex flex-col items-end text-xs text-muted-foreground">
              <strong className="text-sm text-foreground">{plural(speaker.words, "word", "words")}</strong>
              {plural(speaker.speeches, "speech", "speeches")}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">Speeches from the chair are not counted.</p>
    </>
  );
}

function DebatesSection() {
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.parliament.debates(PAGE_SIZE, offset),
    queryFn: () => getParliament<DebateSectionSummary[]>(`/api/parliament/debates?limit=${PAGE_SIZE}&offset=${offset}`),
  });

  const {
    data: detailResp,
    isLoading: detailLoading,
    isError: detailError,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: queryKeys.parliament.debate(expandedId ?? ""),
    queryFn: () => getParliament<DebateSectionDetail>(`/api/parliament/debates/${encodeURIComponent(expandedId!)}`),
    enabled: !!expandedId,
  });

  const sections = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const detail = detailResp?.data;

  return (
    <Panel
      title="Debates"
      meta={total > 0 ? `${plural(total, "debate section", "debate sections")}. Pick one to see who spoke.` : undefined}
    >
      {isLoading ? (
        <ListSkeleton className="h-24" />
      ) : isError ? (
        <ErrorDisplay variant="inline" title="Could not load debates" onRetry={() => refetch()} />
      ) : sections.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="No debates yet">
          {EMPTY_RECORD}
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {sections.map((section) => {
              const isExpanded = expandedId === section.id;
              return (
                <article key={section.id} className="rounded-xl border bg-card">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedId(isExpanded ? null : section.id)}
                    className={expandButtonClass}
                  >
                    <span className="grid min-w-0 flex-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6">
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="text-[13px] font-semibold text-muted-foreground">{formatIsoDate(section.date)}</span>
                        <span className="text-base font-bold leading-snug">{section.title}</span>
                      </span>
                      <span className="text-sm text-muted-foreground md:text-right">
                        <strong className="text-foreground">{formatCount(section.speakerCount)}</strong>{" "}
                        {section.speakerCount === 1 ? "TD spoke" : "TDs spoke"} ·{" "}
                        <strong className="text-foreground">{formatCount(section.speechCount)}</strong>{" "}
                        {section.speechCount === 1 ? "speech" : "speeches"}
                      </span>
                    </span>
                    <Chevron open={isExpanded} />
                  </button>
                  {isExpanded && (
                    <div className="flex flex-col gap-3 border-t p-4" aria-live="polite">
                      {detailLoading ? (
                        <ListSkeleton rows={4} className="h-12" />
                      ) : detail && detail.speakers.length > 0 ? (
                        <DebateSpeakers detail={detail} />
                      ) : detailError ? (
                        <ErrorDisplay variant="inline" title="Could not load this debate" onRetry={() => refetchDetail()} />
                      ) : (
                        <p className="text-sm text-muted-foreground">No TD speeches are recorded for this section.</p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <PagerControls
            offset={offset}
            limit={PAGE_SIZE}
            total={total}
            onPrev={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            onNext={() => setOffset((o) => o + PAGE_SIZE)}
          />
        </>
      )}
    </Panel>
  );
}

function LeaderboardSection() {
  const [metric, setMetric] = useState<LeaderboardMetric>("attendance");
  const [order, setOrder] = useState<"desc" | "asc">("desc");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.parliament.leaderboard(metric, order, PAGE_SIZE),
    queryFn: () =>
      getParliament<LeaderboardEntry[]>(`/api/parliament/leaderboard?metric=${metric}&order=${order}&limit=${PAGE_SIZE}`),
  });

  const entries = data?.data ?? [];
  const isPct = metric === "attendance";
  const maxValue = Math.max(1, ...entries.map((e) => e.value));

  return (
    <Panel
      title="Leaderboards"
      action={<Segmented label="Order" size="sm" options={ORDER_OPTIONS} value={order} onChange={setOrder} />}
    >
      <Segmented
        label="Measure"
        options={LEADERBOARD_METRICS.map((m) => ({ value: m, label: METRICS[m].label }))}
        value={metric}
        onChange={setMetric}
        className="self-start"
      />
      <p className="text-sm text-muted-foreground">{METRICS[metric].desc}</p>
      {isLoading ? (
        <ListSkeleton rows={8} className="h-16" />
      ) : isError ? (
        <ErrorDisplay variant="inline" title="Could not load the leaderboard" onRetry={() => refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState icon={Trophy} title="Nobody ranked yet">
          {EMPTY_RECORD}
        </EmptyState>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {entries.map((entry, index) => {
            const tone = isPct ? scoreTone(entry.value) : null;
            const width = isPct ? entry.value : (entry.value / maxValue) * 100;
            return (
              <li
                key={entry.tdId}
                className="grid grid-cols-[1.5rem_2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-card px-3 py-2.5 md:grid-cols-[2rem_2.75rem_minmax(0,1fr)_9rem_5.5rem] md:gap-4 md:px-4"
              >
                <span className="text-sm font-bold text-muted-foreground">{index + 1}</span>
                <TDAvatar name={entry.name} party={entry.party} imageUrl={entry.imageUrl} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <TdLink name={entry.name} />
                  <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
                    <PartyLabel party={entry.party ?? "Independent"} short className="shrink-0 text-[13px]" />
                    {entry.constituency && <span className="truncate">· {entry.constituency}</span>}
                  </span>
                </span>
                <span className="hidden h-1.5 rounded-full bg-elevated md:block" aria-hidden="true">
                  <span
                    className={cn("block h-1.5 rounded-full", tone ? TONE_BG[tone] : "bg-primary")}
                    style={{ width: `${Math.max(2, Math.min(100, width))}%` }}
                  />
                </span>
                <span className={cn("text-right font-display text-xl font-bold tracking-tight", tone ? TONE_TEXT[tone] : "text-foreground")}>
                  {METRICS[metric].format(entry.value)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-xs text-muted-foreground">
        A TD with no record for this measure, such as one who chairs the Dáil, is left out. Not ranked is not zero.
      </p>
    </Panel>
  );
}

function attendanceClass(value: number | null) {
  const tone = scoreTone(value);
  return tone ? TONE_TEXT[tone] : "text-muted-foreground";
}

function PartiesSection() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.parliament.parties(),
    queryFn: () => getParliament<PartyParliamentSummary[]>("/api/parliament/parties"),
  });

  const parties = data?.data ?? [];
  const members = parties.reduce((n, p) => n + p.members, 0);

  return (
    <Panel
      title="Parties in the Dáil"
      meta={parties.length > 0 ? `${plural(members, "TD", "TDs")} in ${plural(parties.length, "group", "groups")}.` : undefined}
    >
      {isLoading ? (
        <ListSkeleton rows={6} className="h-24 md:h-12" />
      ) : isError ? (
        <ErrorDisplay variant="inline" title="Could not load parties" onRetry={() => refetch()} />
      ) : parties.length === 0 ? (
        <EmptyState icon={Users} title="No party figures yet">
          {EMPTY_RECORD}
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-col gap-2 md:hidden">
            {parties.map((party) => (
              <article key={party.party} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <PartyLabel party={party.party} link className="min-h-11 text-base font-bold text-foreground" />
                  <span className="shrink-0 text-[13px] text-muted-foreground">
                    <strong className="font-display text-lg text-foreground">{party.members}</strong> TDs
                  </span>
                </div>
                <dl className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Attendance", value: formatPct(party.avgAttendancePct), className: attendanceClass(party.avgAttendancePct) },
                    { label: "Party line", value: formatPct(party.partyLinePct), className: "" },
                    { label: "Sections", value: formatOne(party.avgSectionsSpoken), className: "" },
                  ].map((stat) => (
                    <div key={stat.label} className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-elevated p-2.5">
                      <dt className="text-xs font-semibold text-muted-foreground">{stat.label}</dt>
                      <dd className={cn("font-display text-lg font-bold tracking-tight", stat.className)}>{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Party</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Avg attendance</TableHead>
                <TableHead className="text-right">Party line</TableHead>
                <TableHead className="text-right">Avg sections spoken</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parties.map((party) => {
                const tone = scoreTone(party.avgAttendancePct);
                return (
                  <TableRow key={party.party}>
                    <TableCell className="py-3">
                      <PartyLabel party={party.party} link className="text-[15px] font-bold text-foreground" />
                    </TableCell>
                    <TableCell className="py-3 text-right font-bold">{party.members}</TableCell>
                    <TableCell className="py-3 text-right">
                      <span className="inline-flex items-center gap-3">
                        <span className="h-1.5 w-20 rounded-full bg-elevated" aria-hidden="true">
                          {tone && (
                            <span
                              className={cn("block h-1.5 rounded-full", TONE_BG[tone])}
                              style={{ width: `${party.avgAttendancePct}%` }}
                            />
                          )}
                        </span>
                        <span className={cn("min-w-14 font-bold", attendanceClass(party.avgAttendancePct))}>
                          {formatPct(party.avgAttendancePct)}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-right font-semibold">{formatPct(party.partyLinePct)}</TableCell>
                    <TableCell className="py-3 text-right font-semibold">{formatOne(party.avgSectionsSpoken)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
      <div className="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
        <p>
          Averages per member. Attendance: share of Dáil votes cast while a TD. Party line: share of votes that matched the
          party majority. Sections: debate sections spoken in.
        </p>
        <p>Independents have no party line, so it shows —. A one-member party always matches itself.</p>
      </div>
    </Panel>
  );
}

const DebatesPage = () => {
  const [activeTab, setActiveTab] = useState<Tab>("divisions");

  const { data: statusResp } = useQuery({
    queryKey: queryKeys.parliament.status(),
    queryFn: () => getParliament<ParliamentStatus>("/api/parliament/status"),
  });

  // Complete only as far as the LEAST advanced data feed; the roster feed is always today.
  const { throughDate, pendingDays } = useMemo(() => {
    const feeds = (statusResp?.data.feeds ?? []).filter((f) => f.feed === "divisions" || f.feed === "debates");
    const dates = feeds.map((f) => f.throughDate);
    return {
      throughDate: dates.length === 2 && dates.every(Boolean) ? (dates as string[]).sort()[0] : null,
      pendingDays: feeds.reduce((n, f) => n + Object.keys(f.failures ?? {}).length, 0),
    };
  }, [statusResp]);

  const status =
    throughDate || pendingDays > 0 ? (
      <p
        role="status"
        className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl border bg-card px-3 py-1.5 text-[13px] font-semibold sm:rounded-full sm:text-sm"
      >
        <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", pendingDays > 0 ? "bg-warn" : "bg-primary")} />
        {throughDate && <span>Data through {formatIsoDate(throughDate)}</span>}
        <span className="font-medium text-muted-foreground">
          {pendingDays > 0
            ? `· ${pendingDays} sitting day${pendingDays === 1 ? "" : "s"} not yet loaded`
            : "· all sitting days loaded"}
        </span>
      </p>
    ) : null;

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <PageHeader
        title="Dáil record"
        description="Every vote, debate and question from the official Oireachtas record."
        tooltipTitle="What you can do here"
        bullets={[
          "See recent Dáil divisions and how each party voted.",
          "Browse recent debate sections and who spoke.",
          "Compare TDs and parties on attendance, participation and questions.",
        ]}
        right={status}
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)} className="flex min-w-0 flex-col gap-5">
        <TabsList aria-label="Dáil record sections" className="h-auto w-full justify-start self-start sm:w-auto">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="h-10 flex-1 px-3 sm:flex-none sm:px-4">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="divisions" className="mt-0">
          <DivisionsSection />
        </TabsContent>
        <TabsContent value="debates" className="mt-0">
          <DebatesSection />
        </TabsContent>
        <TabsContent value="leaderboard" className="mt-0">
          <LeaderboardSection />
        </TabsContent>
        <TabsContent value="parties" className="mt-0">
          <PartiesSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DebatesPage;
