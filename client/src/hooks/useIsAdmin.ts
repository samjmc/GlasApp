import { useAuth } from "@/contexts/AuthContext";
import { useProfileMe } from "@/hooks/useProfileMe";

/**
 * Whether the signed-in user is an admin, as the server decides it (app_metadata.role or
 * ADMIN_EMAILS). Only for showing or hiding admin UI: every admin route is guarded server-side.
 */
export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = useProfileMe();
  return { isAdmin: isAuthenticated && data?.data?.isAdmin === true, isLoading: isAuthenticated && isLoading };
}
