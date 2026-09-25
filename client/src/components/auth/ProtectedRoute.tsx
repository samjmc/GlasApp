import type { ReactNode } from "react";
import { Link } from "wouter";
import { LogIn, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/pulse/EmptyState";

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  requireAdmin?: boolean;
}

/** Shows its children only to a signed-in user (and, with requireAdmin, only to an admin). */
export function ProtectedRoute({ children, fallback, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();

  if (isLoading || (requireAdmin && adminLoading)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-input border-t-primary" />
      </div>
    );
  }

  if (!user) {
    if (fallback) return <>{fallback}</>;
    return (
      <EmptyState
        icon={LogIn}
        title="Sign in to see this page"
        action={
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        }
        className="mx-auto mt-10 max-w-md"
      />
    );
  }

  if (requireAdmin && !isAdmin) {
    return (
      <EmptyState icon={ShieldAlert} title="Admins only" className="mx-auto mt-10 max-w-md">
        Your account does not have admin access.
      </EmptyState>
    );
  }

  return <>{children}</>;
}
