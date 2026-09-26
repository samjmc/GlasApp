/**
 * Client for the voting API (server/voting/routes.ts). Every response is the
 * `{ success, data }` envelope; types come from @shared/voting, the one contract.
 */
import { supabase } from "@/lib/supabase";
import type {
  ArticleQuestion,
  DailySessionCompletion,
  DailySessionState,
  QuestionTally,
} from "@shared/voting";

export type {
  ArticleQuestion,
  DailySessionCompletion,
  DailySessionDimensionShift,
  DailySessionItem,
  DailySessionState,
  QuestionTally,
} from "@shared/voting";

type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code: string } };

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

  const response = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !payload || !payload.success) {
    const message = payload && !payload.success ? payload.error.message : response.statusText;
    throw new Error(message || `Request failed with status ${response.status}`);
  }
  return payload.data;
}

export const fetchDailySession = () => request<DailySessionState>("/api/daily-session");

export const submitDailyVote = (sessionItemId: number, optionKey: string) =>
  request<DailySessionState>(`/api/daily-session/items/${sessionItemId}/vote`, "POST", { optionKey });

export const completeDailySession = () =>
  request<DailySessionCompletion>("/api/daily-session/complete", "POST");

export interface ArticleVoteView {
  question: ArticleQuestion | null;
  tally: QuestionTally;
  myVote: string | null;
}

export const fetchArticleVote = (articleId: number) =>
  request<ArticleVoteView>(`/api/votes/articles/${articleId}`);

export const castArticleVote = (questionId: number, optionKey: string) =>
  request<{ tally: QuestionTally; myVote: string }>(`/api/votes/questions/${questionId}`, "POST", { optionKey });
