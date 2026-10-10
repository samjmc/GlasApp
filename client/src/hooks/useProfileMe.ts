import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import type { PoliticalConsentFields } from "@shared/consent";

export interface ProfileMeResponse {
  success: boolean;
  data: { isAdmin?: boolean; user?: Partial<PoliticalConsentFields> };
}

export const profileMeKey = (userId: string | undefined) => ["/api/profile/me", userId] as const;

export const fetchProfileMe = () =>
  apiRequest<ProfileMeResponse | null>({ method: "GET", path: "/api/profile/me", on401: "returnNull" });

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
