import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiCall, isApiError } from "@/lib/api";
import type { PoliticalConsentFields } from "@shared/consent";

/** The fields a user edits on the profile page. Their one home is politics.users. */
export interface ProfileEdits {
  firstName: string;
  lastName: string;
  county: string;
  bio: string;
}

/** The profile fields as stored: null when never set. */
export type ProfileFields = { [K in keyof ProfileEdits]: string | null } & { profileImageUrl: string | null };

export interface ProfileMe {
  isAdmin?: boolean;
  user?: Partial<PoliticalConsentFields & ProfileFields>;
}

export const profileMeKey = (userId: string | undefined) => ["/api/profile/me", userId] as const;

/** The caller's profile, or null when the session is not (or no longer) valid. */
export const fetchProfileMe = (): Promise<ProfileMe | null> =>
  apiCall<ProfileMe>("GET", "/api/profile/me").catch((error: unknown) => {
    if (isApiError(error, 401)) return null;
    throw error;
  });

/** GET /api/profile/me for the signed-in user: the admin flag, the profile fields and the political-consent fields. */
export function useProfileMe() {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: profileMeKey(user?.id),
    queryFn: fetchProfileMe,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}

/** Save the caller's name, county and bio (PATCH /api/profile/me); every reader of the profile sees the saved row at once. */
export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  return useCallback(
    async (edits: ProfileEdits) => {
      const { user: saved } = await apiCall<{ user: ProfileMe["user"] }>("PATCH", "/api/profile/me", edits);
      queryClient.setQueryData<ProfileMe | null>(profileMeKey(userId), (prev) => ({ ...prev, user: saved }));
    },
    [queryClient, userId],
  );
}
