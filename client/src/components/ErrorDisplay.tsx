import { AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
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
      icon: <AlertCircle className="w-12 h-12 text-red-500" />,
      defaultTitle: 'Something went wrong',
      defaultMessage: 'An unexpected error occurred. Please try again.',
    },
    network: {
      icon: <WifiOff className="w-12 h-12 text-orange-500" />,
      defaultTitle: 'Connection problem',
      defaultMessage: 'Unable to connect to the server. Check your internet connection.',
    },
    notfound: {
      icon: <AlertCircle className="w-12 h-12 text-gray-500" />,
      defaultTitle: 'Not found',
      defaultMessage: 'The content you\'re looking for doesn\'t exist.',
    },
    unauthorized: {
      icon: <AlertCircle className="w-12 h-12 text-yellow-500" />,
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
      <div className="text-center py-4">
        <p className="text-sm text-red-600 dark:text-red-400">
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
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {displayTitle}
            </p>
            <p className="text-sm text-red-600 dark:text-red-300 mt-1">
              {displayMessage}
            </p>
            {import.meta.env.DEV && error && (
              <details className="mt-2">
                <summary className="text-xs text-red-500 cursor-pointer">
                  Technical details
                </summary>
                <pre className="text-xs text-red-500 mt-1 overflow-auto">
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
              className="flex-shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
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
        <div className="flex justify-center mb-4">
          {config.icon}
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {displayTitle}
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
          {displayMessage}
        </p>

        {import.meta.env.DEV && error && (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-4 text-left">
            <p className="text-xs font-mono text-gray-700 dark:text-gray-300">
              {typeof error === 'string' ? error : error.message}
            </p>
          </div>
        )}

        {onRetry && (
          <Button onClick={onRetry} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
        )}
      </div>
    </Card>
  );
}

/**
 * NetworkError - Specialized component for network errors
 */
export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorDisplay
      type="network"
      title="Connection Lost"
      message="We're having trouble connecting to our servers. Please check your internet connection and try again."
      onRetry={onRetry}
    />
  );
}

/**
 * NotFoundError - Specialized component for 404 errors
 */
export function NotFoundError({ resourceName }: { resourceName?: string }) {
  return (
    <ErrorDisplay
      type="notfound"
      title={`${resourceName || 'Page'} Not Found`}
      message={`The ${resourceName?.toLowerCase() || 'page'} you're looking for doesn't exist or has been removed.`}
    />
  );
}

/**
 * UnauthorizedError - Specialized component for auth errors
 */
export function UnauthorizedError() {
  return (
    <ErrorDisplay
      type="unauthorized"
      title="Sign In Required"
      message="You need to be signed in to access this content. Please sign in and try again."
    />
  );
}






















