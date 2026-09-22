import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
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
} from "@shared/parliamentApi";
import { LEADERBOARD_METRICS } from "@shared/parliamentApi";

type ApiEnvelope<T> = { success: true; data: T; meta?: { total: number } };

async function getParliament<T>(path: string): Promise<ApiEnvelope<T>> {
  return apiClient.get<ApiEnvelope<T>>(path);
}

const PAGE_SIZE = 20;

const formatDate = (value: string | null) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-IE", { year: "numeric", month: "short", day: "numeric" }).format(
      new Date(value)
    );
  } catch {
    return value;
  }
};

const formatPct = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)}%`);
const formatNum = (value: number | null) => (value === null ? "—" : value.toLocaleString());

const VOTE_LABEL: Record<string, string> = { ta: "Tá", nil: "Níl", staon: "Staon" };

const METRIC_LABEL: Record<LeaderboardMetric, string> = {
  attendance: "Attendance",
  participation: "Participation",
  questions: "Questions",
};

const formatMetricValue = (metric: LeaderboardMetric, value: number) => {
  if (metric === "attendance") return `${value.toFixed(1)}%`;
  if (metric === "participation") return value.toFixed(1);
  return formatNum(value);
};

type Tab = "divisions" | "debates" | "leaderboard" | "parties";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "divisions", label: "Divisions" },
  { key: "debates", label: "Debates" },
  { key: "leaderboard", label: "Leaderboards" },
  { key: "parties", label: "Parties" },
];

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

function DivisionsSection() {
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.parliament.divisions(PAGE_SIZE, offset),
    queryFn: () => getParliament<DivisionSummary[]>(`/api/parliament/divisions?limit=${PAGE_SIZE}&offset=${offset}`),
  });

  const { data: detailResp, isLoading: detailLoading } = useQuery({
    queryKey: queryKeys.parliament.division(expandedId ?? ""),
    queryFn: () => getParliament<DivisionDetail>(`/api/parliament/divisions/${encodeURIComponent(expandedId!)}`),
    enabled: !!expandedId,
  });

  const divisions = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const detail = detailResp?.data;

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
            {divisions.map((division) => {
              const isExpanded = expandedId === division.id;
              return (
                <article
                  key={division.id}
                  className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : division.id)}
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

function DebatesSection() {
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.parliament.debates(PAGE_SIZE, offset),
    queryFn: () => getParliament<DebateSectionSummary[]>(`/api/parliament/debates?limit=${PAGE_SIZE}&offset=${offset}`),
  });

  const { data: detailResp, isLoading: detailLoading } = useQuery({
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
          {order === "desc" ? (
            <Button variant="default" size="sm" onClick={() => setOrder("asc")}>
              Top
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setOrder("asc")}>
              Top
            </Button>
          )}
          {order === "asc" ? (
            <Button variant="default" size="sm" onClick={() => setOrder("desc")}>
              Bottom
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setOrder("desc")}>
              Bottom
            </Button>
          )}
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
  const [activeTab, setActiveTab] = useState<Tab>("divisions");

  const { data: statusResp } = useQuery({
    queryKey: queryKeys.parliament.status(),
    queryFn: () => getParliament<ParliamentStatus>("/api/parliament/status"),
  });

  const throughDate = useMemo(() => {
    const dates = (statusResp?.data.feeds ?? [])
      .map((feed) => feed.throughDate)
      .filter((d): d is string => !!d)
      .sort();
    return dates.length ? dates[dates.length - 1] : null;
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
          </span>
        }
      />

      <div className="mb-6">
        <nav
          className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-200 bg-white/80 p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900/60 sm:grid-cols-4"
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
        {activeTab === "leaderboard" && <LeaderboardSection />}
        {activeTab === "parties" && <PartiesSection />}
      </div>
    </div>
  );
};

export default DebatesPage;
