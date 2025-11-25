import { supabase } from "@/lib/supabase";

export interface DailySessionItem {
  id: number;
  sessionItemId: number;
  articleId: number;
  policyVoteId?: number | null;
  headline: string;
  summary: string;
  policyDimension: string | null;
  policyDirection: string | null;
  orderIndex: number;
  hasVoted: boolean;
  rating?: number;
  selectedOption?: string | null; // NEW: Option key when using multiple choice
  answerOptions?: Record<string, string> | null; // NEW: Multiple choice options
  politicianName?: string | null;
  prompt?: string;
  emoji?: string;
  highlightStats?: string[];
  contextNote?: string;
  articleUrl?: string | null;
  imageUrl?: string | null;
  quickExplainer?: DailySessionQuickExplainer;
}

export interface DailySessionDimensionShift {
  ideologyDimension: string;
  axisLabel: string;
  delta: number;
  deltaPercent: number;
  before: number;
  after: number;
  direction: "left" | "right" | "neutral";
}

export interface DailySessionCompletion {
  ideologySummary: string;
  ideologyDelta: number;
  ideologyAxis: string;
  ideologyDirection: "left" | "right" | "neutral";
  regionSummary: string;
  regionDimension?: string;
  regionPreviousRank?: number;
  regionCurrentRank?: number;
  streakCount: number;
  userComparison?: string;
  regionComparison?: string;
  constituencyTrend?: string;
  dimensionShifts: DailySessionDimensionShift[];
  historySnapshot?: {
    previousDate: string;
    previousAxis: string;
    previousDirection: "left" | "right" | "neutral";
    previousDelta: number;
    deltaChange: number;
    streakChange: number;
  };
  detailStats?: Array<{
    label: string;
    value: string;
    emoji?: string;
  }>;
}

export interface DailySessionState {
  status: "pending" | "completed";
  sessionId: number;
  sessionDate: string;
  voteCount: number;
  streakCount: number;
  items: DailySessionItem[];
  completion?: DailySessionCompletion;
}

export interface DailySessionQuickExplainer {
  one_sentence: string;
  pros: [string, string];
  cons: [string, string];
}

interface AuthorizedRequestOptions {
  method?: string;
  body?: unknown;
  force?: boolean;
}

async function authorizedRequest<T>(
  path: string,
  { method = "GET", body, force = false }: AuthorizedRequestOptions = {}
): Promise<T> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("Error retrieving Supabase session:", sessionError);
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const url = force ? `${path}${path.includes("?") ? "&" : "?"}force=true` : path;

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchDailySession(force?: boolean): Promise<DailySessionState> {
  const response = await authorizedRequest<{
    success: boolean;
    session: DailySessionState;
  }>("/api/daily-session", { force: force === true });

  if (!response.success) {
    throw new Error("Failed to load daily session");
  }

  return response.session;
}

export async function submitDailyVote(
  sessionItemId: number, 
  rating?: number,
  optionKey?: string
): Promise<DailySessionState> {
  const body: { rating?: number; optionKey?: string } = {};
  if (optionKey !== undefined) {
    body.optionKey = optionKey;
  } else if (rating !== undefined) {
    body.rating = rating;
  } else {
    throw new Error("Either rating or optionKey must be provided");
  }

  const response = await authorizedRequest<{
    success: boolean;
    session: DailySessionState;
  }>(`/api/daily-session/items/${sessionItemId}/vote`, {
    method: "POST",
    body,
  });

  if (!response.success) {
    throw new Error("Failed to record vote");
  }

  return response.session;
}

export async function completeDailySession(): Promise<DailySessionCompletion> {
  const response = await authorizedRequest<{
    success: boolean;
    summary: DailySessionCompletion;
  }>("/api/daily-session/complete", {
    method: "POST",
  });

  if (!response.success) {
    throw new Error("Failed to complete daily session");
  }

  return response.summary;
}

export async function getQuickExplainer(params: {
  headline: string;
  summary?: string;
  issueCategory: string;
  todayIso?: string;
}): Promise<DailySessionQuickExplainer> {
  const response = await authorizedRequest<{
    success: boolean;
    explainer: DailySessionQuickExplainer;
  }>("/api/daily-session/explainer", {
    method: "POST",
    body: params,
  });

  if (!response.success) {
    throw new Error("Failed to fetch quick explainer");
  }

  return response.explainer;
}
