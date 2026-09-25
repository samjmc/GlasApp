import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";

interface ProfileMeResponse {
  success: boolean;
  data: { isAdmin?: boolean };
}

/**
 * Whether the signed-in user is an admin, as the server decides it (app_metadata.role or
 * ADMIN_EMAILS). Only for showing or hiding admin UI: every admin route is guarded server-side.
 */
export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { user, isAuthenticated } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["/api/profile/me", user?.id],
    queryFn: () =>
      apiRequest<ProfileMeResponse | null>({ method: "GET", path: "/api/profile/me", on401: "returnNull" }),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
  return { isAdmin: isAuthenticated && data?.data?.isAdmin === true, isLoading: isAuthenticated && isLoading };
}
