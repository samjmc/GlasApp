import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  LabelList,
} from "recharts";

type LeaderboardEntry = {
  tdId: number;
  name: string | null;
  party: string | null;
  constituency: string | null;
  imageUrl: string | null;
  performanceScore: number | null;
  effectivenessScore: number | null;
  influenceScore: number | null;
  lastDebateDate: string | null;
  lastUpdatedAt: string | null;
  sentimentScore?: number | null;
  wordsSpoken?: number | null;
  speeches?: number | null;
  uniqueTopics?: number | null;
  chamber?: string | null;
  title?: string | null;
  topSections?: Array<{
    title: string | null;
    wordCount: number | null;
    speechCount?: number | null;
  }>;
  lastContribution: {
    performanceDelta: number | null;
    effectivenessDelta: number | null;
    influenceDelta: number | null;
    calculatedAt: string | null;
    sectionTitle: string | null;
    debateTitle: string | null;
    debateDate: string | null;
    debateChamber: string | null;
    topics: string[];
    reasoning: string | null;
  } | null;
};

type LeaderboardResponse = {
  success: boolean;
  leaderboard: {
    generatedAt: string;
    period?: {
      key: string;
      label: string;
      start: string;
      end: string;
    };
    top: LeaderboardEntry[];
    bottom: LeaderboardEntry[];
  };
};

type HistoryEntry = {
  periodStart: string;
  periodEnd: string;
  wordsSpoken: number;
  speeches: number;
  uniqueTopics: number;
  sentimentScore?: number | null;
  effectivenessScore?: number | null;
  influenceScore?: number | null;
};

type HistoryResponse = {
  success: boolean;
  td?: {
    id: number;
    name: string | null;
    party: string | null;
    constituency: string | null;
  };
  period?: {
    key: string;
    label: string;
    start: string;
    end: string;
  };
  history: HistoryEntry[];
};

type MonitoringSummary = {
  success: boolean;
  stats: {
    totals: {
      debateDays: number;
      sections: number;
      speeches: number;
    };
    latestIngest: { date: string; ingestedAt: string | null } | null;
    taskQueue: Array<{ status: string; count: number }>;
    alerts: Array<{ status: string; count: number }>;
    exports: {
      total: number;
      lastRun: string | null;
      lastStatus: string | null;
    };
  };
};

const fetchLeaderboard = async (period: string): Promise<LeaderboardResponse> => {
  const params = new URLSearchParams({ period });
  const response = await fetch(`/api/debates/leaderboard?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load debate leaderboard");
  }
  return response.json();
};

type PartyMetricsResponse = {
  success: boolean;
  generatedAt: string;
  period?: {
    key: string;
    label: string;
    start: string;
    end: string;
  };
  parties: Array<{
    party: string;
    tdCount: number;
    avgPerformance: number;
    avgEffectiveness: number;
    avgInfluence: number;
    avgPerformanceDelta: number;
    totalPerformanceDelta: number;
    topPerformer: {
      tdId: number;
      name: string | null;
      performanceScore: number | null;
      lastPerformanceDelta: number | null;
    } | null;
  }>;
};

const fetchPartyMetrics = async (period: string): Promise<PartyMetricsResponse> => {
  const params = new URLSearchParams({ period });
  const response = await fetch(`/api/debates/party/metrics?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load party metrics");
  }
  return response.json();
};

type TopicMetricsResponse = {
  success: boolean;
  period?: {
    key: string;
    label: string;
    start: string;
    end: string;
  };
  topics: Array<{
    topic: string;
    minutes: number;
    tdCount: number;
    avgShare: number;
  }>;
};

type DebateDaySummary = {
  id: string;
  date: string | null;
  chamber: string | null;
  title: string | null;
  speeches: number | null;
  words: number | null;
  sectionCount: number;
  topSections: Array<{
    title: string | null;
    wordCount: number | null;
    speechCount: number | null;
  }>;
};

type WeeklyDebatesResponse = {
  success: boolean;
  period?: {
    key: string;
    label: string;
    start: string;
    end: string;
  };
  debates: DebateDaySummary[];
};

const fetchTopTopics = async (period: { start?: string; end?: string; key: string }): Promise<TopicMetricsResponse> => {
  const params = new URLSearchParams({ limit: "10", period: period.key });
  if (period.start) params.set("start", period.start);
  if (period.end) params.set("end", period.end);
  const response = await fetch(`/api/debates/topics/top?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load top debate topics");
  }
  return response.json();
};

const fetchWeeklyDebates = async (period: { start?: string; end?: string; key: string }): Promise<WeeklyDebatesResponse> => {
  const params = new URLSearchParams({ limit: "8", period: period.key });
  if (period.start) params.set("start", period.start);
  if (period.end) params.set("end", period.end);
  const response = await fetch(`/api/debates/weekly?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load weekly debate summaries");
  }
  return response.json();
};

const fetchMonitoringSummary = async (): Promise<MonitoringSummary["stats"]> => {
  const response = await fetch("/api/debate-monitoring/summary");
  if (!response.ok) {
    throw new Error("Failed to load monitoring summary");
  }
  const payload = await response.json();
  return payload?.stats;
};

type DebateAlert = {
  id: string;
  type: string;
  topic: string | null;
  summary: string;
  severity: string;
  status: string;
  td: {
    id: number;
    politician_name: string | null;
    party: string | null;
    constituency: string | null;
    image_url: string | null;
  } | null;
  confidence: number | null;
  triggeredAt: string;
  currentPosition: string | null;
  previousPosition: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  payload?: Record<string, any>;
};

const fetchAlerts = async (period: { start?: string; end?: string; key: string }): Promise<DebateAlert[]> => {
  const params = new URLSearchParams({ limit: "12", period: period.key });
  if (period.start) params.set("start", period.start);
  if (period.end) params.set("end", period.end);
  const response = await fetch(`/api/debates/alerts?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load debate alerts");
  }
  const payload = await response.json();
  const alerts = payload?.alerts ?? [];
  return alerts.map((item: any) => ({
    ...item,
    status: item.status ?? "new",
  }));
};

type HighlightParticipantImpact = {
  tdId: number;
  name: string;
  party: string | null;
  constituency: string | null;
  performanceScore: number | null;
  performanceDelta: number | null;
  effectivenessScore: number | null;
  effectivenessDelta: number | null;
  influenceScore: number | null;
  influenceDelta: number | null;
  performanceRating: "strong" | "moderate" | "weak" | "poor";
  overallEvaluationScore: number | null;
  reasoning: string | null;
  topics: string[];
  sentimentTotals: { positive: number; negative: number; neutral: number } | null;
};

type DebateHighlight = {
  id: string;
  headline: string;
  narrative: string;
  createdAt: string;
  debate: {
    id: string;
    date: string;
    chamber: string;
    title: string | null;
  } | null;
  section: {
    id: string;
    title: string | null;
  } | null;
  metadata: Record<string, any>;
  outcome?: {
    outcome: string;
    confidence: number;
    concessions: string | null;
  } | null;
  participants?: HighlightParticipantImpact[];
};

const fetchHighlights = async (period: { start?: string; end?: string; key: string }): Promise<DebateHighlight[]> => {
  const params = new URLSearchParams({ period: period.key });
  if (period.start) params.set("start", period.start);
  if (period.end) params.set("end", period.end);
  const response = await fetch(`/api/debates/highlights?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load debate highlights");
  }
  const payload = await response.json();
  const highlights = payload?.highlights ?? [];
  return highlights.map((item: any) => {
    const metadata = item.metadata ?? {};
    const participantsSource = Array.isArray(item.participants) ? item.participants : [];
    const participants: HighlightParticipantImpact[] = participantsSource.map((participant: any) => ({
      tdId: participant.tdId,
      name: participant.name,
      party: participant.party ?? null,
      constituency: participant.constituency ?? null,
      performanceScore: typeof participant.performanceScore === "number" ? participant.performanceScore : null,
      performanceDelta: typeof participant.performanceDelta === "number" ? participant.performanceDelta : null,
      effectivenessScore: typeof participant.effectivenessScore === "number" ? participant.effectivenessScore : null,
      effectivenessDelta: typeof participant.effectivenessDelta === "number" ? participant.effectivenessDelta : null,
      influenceScore: typeof participant.influenceScore === "number" ? participant.influenceScore : null,
      influenceDelta: typeof participant.influenceDelta === "number" ? participant.influenceDelta : null,
      performanceRating: (participant.performanceRating as HighlightParticipantImpact["performanceRating"]) ?? "moderate",
      overallEvaluationScore:
        typeof participant.overallEvaluationScore === "number" ? participant.overallEvaluationScore : null,
      reasoning: typeof participant.reasoning === "string" ? participant.reasoning : null,
      topics: Array.isArray(participant.topics) ? participant.topics : [],
      sentimentTotals: participant.sentimentTotals ?? null,
    }));
    return {
      ...item,
      metadata,
      outcome: item.outcome ?? metadata.outcome ?? null,
      participants,
    };
  });
};

const fetchHistory = async (
  identifier: string,
  period: { start?: string; end?: string; key: string }
): Promise<HistoryResponse | null> => {
  if (!identifier) return null;
  const params = new URLSearchParams({ periods: "12", period: period.key });
  if (period.start) params.set("start", period.start);
  if (period.end) params.set("end", period.end);
  const response = await fetch(`/api/debates/td/${encodeURIComponent(identifier)}/history?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load debate history");
  }
  return response.json();
};

const formatDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat("en-IE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatWordCount = (value: number) => {
  if (!Number.isFinite(value)) return "0 words";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k words`;
  return `${value} words`;
};

const formatCount = (value: number | string | null | undefined) => {
  const numeric =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return "0";
  return Math.round(numeric).toLocaleString();
};

const formatSentimentScore = (value: number | null | undefined) => {
  if (value === null || typeof value === "undefined") return "–";
  const percentage = (value * 100).toFixed(0);
  return `${value > 0 ? "+" : ""}${percentage}`;
};

const formatInfluenceScore = (value: number | null | undefined) => {
  if (value === null || typeof value === "undefined") return "–";
  return value.toFixed(1);
};

const formatEffectivenessScore = (value: number | null | undefined) => {
  if (value === null || typeof value === "undefined") return "–";
  return value.toFixed(1);
};

const PERIOD_PRESETS: Record<number, { key: string; label: string; weeks: number }> = {
  1: { key: "1w", label: "Past week", weeks: 1 },
  2: { key: "2w", label: "Past 2 weeks", weeks: 2 },
  4: { key: "1m", label: "Past month", weeks: 4 },
  12: { key: "1q", label: "Past quarter", weeks: 12 },
};

const formatPerformanceScore = (value: number | null | undefined) => {
  if (value === null || typeof value === "undefined") return "–";
  return value.toFixed(1);
};

const getRatingBadge = (rating: HighlightParticipantImpact["performanceRating"]) => {
  switch (rating) {
    case "strong":
      return { label: "Strong", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" };
    case "weak":
      return { label: "Weak", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200" };
    case "poor":
      return { label: "Poor", className: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200" };
    case "moderate":
    default:
      return { label: "Moderate", className: "bg-slate-200 text-slate-700 dark:bg-slate-600/30 dark:text-slate-200" };
  }
};

const formatDelta = (value: number | null | undefined) => {
  if (value === null || typeof value === "undefined") return "–";
  if (value === 0) return "0.00";
  const magnitude = Math.abs(value).toFixed(2);
  return `${value > 0 ? "+" : "-"}${magnitude}`;
};

// Removed legacy role formatter – highlight participants now use rating badges.

const DebatesPage = () => {
  const [periodWeeks, setPeriodWeeks] = useState<number>(1);
  const [selectedMeasure, setSelectedMeasure] = useState<'performance' | 'effectiveness' | 'influence'>('performance');
  const queryClient = useQueryClient();
  const cardClass =
    "mobile-card border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900";
  const accentCardClass =
    "mobile-card border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white shadow-sm dark:border-amber-500/40 dark:from-amber-950/20 dark:via-gray-900 dark:to-gray-900";

  const periodMeta = useMemo(() => {
    const preset = PERIOD_PRESETS[periodWeeks] ?? PERIOD_PRESETS[1];
    const today = new Date();
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - preset.weeks * 7 + 1);
    const startIso = start.toISOString().split("T")[0];
    const endIso = end.toISOString().split("T")[0];
    return {
      key: preset.key,
      label: preset.label,
      weeks: preset.weeks,
      start: startIso,
      end: endIso,
    };
  }, [periodWeeks]);
  const placeholderFeatures = useMemo(
    () => [
      "Real-time monitoring dashboard",
      "Influence & sentiment scoring",
      "Partner export workspace",
    ],
    []
  );

  const premiumPackages = useMemo(
    () => [
      {
        name: "Insights Essentials",
        description: "Weekly debate influence and sentiment summaries for newsletters and stakeholder updates.",
        features: ["Influence & sentiment scoring", "Top TD/party movers", "CSV exports & saved views"],
      },
      {
        name: "Newsroom Pro",
        description: "Live monitoring, alerts, and collaboration tools for editorial and policy teams.",
        features: ["Real-time monitoring dashboard", "Consistency alerts & flip-flop tracking", "Workspace with shared filters"],
      },
      {
        name: "Enterprise Watch",
        description: "Dedicated data feeds, SLA-backed monitoring, and bespoke analysis for partners.",
        features: ["API & data feed access", "Custom sentiment taxonomy", "Scheduled exports & delivery"],
      },
    ],
    []
  );

  const premiumModules = useMemo(
    () => [
      {
        title: "Influence Studio",
        description: "Deep dives on TD influence, sentiment drift, and debate impact with shareable charts.",
      },
      {
        title: "Alert Lab",
        description: "Consistency watchers, surge detection, and newsroom-ready alert workflows.",
      },
      {
        title: "Partner Workspace",
        description: "Collaborative saved views, scheduled exports, and premium workspaces for partners.",
      },
    ],
    []
  );

  const {
    data: leaderboardData,
    isLoading: leaderboardLoading,
    isError: leaderboardError,
    error: leaderboardErrorObj,
    refetch: refetchLeaderboard,
  } = useQuery({
    queryKey: ["debates", "leaderboard", periodMeta.key],
    queryFn: () => fetchLeaderboard(periodMeta.key),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: partyMetrics,
    isLoading: partyLoading,
    isError: partyError,
    error: partyErrorObj,
    refetch: refetchPartyMetrics,
  } = useQuery({
    queryKey: ["debates", "party-metrics", periodMeta.key],
    queryFn: () => fetchPartyMetrics(periodMeta.key),
    staleTime: 5 * 60 * 1000,
  });

  const partyChartData = useMemo(() => {
    if (!partyMetrics?.parties) return [];
    return partyMetrics.parties
      .filter((party) => party.party && party.party.toLowerCase() !== "unknown")
      .map((party) => ({
        name: party.party?.toLowerCase() === "people before profit" ? "PBP" : party.party,
        originalName: party.party,
        avgPerformance: party.avgPerformance,
        avgEffectiveness: party.avgEffectiveness,
        avgInfluence: party.avgInfluence,
        avgPerformanceDelta: party.avgPerformanceDelta,
      }));
  }, [partyMetrics]);

  // Calculate Y-axis domain for relative scaling
  const yAxisDomain = useMemo(() => {
    if (!partyChartData.length) return [0, 100];
    const measureKey = selectedMeasure === 'performance' ? 'avgPerformance' 
      : selectedMeasure === 'effectiveness' ? 'avgEffectiveness' 
      : 'avgInfluence';
    
    const values = partyChartData
      .map(d => d[measureKey] as number)
      .filter(v => typeof v === 'number' && !isNaN(v));
    
    if (values.length === 0) return [0, 100];
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const padding = range * 0.1; // 10% padding
    
    return [Math.max(0, min - padding), max + padding];
  }, [partyChartData, selectedMeasure]);

  const measureConfig = {
    performance: { key: 'avgPerformance', label: 'Performance', color: '#6366f1' },
    effectiveness: { key: 'avgEffectiveness', label: 'Effectiveness', color: '#22c55e' },
    influence: { key: 'avgInfluence', label: 'Influence', color: '#8b5cf6' },
  };

  const {
    data: topTopics,
    isLoading: topicsLoading,
    isError: topicsError,
    error: topicsErrorObj,
    refetch: refetchTopTopics,
  } = useQuery({
    queryKey: ["debates", "topic-leaders", periodMeta.key],
    queryFn: () => fetchTopTopics(periodMeta),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: alerts = [],
    isLoading: alertsLoading,
    isError: alertsError,
    error: alertsErrorObj,
    refetch: refetchAlerts,
  } = useQuery({
    queryKey: ["debates", "alerts", periodMeta.key],
    queryFn: () => fetchAlerts(periodMeta),
    staleTime: 2 * 60 * 1000,
  });

  const {
    data: highlights = [],
    isLoading: highlightsLoading,
    isError: highlightsError,
    error: highlightsErrorObj,
    refetch: refetchHighlights,
  } = useQuery({
    queryKey: ["debate-highlights", periodMeta.key],
    queryFn: () => fetchHighlights(periodMeta),
  });

  const {
    data: weeklyDebates,
    isLoading: weeklyLoading,
    isError: weeklyError,
    error: weeklyErrorObj,
    refetch: refetchWeeklyDebates,
  } = useQuery({
    queryKey: ["debates", "weekly", periodMeta.key],
    queryFn: () => fetchWeeklyDebates(periodMeta),
    staleTime: 5 * 60 * 1000,
  });

  const updateAlertStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/debates/alerts/${encodeURIComponent(id)}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error("Failed to update alert status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debates", "alerts"] });
    },
  });

  const leaderboardUpdatedAt = leaderboardData?.leaderboard.generatedAt
    ? new Date(leaderboardData.leaderboard.generatedAt).toLocaleDateString("en-IE", {
        month: "short",
        day: "numeric",
      })
    : null;
  const leaderboardPeriod = leaderboardData?.leaderboard.period ?? {
    key: periodMeta.key,
    label: periodMeta.label,
    start: periodMeta.start,
    end: periodMeta.end,
  };
  const partyPeriod = partyMetrics?.period ?? {
    key: periodMeta.key,
    label: periodMeta.label,
    start: periodMeta.start,
    end: periodMeta.end,
  };

  const topTDName =
    leaderboardData?.leaderboard.top && leaderboardData.leaderboard.top.length > 0
      ? leaderboardData.leaderboard.top[0].name || ""
      : "";

  const topPerformers = useMemo(() => {
    return (leaderboardData?.leaderboard.top || []).slice(0, 3);
  }, [leaderboardData]);

  const bottomPerformers = useMemo(() => {
    return (leaderboardData?.leaderboard.bottom || []).slice(0, 3);
  }, [leaderboardData]);

  const weeklyDebateSummaries = weeklyDebates?.debates ?? [];

  const weeklyTotals = useMemo(() => {
    if (!weeklyDebateSummaries.length) return null;
    const totalWords = weeklyDebateSummaries.reduce((acc, debate) => acc + (debate.words ?? 0), 0);
    const totalSpeeches = weeklyDebateSummaries.reduce((acc, debate) => acc + (debate.speeches ?? 0), 0);
    const totalSections = weeklyDebateSummaries.reduce((acc, debate) => acc + debate.sectionCount, 0);
    const busiestDay = weeklyDebateSummaries
      .slice()
      .sort((a, b) => (b.words ?? 0) - (a.words ?? 0))[0];
    return {
      totalWords,
      totalSpeeches,
      totalSections,
      busiestDay,
    };
  }, [weeklyDebateSummaries]);

  const {
    data: topHistory,
    isLoading: historyLoading,
    isError: historyError,
    error: historyErrorObj,
  } = useQuery({
    queryKey: ["debates", "history", topTDName, periodMeta.key],
    queryFn: () => fetchHistory(topTDName, periodMeta),
    enabled: !!topTDName,
    staleTime: 5 * 60 * 1000,
  });

  const trendSummary = (() => {
    const history = topHistory?.history || [];
    if (history.length < 2) return null;

    const latest = history[0];
    const previous = history[1];

    if (!latest || !previous) return null;

    const deltaWords = latest.wordsSpoken - previous.wordsSpoken;
    const percent =
      previous.wordsSpoken > 0 ? (deltaWords / previous.wordsSpoken) * 100 : 0;

    return {
      deltaWords,
      percent,
      direction: deltaWords > 0 ? "up" : deltaWords < 0 ? "down" : "flat",
    };
  })();

  const renderRankingCard = (entry: LeaderboardEntry, index: number, variant: "top" | "bottom") => {
    const performanceDelta = entry.lastContribution?.performanceDelta ?? null;
    const effectivenessDelta = entry.lastContribution?.effectivenessDelta ?? null;
    const influenceDelta = entry.lastContribution?.influenceDelta ?? null;
    const deltaLabel =
      typeof performanceDelta === "number" ? formatDelta(performanceDelta) : null;
    const deltaClass =
      typeof performanceDelta === "number"
        ? performanceDelta > 0
          ? "text-emerald-600 dark:text-emerald-400"
          : performanceDelta < 0
          ? "text-rose-600 dark:text-rose-400"
          : "text-gray-500 dark:text-gray-400"
        : "text-gray-500 dark:text-gray-400";
    const badgeClass =
      variant === "top"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
        : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200";
    const badgeLabel = variant === "top" ? "Top performer" : "Needs attention";
    const lastActivity =
      entry.lastContribution?.calculatedAt || entry.lastDebateDate || entry.lastUpdatedAt;

    return (
      <article
        key={`${variant}-${entry.tdId}`}
        className="rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm transition hover:border-primary/40 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 sm:p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-primary/80 dark:text-primary/70">
              #{index + 1} {variant === "top" ? "overall" : "under-performing"}
            </p>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-lg">
              {entry.name || "Unknown TD"}
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {entry.party || "Party N/A"}
              {entry.constituency ? ` • ${entry.constituency}` : ""}
            </p>
          </div>
          <div className="text-right">
            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
              {badgeLabel}
            </span>
            <div className="mt-1 text-2xl font-bold text-primary sm:text-3xl">
              {formatPerformanceScore(entry.performanceScore)}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Performance
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-gray-600 dark:text-gray-300">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Effectiveness
            </p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {formatEffectivenessScore(entry.effectivenessScore)}
            </p>
            {typeof effectivenessDelta === "number" && (
              <span
                className={`text-[10px] font-medium ${
                  effectivenessDelta > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : effectivenessDelta < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {formatDelta(effectivenessDelta)}
              </span>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Influence
            </p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {formatInfluenceScore(entry.influenceScore)}
            </p>
            {typeof influenceDelta === "number" && (
              <span
                className={`text-[10px] font-medium ${
                  influenceDelta > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : influenceDelta < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {formatDelta(influenceDelta)}
              </span>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Last activity
            </p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {lastActivity ? formatDate(lastActivity) : "No recent data"}
            </p>
            {deltaLabel && (
              <span className={`text-[10px] font-medium ${deltaClass}`}>
                Δ {deltaLabel}
              </span>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="mobile-stack pb-20 w-full max-w-full overflow-x-hidden">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold">Debate Intelligence</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Explore debate activity, speaker impact, and premium analysis coming to Glas Politics.
        </p>
        <div className="flex gap-4 text-sm">
          <button
            onClick={() => {
              refetchLeaderboard();
              refetchPartyMetrics();
              refetchTopTopics();
              refetchHighlights();
              refetchWeeklyDebates();
            refetchAlerts();
            }}
            className="rounded-md bg-primary px-3 py-1 font-medium text-white hover:bg-primary/90"
          >
            Refresh data
          </button>
          <Link
            href="/debates/workspace"
            className="rounded-md border border-primary px-3 py-1 font-medium text-primary hover:bg-primary/10"
          >
            Media workspace
          </Link>
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <span>Debates:</span>
            {weeklyLoading
              ? "Loading"
              : weeklyError
              ? "Error"
              : weeklyDebateSummaries.length}
            <span>• Ranked TDs:</span>
            {leaderboardLoading
              ? "Loading"
              : leaderboardError
              ? "Error"
              : (leaderboardData?.leaderboard.top.length || 0) + (leaderboardData?.leaderboard.bottom.length || 0)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400">Leaderboard window</span>
            <select
              value={periodWeeks}
              onChange={(event) => setPeriodWeeks(parseInt(event.target.value, 10))}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value={1}>Past week</option>
              <option value={2}>Past 2 weeks</option>
              <option value={4}>Past month</option>
              <option value={12}>Past quarter</option>
            </select>
          </label>
        </div>
      </header>

      <section className={`${cardClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              TD performance · {periodMeta.label}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Top movers and laggards based on debate performance, effectiveness, and influence.
            </p>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Window: {leaderboardPeriod.label}
            {leaderboardPeriod.start && leaderboardPeriod.end
              ? ` (${formatDate(leaderboardPeriod.start)} – ${formatDate(leaderboardPeriod.end)})`
              : ""}
            {leaderboardUpdatedAt ? ` · Updated ${leaderboardUpdatedAt}` : ""}
          </span>
        </div>
        {leaderboardLoading ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`leaderboard-skeleton-${index}`}
                className="h-40 animate-pulse rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
              />
            ))}
          </div>
        ) : leaderboardError ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {leaderboardErrorObj instanceof Error ? leaderboardErrorObj.message : "Failed to load leaderboard."}
          </p>
        ) : topPerformers.length === 0 && bottomPerformers.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            No TD performance data available for the last 30 days.
          </p>
        ) : (
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Top performers ({periodMeta.label})
              </h3>
              <div className="mt-3 space-y-4">
                {topPerformers.map((entry, index) => renderRankingCard(entry, index, "top"))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Under-performing trend ({periodMeta.label})
              </h3>
              <div className="mt-3 space-y-4">
                {bottomPerformers.map((entry, index) => renderRankingCard(entry, index, "bottom"))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className={`${cardClass}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Debate highlights</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {highlightsLoading ? "Loading…" : `${highlights.length} latest`}
          </span>
        </div>
        {highlightsLoading ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Compiling fresh highlights…</p>
        ) : highlightsError ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {highlightsErrorObj instanceof Error ? highlightsErrorObj.message : "Failed to load debate highlights"}
          </p>
        ) : highlights.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No highlights generated yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {highlights.map((highlight) => (
              <details
                key={highlight.id}
                className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-primary/40 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                <summary className="flex cursor-pointer list-none flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary dark:text-primary/80">
                    <span>{formatDate(highlight.debate?.date || highlight.createdAt)}</span>
                    <span>•</span>
                    <span>{highlight.debate?.chamber?.toUpperCase?.() || highlight.debate?.chamber || 'DÁIL'}</span>
                    {highlight.outcome && (
                      <>
                        <span>•</span>
                        <span>{highlight.outcome.outcome?.toUpperCase() || "Outcome"}</span>
                      </>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 transition group-open:text-primary dark:text-gray-100 dark:group-open:text-primary/80">
                    {highlight.headline}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Click to view summary
                  </p>
                </summary>
                <div className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                  <p className="whitespace-pre-line">{highlight.narrative}</p>
                  {highlight.debate?.title && (
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      Debate: {highlight.debate.title}
                    </p>
                  )}
                  {highlight.outcome && (
                    <div className="mt-3 text-xs">
                      <p className="font-semibold text-gray-700 dark:text-gray-300">Outcome details</p>
                      {typeof highlight.outcome.confidence === "number" && (
                        <p className="mt-1 text-gray-600 dark:text-gray-400">
                          Winner confidence: {Math.round((highlight.outcome.confidence || 0) * 100)}%
                        </p>
                      )}
                      {highlight.outcome.concessions && (
                        <p className="mt-1 text-emerald-600 dark:text-emerald-400">
                          Key concessions: {highlight.outcome.concessions}
                        </p>
                      )}
                    </div>
                  )}
                  {highlight.participants && highlight.participants.length > 0 && (
                    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-800/40">
                      <p className="font-semibold text-gray-700 dark:text-gray-200">Score impact</p>
                      <div className="mt-3 space-y-3">
                        {highlight.participants.map((participant) => {
                          const badge = getRatingBadge(participant.performanceRating);
                          return (
                            <div
                              key={participant.tdId}
                              className="rounded-md border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {participant.name}
                                  </p>
                                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    {participant.party ?? "Independent"}
                                    {participant.constituency ? ` • ${participant.constituency}` : ""}
                                  </p>
                                </div>
                                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${badge.className}`}>
                                  {badge.label}
                                </span>
                              </div>
                              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div>
                                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Performance
                                  </p>
                                  <p className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                                    {formatPerformanceScore(participant.performanceScore)}
                                    {participant.performanceDelta !== null && (
                                      <span
                                        className={`text-[11px] font-semibold ${
                                          participant.performanceDelta > 0
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : participant.performanceDelta < 0
                                            ? "text-rose-600 dark:text-rose-400"
                                            : "text-gray-500 dark:text-gray-400"
                                        }`}
                                      >
                                        {formatDelta(participant.performanceDelta)}
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Effectiveness
                                  </p>
                                  <p className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                                    {formatEffectivenessScore(participant.effectivenessScore)}
                                    {participant.effectivenessDelta !== null && (
                                      <span
                                        className={`text-[11px] font-semibold ${
                                          participant.effectivenessDelta > 0
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : participant.effectivenessDelta < 0
                                            ? "text-rose-600 dark:text-rose-400"
                                            : "text-gray-500 dark:text-gray-400"
                                        }`}
                                      >
                                        {formatDelta(participant.effectivenessDelta)}
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Influence
                                  </p>
                                  <p className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                                    {formatInfluenceScore(participant.influenceScore)}
                                    {participant.influenceDelta !== null && (
                                      <span
                                        className={`text-[11px] font-semibold ${
                                          participant.influenceDelta > 0
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : participant.influenceDelta < 0
                                            ? "text-rose-600 dark:text-rose-400"
                                            : "text-gray-500 dark:text-gray-400"
                                        }`}
                                      >
                                        {formatDelta(participant.influenceDelta)}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              {participant.topics.length > 0 && (
                                <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
                                  Topics: {participant.topics.slice(0, 6).join(", ")}
                                </p>
                              )}
                              {participant.reasoning && (
                                <p className="mt-2 text-[11px] italic text-gray-500 dark:text-gray-400">
                                  {participant.reasoning}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className={`${cardClass} space-y-4`}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Latest debate snapshots</h2>
          <button
            onClick={() => refetchWeeklyDebates()}
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            Refresh
          </button>
        </div>

        {weeklyLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`debate-skeleton-${index}`}
                className="animate-pulse rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="h-5 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="mt-3 space-y-2">
                  <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            ))}
          </div>
        ) : weeklyError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
            {weeklyErrorObj instanceof Error ? weeklyErrorObj.message : "Unable to load weekly debate summaries"}
          </div>
        ) : weeklyDebateSummaries.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            <p className="text-sm">No debates recorded over the last few days.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {weeklyDebateSummaries.slice(0, 4).map((debate) => {
              const sections = Array.isArray(debate.topSections) ? debate.topSections : [];
              const topSectionWithContent =
                sections.find((section) => (section?.wordCount || 0) > 0) ??
                sections[0];
              const displayTitle =
                debate.title && debate.title.trim().length > 0 && debate.title.trim().toLowerCase() !== "debate"
                  ? debate.title
                  : topSectionWithContent?.title || `${debate.chamber ?? "Debate"} session`;
              const debateDate = debate.date ? formatDate(debate.date) : "Recent debate";

              return (
                <article
                  key={debate.id}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-primary/40 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex items-start justify-between gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{debateDate}</span>
                    <span>{debate.chamber?.toUpperCase?.() || debate.chamber || "Oireachtas"}</span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">{displayTitle}</h3>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {formatWordCount(debate.words ?? 0)} · {formatCount(debate.speeches)} speeches ·{" "}
                    {formatCount(debate.sectionCount)} sections
                  </p>
                  {sections.length > 0 ? (
                    <ul className="mt-4 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                      {sections.slice(0, 4).map((section, index) => (
                        <li key={`${debate.id}-section-${index}`} className="flex items-center justify-between gap-2">
                          <span className="truncate">{section.title && section.title.trim().length > 0 ? section.title : `Section ${index + 1}`}</span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {formatWordCount(section.wordCount ?? 0)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">Sections still processing summaries.</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Week in review</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {weeklyDebateSummaries.length > 0
              ? `${weeklyDebateSummaries.length} debate day${weeklyDebateSummaries.length === 1 ? "" : "s"}`
              : "Awaiting data"}
          </span>
        </div>
        {weeklyLoading ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Compiling weekly debate activity…</p>
        ) : weeklyError ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">Unable to load weekly debate metrics.</p>
        ) : weeklyDebateSummaries.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No debate data found for this period.</p>
        ) : (
          <>
            {weeklyTotals && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-primary/5 p-4 text-sm text-primary dark:bg-primary/20">
                  <p className="text-xs uppercase tracking-wide text-primary/80 dark:text-primary/70">Words spoken</p>
                  <p className="mt-1 text-xl font-semibold text-primary">
                    {formatWordCount(weeklyTotals.totalWords)}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                  <p className="text-xs uppercase tracking-wide">Speeches logged</p>
                  <p className="mt-1 text-xl font-semibold">{formatCount(weeklyTotals.totalSpeeches)}</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700 dark:bg-slate-700/40 dark:text-slate-200">
                  <p className="text-xs uppercase tracking-wide">Debate sections</p>
                  <p className="mt-1 text-xl font-semibold">{formatCount(weeklyTotals.totalSections)}</p>
                </div>
              </div>
            )}
            {weeklyTotals?.busiestDay && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <span className="font-semibold">Busiest day:</span>{" "}
                {formatDate(weeklyTotals.busiestDay.date || new Date().toISOString())} ·{" "}
                {formatWordCount(weeklyTotals.busiestDay.words ?? 0)} ·{" "}
                {formatCount(weeklyTotals.busiestDay.speeches)} speeches
              </div>
            )}
            <div className="mt-4 space-y-3 text-xs text-gray-600 dark:text-gray-300">
              {weeklyDebateSummaries.slice(0, 8).map((debate) => (
                <div
                  key={`weekly-summary-${debate.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/40"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatDate(debate.date || new Date().toISOString())}
                    </span>
                    <span className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {debate.chamber?.toUpperCase?.() || debate.chamber || "Oireachtas"} ·{" "}
                      {debate.title && debate.title.trim().length > 0 ? debate.title : "Session highlights"}
                    </span>
                  </div>
                  <div className="flex gap-3 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                    <span>{formatWordCount(debate.words ?? 0)}</span>
                    <span>{formatCount(debate.speeches)} speeches</span>
                    <span>{formatCount(debate.sectionCount)} sections</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Party comparison</h2>
          {partyMetrics?.generatedAt && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Window: {partyPeriod.label}
              {partyPeriod.start && partyPeriod.end
                ? ` (${formatDate(partyPeriod.start)} – ${formatDate(partyPeriod.end)})`
                : ""}
              {` · Updated ${formatDate(partyMetrics.generatedAt)}`}
            </span>
          )}
        </div>
        {partyLoading ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading party aggregates…</p>
        ) : partyError ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {partyErrorObj instanceof Error ? partyErrorObj.message : "Failed to load party metrics"}
          </p>
        ) : partyChartData.length ? (
          <>
            {/* Measure Filter */}
            <div className="mt-4 flex gap-2">
              {(['performance', 'effectiveness', 'influence'] as const).map((measure) => {
                const config = measureConfig[measure];
                const isActive = selectedMeasure === measure;
                return (
                  <button
                    key={measure}
                    onClick={() => setSelectedMeasure(measure)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {config.label}
                  </button>
                );
              })}
            </div>
            
            <div className="mt-4 h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={partyChartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                  barCategoryGap="5%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                  <XAxis 
                    dataKey="name" 
                    hide={true}
                  />
                  <YAxis 
                    domain={yAxisDomain}
                    tick={{ fontSize: 12 }} 
                    tickFormatter={(value) => Number(value).toFixed(1)} 
                  />
                  <Tooltip
                    formatter={(value: number) => [`${Number(value).toFixed(2)}`, measureConfig[selectedMeasure].label]}
                    labelFormatter={(label) => `Party: ${label}`}
                  />
                  <Bar 
                    dataKey={measureConfig[selectedMeasure].key} 
                    name={measureConfig[selectedMeasure].label} 
                    fill={measureConfig[selectedMeasure].color} 
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList 
                      dataKey="name" 
                      position="inside" 
                      fill="#fff"
                      fontSize={11}
                      fontWeight="medium"
                      angle={-90}
                      textAnchor="middle"
                      className="dark:fill-white"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="py-2 pr-4">Party</th>
                    <th className="py-2 pr-4">TDs</th>
                    <th className="py-2 pr-4">Avg performance</th>
                    <th className="py-2 pr-4">Avg effectiveness</th>
                    <th className="py-2 pr-4">Avg influence</th>
                    <th className="py-2 pr-4">Avg Δ (30d)</th>
                    <th className="py-2 pr-4">Total Δ</th>
                    <th className="py-2 pr-4">Top performer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {(partyMetrics?.parties ?? [])
                    .filter((party) => party.party && party.party.toLowerCase() !== "unknown")
                    .map((party) => {
                    const avgDeltaClass =
                      party.avgPerformanceDelta > 0
                        ? "text-emerald-600 dark:text-emerald-300"
                        : party.avgPerformanceDelta < 0
                        ? "text-rose-600 dark:text-rose-300"
                        : "text-gray-500 dark:text-gray-400";
                    const totalDeltaClass =
                      party.totalPerformanceDelta > 0
                        ? "text-emerald-600 dark:text-emerald-300"
                        : party.totalPerformanceDelta < 0
                        ? "text-rose-600 dark:text-rose-300"
                        : "text-gray-500 dark:text-gray-400";
                    return (
                      <tr key={party.party} className="text-gray-700 dark:text-gray-200">
                        <td className="py-2 pr-4 font-medium">
                          {party.party?.toLowerCase() === "people before profit" ? "PBP" : party.party}
                        </td>
                        <td className="py-2 pr-4">{formatCount(party.tdCount)}</td>
                        <td className="py-2 pr-4">{formatPerformanceScore(party.avgPerformance)}</td>
                        <td className="py-2 pr-4">{formatEffectivenessScore(party.avgEffectiveness)}</td>
                        <td className="py-2 pr-4">{formatInfluenceScore(party.avgInfluence)}</td>
                        <td className={`py-2 pr-4 font-semibold ${avgDeltaClass}`}>
                          {formatDelta(party.avgPerformanceDelta)}
                        </td>
                        <td className={`py-2 pr-4 font-semibold ${totalDeltaClass}`}>
                          {formatDelta(party.totalPerformanceDelta)}
                        </td>
                        <td className="py-2 pr-4">
                          {party.topPerformer ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {party.topPerformer.name ?? "Leading TD"}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Score {formatPerformanceScore(party.topPerformer.performanceScore)}
                                {typeof party.topPerformer.lastPerformanceDelta === "number" && (
                                  <>
                                    {" "}
                                    · Δ {formatDelta(party.topPerformer.lastPerformanceDelta)}
                                  </>
                                )}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Party metrics will appear after the first aggregation run.
          </p>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="text-2xl font-semibold">Topic spotlight</h2>
        {topicsLoading ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading topic leaders…</p>
        ) : topicsError ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {topicsErrorObj instanceof Error ? topicsErrorObj.message : "Failed to load topic data"}
          </p>
        ) : topTopics?.topics?.length ? (
          <div className="mt-4 grid gap-3">
            {topTopics.topics.map((topic) => (
              <div key={topic.topic} className="space-y-1">
                <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
                  <span className="font-medium">{topic.topic}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {topic.tdCount} TDs · {topic.minutes.toFixed(1)} mins
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${Math.min(100, topic.avgShare * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Topic coverage will appear once stance extraction is complete.
          </p>
        )}
      </section>

      <section className={accentCardClass}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <span role="img" aria-label="alert">
              ⚠️
            </span>
            Consistency alerts
          </h2>
          <span className="text-xs text-amber-700 dark:text-amber-300">Premium signal</span>
        </div>
        {alertsLoading ? (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Scanning debates for shifts…</p>
        ) : alertsError ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {alertsErrorObj instanceof Error ? alertsErrorObj.message : "Failed to load alerts"}
          </p>
        ) : alerts.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            No major consistency changes detected during this period.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {alerts.map((alert) => (
              <article
                key={alert.id}
                className="rounded-xl border border-amber-200 bg-white/90 px-4 py-3 shadow-sm transition hover:shadow-md dark:border-amber-500/30 dark:bg-amber-950/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-amber-700 dark:text-amber-200">
                      <span>{alert.type === "flip_flop" ? "Flip-flop alert" : "Topic surge"}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[0.65rem] font-semibold ${
                          alert.status === "resolved"
                            ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-200"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100"
                        }`}
                      >
                        {alert.status === "resolved" ? "Reviewed" : "New"}
                      </span>
                      {alert.confidence !== null && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-100">
                          {(alert.confidence * 100).toFixed(0)}% confidence
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{alert.summary}</h3>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {alert.topic && <span>Topic: {alert.topic}</span>}
                      {alert.previousPosition && alert.currentPosition && (
                        <span className="ml-2">
                          {alert.previousPosition} → {alert.currentPosition}
                        </span>
                      )}
                    </div>
                  </div>
                  {alert.td?.politician_name && (
                    <div className="text-right text-xs text-gray-600 dark:text-gray-300">
                      <Link
                        href={`/my-politics/${encodeURIComponent(alert.td.politician_name)}`}
                        className="font-semibold text-gray-900 hover:text-primary dark:text-gray-100"
                      >
                        {alert.td.politician_name}
                      </Link>
                      {alert.td.party && <div>{alert.td.party}</div>}
                      {alert.td.constituency && <div>{alert.td.constituency}</div>}
                    </div>
                  )}
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => updateAlertStatus.mutate({ id: alert.id, status: "resolved" })}
                    disabled={alert.status === "resolved" || updateAlertStatus.isPending}
                    className="rounded-md border border-transparent bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:bg-emerald-500/30"
                  >
                    {alert.status === "resolved" ? "Marked reviewed" : "Mark as reviewed"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="text-xl font-semibold">Trend spotlight</h2>
        {historyLoading ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading weekly history…</p>
        ) : historyError ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {historyErrorObj instanceof Error ? historyErrorObj.message : "Unable to load history"}
          </p>
        ) : topHistory?.history?.length ? (
          <>
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600 dark:text-gray-400">
                <span>
                  {topHistory.td?.name || "Leading TD"} · Past {topHistory.history.length} weeks
                </span>
                {trendSummary && (
                  <span
                    className={`font-medium ${
                      trendSummary.direction === "up"
                        ? "text-emerald-600"
                        : trendSummary.direction === "down"
                        ? "text-red-500"
                        : "text-gray-500"
                    }`}
                  >
                    {trendSummary.direction === "up" ? "▲" : trendSummary.direction === "down" ? "▼" : "→"}{" "}
                    {Math.abs(trendSummary.deltaWords).toLocaleString()} words (
                    {trendSummary.percent.toFixed(1)}%)
                  </span>
                )}
              </div>

              <div className="mt-4 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[...topHistory.history].reverse().map((entry) => ({
                      label: new Date(entry.periodEnd).toLocaleDateString("en-IE", {
                        month: "short",
                        day: "numeric",
                      }),
                      words: entry.wordsSpoken,
                    }))}
                    margin={{ top: 10, right: 20, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="words"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 grid gap-3 text-xs text-gray-600 dark:text-gray-300">
                {topHistory.history.slice(0, 4).map((entry) => (
                  <div key={`${entry.periodStart}-${entry.periodEnd}`} className="flex items-center justify-between">
                    <div>
                      {new Date(entry.periodStart).toLocaleDateString("en-IE", {
                        month: "short",
                        day: "numeric",
                      })}
                      {" – "}
                      {new Date(entry.periodEnd).toLocaleDateString("en-IE", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {formatWordCount(entry.wordsSpoken)} · {entry.speeches} speeches · Eff{" "}
                      {formatEffectivenessScore(entry.effectivenessScore)} · Influence{" "}
                      {formatInfluenceScore(entry.influenceScore)} · Sentiment {formatSentimentScore(entry.sentimentScore)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Weekly history will appear once metrics have multiple entries.
          </p>
        )}
      </section>

      <section className={cardClass}>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Weekly highlights</h2>
          <button
            type="button"
            onClick={() => refetchHighlights()}
            className="rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:border-primary hover:text-primary dark:border-gray-700 dark:text-gray-300 dark:hover:border-primary dark:hover:text-primary"
          >
            Refresh
          </button>
        </div>
        {highlightsLoading ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Generating debate highlights…</p>
        ) : highlightsError ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {highlightsErrorObj instanceof Error ? highlightsErrorObj.message : "Failed to load debate highlights"}
          </p>
        ) : highlights.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No highlights generated yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {highlights.map((highlight) => (
              <details
                key={highlight.id}
                className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-primary/40 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                <summary className="flex cursor-pointer list-none flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary dark:text-primary/80">
                    <span>{formatDate(highlight.debate?.date || highlight.createdAt)}</span>
                    <span>•</span>
                    <span>{highlight.debate?.chamber?.toUpperCase?.() || highlight.debate?.chamber || 'DÁIL'}</span>
                    {highlight.outcome && (
                      <>
                        <span>•</span>
                        <span>{highlight.outcome.outcome?.toUpperCase() || "Outcome"}</span>
                      </>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 transition group-open:text-primary dark:text-gray-100 dark:group-open:text-primary/80">
                    {highlight.headline}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Click to view summary
                  </p>
                </summary>
                <div className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                  <p className="whitespace-pre-line">{highlight.narrative}</p>
                  {highlight.debate?.title && (
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      Debate: {highlight.debate.title}
                    </p>
                  )}
                  {highlight.outcome && (
                    <div className="mt-3 text-xs">
                      <p className="font-semibold text-gray-700 dark:text-gray-300">Outcome details</p>
                      {typeof highlight.outcome.confidence === "number" && (
                        <p className="mt-1 text-gray-600 dark:text-gray-400">
                          Winner confidence: {Math.round((highlight.outcome.confidence || 0) * 100)}%
                        </p>
                      )}
                      {highlight.outcome.concessions && (
                        <p className="mt-1 text-emerald-600 dark:text-emerald-400">
                          Key concessions: {highlight.outcome.concessions}
                        </p>
                      )}
                    </div>
                  )}
                  {highlight.participants && highlight.participants.length > 0 && (
                    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-800/40">
                      <p className="font-semibold text-gray-700 dark:text-gray-200">Score impact</p>
                      <div className="mt-3 space-y-3">
                        {highlight.participants.map((participant) => {
                          const badge = getRatingBadge(participant.performanceRating);
                          return (
                            <div
                              key={participant.tdId}
                              className="rounded-md border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {participant.name}
                                  </p>
                                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    {participant.party ?? "Independent"}
                                    {participant.constituency ? ` • ${participant.constituency}` : ""}
                                  </p>
                                </div>
                                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${badge.className}`}>
                                  {badge.label}
                                </span>
                              </div>
                              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div>
                                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Performance
                                  </p>
                                  <p className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                                    {formatPerformanceScore(participant.performanceScore)}
                                    {participant.performanceDelta !== null && (
                                      <span
                                        className={`text-[11px] font-semibold ${
                                          participant.performanceDelta > 0
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : participant.performanceDelta < 0
                                            ? "text-rose-600 dark:text-rose-400"
                                            : "text-gray-500 dark:text-gray-400"
                                        }`}
                                      >
                                        {formatDelta(participant.performanceDelta)}
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Effectiveness
                                  </p>
                                  <p className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                                    {formatEffectivenessScore(participant.effectivenessScore)}
                                    {participant.effectivenessDelta !== null && (
                                      <span
                                        className={`text-[11px] font-semibold ${
                                          participant.effectivenessDelta > 0
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : participant.effectivenessDelta < 0
                                            ? "text-rose-600 dark:text-rose-400"
                                            : "text-gray-500 dark:text-gray-400"
                                        }`}
                                      >
                                        {formatDelta(participant.effectivenessDelta)}
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Influence
                                  </p>
                                  <p className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                                    {formatInfluenceScore(participant.influenceScore)}
                                    {participant.influenceDelta !== null && (
                                      <span
                                        className={`text-[11px] font-semibold ${
                                          participant.influenceDelta > 0
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : participant.influenceDelta < 0
                                            ? "text-rose-600 dark:text-rose-400"
                                            : "text-gray-500 dark:text-gray-400"
                                        }`}
                                      >
                                        {formatDelta(participant.influenceDelta)}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              {participant.topics.length > 0 && (
                                <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
                                  Topics: {participant.topics.slice(0, 6).join(", ")}
                                </p>
                              )}
                              {participant.reasoning && (
                                <p className="mt-2 text-[11px] italic text-gray-500 dark:text-gray-400">
                                  {participant.reasoning}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default DebatesPage;
