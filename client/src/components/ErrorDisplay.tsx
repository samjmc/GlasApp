import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ErrorDisplayProps {
  title?: string;
  message?: string;
  error?: Error | string;
  onRetry?: () => void;
  variant?: 'default' | 'inline' | 'minimal';
  type?: 'error' | 'network' | 'notfound' | 'unauthorized';
}

/**
 * ErrorDisplay - Reusable component for showing user-friendly errors
 *
 * Usage:
 * <ErrorDisplay
 *   title="Failed to load news"
 *   message="We couldn't fetch the latest articles"
 *   onRetry={() => refetch()}
 *   type="network"
 * />
 */
/** Displays API/network errors with optional retry. */
export function ErrorDisplay({
  title,
  message,
  error,
  onRetry,
  variant = 'default',
  type = 'error',
}: ErrorDisplayProps) {
  const errorMessages = {
    error: {
      icon: <AlertCircle className="h-12 w-12 text-destructive" />,
      defaultTitle: 'Something went wrong',
      defaultMessage: 'An unexpected error occurred. Please try again.',
    },
    network: {
      icon: <WifiOff className="h-12 w-12 text-warn" />,
      defaultTitle: 'Connection problem',
      defaultMessage: 'Unable to connect to the server. Check your internet connection.',
    },
    notfound: {
      icon: <AlertCircle className="h-12 w-12 text-muted-foreground" />,
      defaultTitle: 'Not found',
      defaultMessage: 'The content you\'re looking for doesn\'t exist.',
    },
    unauthorized: {
      icon: <AlertCircle className="h-12 w-12 text-warn" />,
      defaultTitle: 'Access denied',
      defaultMessage: 'You need to sign in to access this content.',
    },
  };

  const config = errorMessages[type];
  const displayTitle = title || config.defaultTitle;
  const displayMessage = message || config.defaultMessage;

  // Minimal variant - just text
  if (variant === 'minimal') {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-destructive">
          {displayMessage}
        </p>
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="link"
            size="sm"
            className="mt-2"
          >
            Try again
          </Button>
        )}
      </div>
    );
  }

  // Inline variant - compact error
  if (variant === 'inline') {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">
              {displayTitle}
            </p>
            <p className="mt-1 text-sm text-destructive">
              {displayMessage}
            </p>
            {import.meta.env.DEV && error && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-destructive">
                  Technical details
                </summary>
                <pre className="mt-1 overflow-auto text-xs text-destructive">
                  {typeof error === 'string' ? error : error.message}
                </pre>
              </details>
            )}
          </div>
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="ghost"
              size="sm"
              className="shrink-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Default variant - full card
  return (
    <Card className="p-8">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          {config.icon}
        </div>

        <h3 className="mb-2 text-lg font-semibold">
          {displayTitle}
        </h3>

        <p className="mx-auto mb-6 max-w-md text-muted-foreground">
          {displayMessage}
        </p>

        {import.meta.env.DEV && error && (
          <div className="mb-4 rounded-lg bg-elevated p-3 text-left">
            <p className="font-mono text-xs text-muted-foreground">
              {typeof error === 'string' ? error : error.message}
            </p>
          </div>
        )}

        {onRetry && (
          <Button onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        )}
      </div>
    </Card>
  );
}

/**
 * NetworkError - Specialized component for network errors
 */
/** Specialized error display for network/connection errors. */
export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorDisplay
      type="network"
      title="Connection lost"
      message="We're having trouble connecting to our servers. Please check your internet connection and try again."
      onRetry={onRetry}
    />
  );
}

/**
 * NotFoundError - Specialized component for 404 errors
 */
/** Specialized error display for missing resources (404). */
export function NotFoundError({ resourceName }: { resourceName?: string }) {
  return (
    <ErrorDisplay
      type="notfound"
      title={`${resourceName || 'Page'} not found`}
      message={`The ${resourceName?.toLowerCase() || 'page'} you're looking for doesn't exist or has been removed.`}
    />
  );
}

/**
 * UnauthorizedError - Specialized component for auth errors
 */
/** Specialized error display for authentication failures. */
export function UnauthorizedError() {
  return (
    <ErrorDisplay
      type="unauthorized"
      title="Sign in required"
      message="You need to be signed in to access this content. Please sign in and try again."
    />
  );
}
