import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, User } from 'lucide-react';

interface AuthStatusIndicatorProps {
  user: any;
  loading: boolean;
}

export function AuthStatusIndicator({ user, loading }: AuthStatusIndicatorProps) {
  if (loading) {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
        Authenticating
      </Badge>
    );
  }

  if (!user) {
    return (
      <Alert className="border-orange-200 bg-orange-50">
        <AlertCircle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          <strong>Authentication Required:</strong> Sign in to access personalized features and save your progress.
        </AlertDescription>
      </Alert>
    );
  }

  if (user.isGuest) {
    return (
      <Alert className="border-blue-200 bg-blue-50">
        <User className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Guest Mode:</strong> You can explore all features. Sign in with Google to save your progress permanently.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-green-200 bg-green-50">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <AlertDescription className="text-green-800">
        <strong>Authenticated:</strong> Welcome back, {user.displayName || user.email}! Your progress is saved.
      </AlertDescription>
    </Alert>
  );
}