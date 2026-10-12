import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeDailySession,
  DailySessionCompletion,
  DailySessionState,
  submitDailyVote,
  fetchDailySession,
} from "@/services/dailySessionService";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
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
    },
  });
}

