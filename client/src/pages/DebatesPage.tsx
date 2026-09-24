import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { apiClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { formatIsoDate } from "@/lib/isoDate";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import type {
  ParliamentStatus,
  DivisionSummary,
  DivisionDetail,
  DebateSectionSummary,
  DebateSectionDetail,
  LeaderboardEntry,
  LeaderboardMetric,
  PartyParliamentSummary,
  BillSummary,
  BillDetail,
} from "@shared/parliamentApi";
import { LEADERBOARD_METRICS } from "@shared/parliamentApi";

type ApiEnvelope<T> = { success: true; data: T; meta?: { total: number } };

async function getParliament<T>(path: string): Promise<ApiEnvelope<T>> {
  return apiClient.get<ApiEnvelope<T>>(path);
}

const PAGE_SIZE = 20;

const formatDate = (value: string | null) => formatIsoDate(value);

const formatPct = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)}%`);
const formatNum = (value: number | null) => (value === null ? "—" : value.toLocaleString());

const VOTE_LABEL: Record<string, string> = { ta: "Tá", nil: "Níl", staon: "Staon" };

const METRIC_LABEL: Record<LeaderboardMetric, string> = {
  attendance: "Attendance",
  participation: "Participation",
  questions: "Questions",
  committees: "Committees",
};

const formatMetricValue = (metric: LeaderboardMetric, value: number) => {
  if (metric === "attendance" || metric === "committees") return `${value.toFixed(1)}%`;
  if (metric === "participation") return value.toFixed(1);
  return formatNum(value);
};

type Tab = "divisions" | "debates" | "bills" | "leaderboard" | "parties";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "divisions", label: "Divisions" },
  { key: "debates", label: "Debates" },
  { key: "bills", label: "Bills" },
  { key: "leaderboard", label: "Leaderboards" },
  { key: "parties", label: "Parties" },
];

const BILL_STATUS_OPTIONS = ["All", "Current", "Enacted", "Lapsed", "Defeated", "Withdrawn"] as const;
const BILL_SOURCE_OPTIONS = ["All", "Government", "Private Member"] as const;

const cardClass = "mobile-card border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900";

function EmptyState({ message = "No parliament data yet — run npm run parliament:sync" }: { message?: string }) {
  return <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{message}</p>;
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
    <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
      <Button variant="outline" size="sm" onClick={onPrev} disabled={offset === 0}>
        Previous
      </Button>
      <span>
        {offset + 1}–{Math.min(offset + limit, total)} of {total}
      </span>
      <Button variant="outline" size="sm" onClick={onNext} disabled={offset + limit >= total}>
        Next
      </Button>
    </div>
  );
}

function TdLink({ name }: { name: string | null }) {
  if (!name) return <span>Unknown TD</span>;
  return (
    <Link href={`/td/${encodeURIComponent(name)}`} className="font-medium hover:text-primary">
      {name}
    </Link>
  );
}

/** A division row that expands in place to the byParty vote breakdown. Reused by the
 * divisions tab and by a bill's own divisions list. */
function DivisionRow({ division }: { division: DivisionSummary }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: detailResp, isLoading: detailLoading, isError: detailError } = useQuery({
    queryKey: queryKeys.parliament.division(division.id),
    queryFn: () => getParliament<DivisionDetail>(`/api/parliament/divisions/${encodeURIComponent(division.id)}`),
    enabled: isExpanded,
  });

  const detail = detailResp?.data;

  return (
    <article className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full flex-col gap-1 p-4 text-left"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {formatDate(division.date)}
          </span>
          {division.outcome && (
            <Badge variant={division.outcome.toLowerCase() === "carried" ? "default" : "outline"}>
              {division.outcome}
            </Badge>
          )}
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {division.subject || division.debateTitle || "Division"}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Tá {division.taCount} · Níl {division.nilCount} · Staon {division.staonCount}
          {division.isBill ? " · Bill" : ""}
        </p>
      </button>
      {isExpanded && (
        <div className="border-t border-gray-100 p-4 dark:border-gray-800">
          {detailLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading detail…</p>
          ) : detail ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="py-1 pr-4">Party</th>
                    <th className="py-1 pr-4">Tá</th>
                    <th className="py-1 pr-4">Níl</th>
                    <th className="py-1 pr-4">Staon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {detail.byParty.map((row) => (
                    <tr key={row.party}>
                      <td className="py-1 pr-4 font-medium text-gray-800 dark:text-gray-200">
                        {row.party}
                      </td>
                      <td className="py-1 pr-4">{row.ta}</td>
                      <td className="py-1 pr-4">{row.nil}</td>
                      <td className="py-1 pr-4">{row.staon}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : detailError ? (
            <ErrorDisplay variant="inline" title="Failed to load this division" />
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No detail available.</p>
          )}
        </div>
      )}
    </article>
  );
}

function DivisionsSection() {
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.parliament.divisions(PAGE_SIZE, offset),
    queryFn: () => getParliament<DivisionSummary[]>(`/api/parliament/divisions?limit=${PAGE_SIZE}&offset=${offset}`),
  });

  const divisions = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  return (
    <section className={cardClass}>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Recent divisions</h2>
      {isLoading ? (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading divisions…</p>
      ) : isError ? (
        <ErrorDisplay variant="inline" title="Failed to load divisions" />
      ) : divisions.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {divisions.map((division) => (
              <DivisionRow key={division.id} division={division} />
            ))}
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
    </section>
  );
}

function DebatesSection() {
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.parliament.debates(PAGE_SIZE, offset),
    queryFn: () => getParliament<DebateSectionSummary[]>(`/api/parliament/debates?limit=${PAGE_SIZE}&offset=${offset}`),
  });

  const { data: detailResp, isLoading: detailLoading, isError: detailError } = useQuery({
    queryKey: queryKeys.parliament.debate(expandedId ?? ""),
    queryFn: () => getParliament<DebateSectionDetail>(`/api/parliament/debates/${encodeURIComponent(expandedId!)}`),
    enabled: !!expandedId,
  });

  const sections = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const detail = detailResp?.data;

  return (
    <section className={cardClass}>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Recent debates</h2>
      {isLoading ? (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading debates…</p>
      ) : isError ? (
        <ErrorDisplay variant="inline" title="Failed to load debates" />
      ) : sections.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {sections.map((section) => {
              const isExpanded = expandedId === section.id;
              return (
                <article
                  key={section.id}
                  className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : section.id)}
                    className="flex w-full flex-col gap-1 p-4 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatDate(section.date)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {section.speakerCount} speaker{section.speakerCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{section.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{section.speechCount} speeches</p>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 dark:border-gray-800">
                      {detailLoading ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Loading speakers…</p>
                      ) : detail && detail.speakers.length > 0 ? (
                        <ul className="space-y-2 text-sm">
                          {detail.speakers.map((speaker, index) => (
                            <li
                              key={speaker.memberCode ?? `${speaker.name}-${index}`}
                              className="flex items-center justify-between gap-3"
                            >
                              <span>
                                <TdLink name={speaker.name} />
                                {speaker.party && (
                                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{speaker.party}</span>
                                )}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {speaker.speeches} speech{speaker.speeches === 1 ? "" : "es"} · {speaker.words.toLocaleString()} words
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : detailError ? (
                        <ErrorDisplay variant="inline" title="Failed to load this debate" />
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No speaker detail available.</p>
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
    </section>
  );
}

function BillsSection({ initialExpandedId }: { initialExpandedId: string | null }) {
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<(typeof BILL_STATUS_OPTIONS)[number]>("All");
  const [source, setSource] = useState<(typeof BILL_SOURCE_OPTIONS)[number]>("All");
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.parliament.bills(status, source, PAGE_SIZE, offset),
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (status !== "All") params.set("status", status);
      if (source !== "All") params.set("source", source);
      return getParliament<BillSummary[]>(`/api/parliament/bills?${params.toString()}`);
    },
  });

  const { data: detailResp, isLoading: detailLoading, isError: detailError } = useQuery({
    queryKey: queryKeys.parliament.bill(expandedId ?? ""),
    queryFn: () => getParliament<BillDetail>(`/api/parliament/bills/${encodeURIComponent(expandedId!)}`),
    enabled: !!expandedId,
  });

  const total = data?.meta?.total ?? 0;
  const detail = detailResp?.data;
  // A bill opened from a link (?bill=<id>) may not be on this page of the list: show it first.
  const pageBills = data?.data ?? [];
  const bills: BillSummary[] =
    expandedId && detail?.id === expandedId && !pageBills.some((b) => b.id === expandedId) ? [detail, ...pageBills] : pageBills;

  return (
    <section className={cardClass}>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Bills</h2>

      <div className="mt-3 flex flex-wrap gap-4">
        <div className="flex flex-wrap gap-2">
          {BILL_STATUS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setStatus(option);
                setOffset(0);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                status === option
                  ? "bg-indigo-600 text-white dark:bg-indigo-500"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {BILL_SOURCE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setSource(option);
                setOffset(0);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                source === option
                  ? "bg-indigo-600 text-white dark:bg-indigo-500"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading bills…</p>
      ) : isError ? (
        <ErrorDisplay variant="inline" title="Failed to load bills" />
      ) : bills.length === 0 ? (
        <EmptyState message="No bills match these filters." />
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {bills.map((bill) => {
              const isExpanded = expandedId === bill.id;
              return (
                <article
                  key={bill.id}
                  className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : bill.id)}
                    className="flex w-full flex-col gap-1 p-4 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {bill.shortTitle}
                      </span>
                      <Badge variant="outline">{bill.status}</Badge>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {bill.source}
                      {bill.mostRecentStage ? ` · ${bill.mostRecentStage}` : ""}
                      {bill.act ? ` · Act ${bill.act}` : ""}
                    </p>
                    {bill.sponsors.length > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{bill.sponsors.join(", ")}</p>
                    )}
                  </button>
                  {isExpanded && (
                    <div className="space-y-4 border-t border-gray-100 p-4 dark:border-gray-800">
                      {detailLoading ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Loading detail…</p>
                      ) : detailError ? (
                        <ErrorDisplay variant="inline" title="Failed to load this bill" />
                      ) : detail ? (
                        <>
                          {detail.longTitle && (
                            <p className="text-sm text-gray-700 dark:text-gray-300">{detail.longTitle}</p>
                          )}

                          <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              Stages
                            </h4>
                            {detail.stages.length === 0 ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400">No stages recorded yet.</p>
                            ) : (
                              <ul className="space-y-1 text-sm">
                                {detail.stages.map((stage, idx) => (
                                  <li key={idx} className="flex items-center justify-between gap-3">
                                    <span className="text-gray-700 dark:text-gray-300">
                                      {stage.stage}
                                      {stage.chamber ? ` · ${stage.chamber}` : ""}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {formatDate(stage.date)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              Sponsors
                            </h4>
                            <ul className="space-y-1 text-sm">
                              {detail.sponsorList.map((sponsor, idx) => (
                                <li key={idx} className="flex flex-wrap items-center gap-2">
                                  {sponsor.tdId !== null && sponsor.name ? (
                                    <TdLink name={sponsor.name} />
                                  ) : (
                                    <span className="font-medium">{sponsor.name ?? sponsor.label}</span>
                                  )}
                                  {sponsor.party && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{sponsor.party}</span>
                                  )}
                                  {sponsor.isPrimary && (
                                    <Badge variant="outline" className="text-[10px]">
                                      Primary
                                    </Badge>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {(detail.latestVersionPdf || detail.memoPdf) && (
                            <div className="flex flex-wrap gap-4 text-sm">
                              {detail.latestVersionPdf && (
                                <a
                                  href={detail.latestVersionPdf}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-primary hover:underline"
                                >
                                  Latest text (PDF)
                                </a>
                              )}
                              {detail.memoPdf && (
                                <a
                                  href={detail.memoPdf}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-primary hover:underline"
                                >
                                  Explanatory memo (PDF)
                                </a>
                              )}
                            </div>
                          )}

                          <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              Divisions
                            </h4>
                            {detail.divisions.length === 0 ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                No divisions recorded for this bill.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {detail.divisions.map((division) => (
                                  <DivisionRow key={division.id} division={division} />
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No detail available.</p>
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
    </section>
  );
}

function LeaderboardSection() {
  const [metric, setMetric] = useState<LeaderboardMetric>("attendance");
  const [order, setOrder] = useState<"desc" | "asc">("desc");

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.parliament.leaderboard(metric, order, PAGE_SIZE),
    queryFn: () =>
      getParliament<LeaderboardEntry[]>(`/api/parliament/leaderboard?metric=${metric}&order=${order}&limit=${PAGE_SIZE}`),
  });

  const entries = data?.data ?? [];

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Leaderboards</h2>
        <div className="flex gap-2">
          <Button variant={order === "desc" ? "default" : "outline"} size="sm" onClick={() => setOrder("desc")}>
            Top
          </Button>
          <Button variant={order === "asc" ? "default" : "outline"} size="sm" onClick={() => setOrder("asc")}>
            Bottom
          </Button>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {LEADERBOARD_METRICS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              metric === m
                ? "bg-indigo-600 text-white dark:bg-indigo-500"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {METRIC_LABEL[m]}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading leaderboard…</p>
      ) : isError ? (
        <ErrorDisplay variant="inline" title="Failed to load leaderboard" />
      ) : entries.length === 0 ? (
        <EmptyState />
      ) : (
        <ol className="mt-4 space-y-2">
          {entries.map((entry, index) => (
            <li
              key={entry.tdId}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  #{index + 1}
                </span>
                <div className="min-w-0">
                  <TdLink name={entry.name} />
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {entry.party || "Ind"}
                    {entry.constituency ? ` • ${entry.constituency}` : ""}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-lg font-bold text-primary">{formatMetricValue(metric, entry.value)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function PartiesSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.parliament.parties(),
    queryFn: () => getParliament<PartyParliamentSummary[]>("/api/parliament/parties"),
  });

  const parties = data?.data ?? [];

  return (
    <section className={cardClass}>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Parties</h2>
      {isLoading ? (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading parties…</p>
      ) : isError ? (
        <ErrorDisplay variant="inline" title="Failed to load parties" />
      ) : parties.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="py-2 pr-4">Party</th>
                <th className="py-2 pr-4">Members</th>
                <th className="py-2 pr-4">Avg attendance</th>
                <th className="py-2 pr-4">Party-line %</th>
                <th className="py-2 pr-4">Avg sections spoken</th>
                <th className="py-2 pr-4">Avg committee attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {parties.map((party) => (
                <tr key={party.party} className="text-gray-700 dark:text-gray-200">
                  <td className="py-2 pr-4 font-medium">{party.party}</td>
                  <td className="py-2 pr-4">{party.members}</td>
                  <td className="py-2 pr-4">{formatPct(party.avgAttendancePct)}</td>
                  <td className="py-2 pr-4">{formatPct(party.partyLinePct)}</td>
                  <td className="py-2 pr-4">{party.avgSectionsSpoken === null ? "—" : party.avgSectionsSpoken.toFixed(1)}</td>
                  <td className="py-2 pr-4">{formatPct(party.avgCommitteeAttendancePct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const DebatesPage = () => {
  const search = useSearch();
  const { initialTab, initialBillId } = useMemo(() => {
    const params = new URLSearchParams(search);
    const tabParam = params.get("tab");
    const validTab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : null;
    return { initialTab: validTab, initialBillId: params.get("bill") };
    // Read once on load, same as the URL that produced this page mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "divisions");

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

  return (
    <div className="mobile-stack pb-20 w-full max-w-full overflow-x-hidden">
      <PageHeader
        className="mb-4"
        title="Debates"
        tooltipTitle="What you can do here"
        bullets={[
          "See recent Dáil divisions and how each party voted.",
          "Browse recent debate sections and who spoke.",
          "Compare TDs and parties on attendance, participation and questions.",
        ]}
        right={
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {throughDate ? `Data through ${formatDate(throughDate)}` : ""}
            {pendingDays > 0 ? ` · ${pendingDays} sitting day${pendingDays === 1 ? "" : "s"} not yet loaded` : ""}
          </span>
        }
      />

      <div className="mb-6">
        <nav
          className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-200 bg-white/80 p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900/60 sm:grid-cols-5"
          aria-label="Tabs"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "h-11 w-full rounded-xl px-2 text-xs font-semibold tracking-wide transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
                  isActive
                    ? "bg-primary text-white shadow"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="block truncate">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-6">
        {activeTab === "divisions" && <DivisionsSection />}
        {activeTab === "debates" && <DebatesSection />}
        {activeTab === "bills" && <BillsSection initialExpandedId={initialBillId} />}
        {activeTab === "leaderboard" && <LeaderboardSection />}
        {activeTab === "parties" && <PartiesSection />}
      </div>
    </div>
  );
};

export default DebatesPage;
