import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiCall, isApiError } from "@/lib/api";
import type { PoliticalConsentFields } from "@shared/consent";

export interface ProfileMe {
  isAdmin?: boolean;
  user?: Partial<PoliticalConsentFields>;
}

export const profileMeKey = (userId: string | undefined) => ["/api/profile/me", userId] as const;

/** The caller's profile, or null when the session is not (or no longer) valid. */
export const fetchProfileMe = (): Promise<ProfileMe | null> =>
  apiCall<ProfileMe>("GET", "/api/profile/me").catch((error: unknown) => {
    if (isApiError(error, 401)) return null;
    throw error;
  });

/** GET /api/profile/me for the signed-in user: the admin flag and the political-consent fields. */
export function useProfileMe() {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: profileMeKey(user?.id),
    queryFn: fetchProfileMe,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}
