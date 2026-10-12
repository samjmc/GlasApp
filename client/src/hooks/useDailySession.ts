import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  castArticleVote,
  completeDailySession,
  DailySessionCompletion,
  DailySessionState,
  fetchArticleVote,
  submitDailyVote,
  fetchDailySession,
  type ArticleVoteView,
} from "@/services/dailySessionService";
import { useAuth } from "@/contexts/AuthContext";
import { keysStaleAfterVote, queryKeys } from "@/lib/queryKeys";
import { useRegion } from "./useRegion";

/** React hook fetching the current daily session state for the active region. */
export function useDailySession(enabled: boolean) {
  const { regionCode } = useRegion();
  const { user } = useAuth();
  return useQuery<DailySessionState>({
    queryKey: queryKeys.dailySession(regionCode, user?.id),
    queryFn: fetchDailySession,
    enabled: enabled && !!regionCode,
    staleTime: 1000 * 30,
  });
}

/** React hook submitting a daily session vote and updating the cached session state. */
export function useDailySessionVote() {
  const queryClient = useQueryClient();
  const { regionCode } = useRegion();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ sessionItemId, optionKey }: { sessionItemId: number; optionKey: string }) =>
      submitDailyVote(sessionItemId, optionKey),
    onSuccess: (session) => {
      queryClient.setQueryData<DailySessionState>(
        queryKeys.dailySession(regionCode, user?.id),
        session
      );
      for (const queryKey of keysStaleAfterVote("daily")) void queryClient.invalidateQueries({ queryKey });
    },
  });
}

/** React hook completing the daily session and updating the cached state with the summary. */
export function useCompleteDailySession() {
  const queryClient = useQueryClient();
  const { regionCode } = useRegion();
  const { user } = useAuth();

  return useMutation({
    mutationFn: completeDailySession,
    onSuccess: (summary: DailySessionCompletion) => {
      const key = queryKeys.dailySession(regionCode, user?.id);
      const existing = queryClient.getQueryData<DailySessionState>(key);
      if (existing) {
        queryClient.setQueryData<DailySessionState>(key, {
          ...existing,
          status: "completed",
          completion: summary,
          voteCount: existing.items.length,
          streakCount: summary.streakCount,
        });
      } else {
        queryClient.invalidateQueries({ queryKey: key });
      }
      for (const queryKey of keysStaleAfterVote("daily")) void queryClient.invalidateQueries({ queryKey });
    },
  });
}

/** The tally and the caller's answer for one article's question, cached per article and user. */
export function useArticleVote(articleId: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.votes.article(articleId, user?.id),
    queryFn: () => fetchArticleVote(articleId),
  });
}

/** Saves an answer to an article's question and updates its cached tally. */
export function useCastArticleVote(articleId: number, questionId: number) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (optionKey: string) => castArticleVote(questionId, optionKey),
    onSuccess: ({ tally, myVote }) => {
      queryClient.setQueryData<ArticleVoteView>(queryKeys.votes.article(articleId, user?.id), (view) =>
        view ? { ...view, tally, myVote } : view
      );
      for (const queryKey of keysStaleAfterVote("article")) void queryClient.invalidateQueries({ queryKey });
    },
  });
}

