import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, LogIn } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, fallback, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  
  // Admin check - only samjmc3@hotmail.com has admin access
  const isAdmin = user?.email === 'samjmc3@hotmail.com';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-t-transparent border-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              You need to sign in to access this page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={() => window.location.href = '/api/login'} className="w-full" size="lg">
              <LogIn className="w-4 h-4 mr-2" />
              Sign In with Replit
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-red-100 rounded-full w-fit">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle>Admin Access Required</CardTitle>
            <CardDescription>
              You don't have admin privileges to access this page
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}