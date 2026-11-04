/**
 * Client for the voting API (server/voting/routes.ts). Every response is the
 * `{ success, data }` envelope; types come from @shared/voting, the one contract.
 */
import { apiCall } from "@/lib/api";
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

export const fetchDailySession = () => apiCall<DailySessionState>("GET", "/api/daily-session");

export const submitDailyVote = (sessionItemId: number, optionKey: string) =>
  apiCall<DailySessionState>("POST", `/api/daily-session/items/${sessionItemId}/vote`, { optionKey });

export const completeDailySession = () =>
  apiCall<DailySessionCompletion>("POST", "/api/daily-session/complete");

export interface ArticleVoteView {
  question: ArticleQuestion | null;
  tally: QuestionTally;
  myVote: string | null;
}

export const fetchArticleVote = (articleId: number) =>
  apiCall<ArticleVoteView>("GET", `/api/votes/articles/${articleId}`);

export const castArticleVote = (questionId: number, optionKey: string) =>
  apiCall<{ tally: QuestionTally; myVote: string }>("POST", `/api/votes/questions/${questionId}`, { optionKey });
