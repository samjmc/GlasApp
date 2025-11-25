import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeDailySession,
  DailySessionCompletion,
  DailySessionState,
  submitDailyVote,
  fetchDailySession,
} from "@/services/dailySessionService";
import { useRegion } from "./useRegion";

const DAILY_SESSION_QUERY_KEY = ["daily-session-state"];

export function useDailySession(enabled: boolean) {
  const { regionCode } = useRegion();
  return useQuery<DailySessionState>({
    queryKey: [...DAILY_SESSION_QUERY_KEY, regionCode],
    queryFn: fetchDailySession,
    enabled: enabled && !!regionCode,
    staleTime: 1000 * 30,
  });
}

export function useDailySessionVote() {
  const queryClient = useQueryClient();
  const { regionCode } = useRegion();

  return useMutation({
    mutationFn: ({
      sessionItemId,
      rating,
      optionKey,
    }: {
      sessionItemId: number;
      rating?: number;
      optionKey?: string;
    }) => submitDailyVote(sessionItemId, rating, optionKey),
    onSuccess: (session) => {
      queryClient.setQueryData<DailySessionState>(
        [...DAILY_SESSION_QUERY_KEY, regionCode],
        session
      );
    },
  });
}

export function useCompleteDailySession() {
  const queryClient = useQueryClient();
  const { regionCode } = useRegion();

  return useMutation({
    mutationFn: completeDailySession,
    onSuccess: (summary: DailySessionCompletion) => {
      const existing = queryClient.getQueryData<DailySessionState>(
        [...DAILY_SESSION_QUERY_KEY, regionCode]
      );
      if (existing) {
        queryClient.setQueryData<DailySessionState>(
          [...DAILY_SESSION_QUERY_KEY, regionCode],
          {
            ...existing,
            status: "completed",
            completion: summary,
            voteCount: existing.items.length,
            streakCount: summary.streakCount,
          }
        );
      } else {
        queryClient.invalidateQueries({
          queryKey: [...DAILY_SESSION_QUERY_KEY, regionCode],
        });
      }
    },
  });
}

