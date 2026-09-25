import React, { Component, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { QueryErrorResetBoundary, useQueryClient } from '@tanstack/react-query';

interface ErrorBoundaryCoreProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryCoreState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * ErrorBoundaryCore - Class component that catches React render errors and
 * displays a user-friendly fallback UI. Class components are the only React
 * component type that can act as an error boundary.
 *
 * React Query async failures that are thrown during render (via `throwOnError`
 * or suspense) land here too; the "Try Again" button resets both this
 * component and the nearest QueryErrorResetBoundary so the failed query
 * re-fetches instead of re-throwing immediately.
 */
class ErrorBoundaryCore extends Component<ErrorBoundaryCoreProps, ErrorBoundaryCoreState> {
  constructor(props: ErrorBoundaryCoreProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryCoreState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Surface a toast notification so async/query failures are visible even
    // though the fallback UI replaces the app content.
    toast({
      variant: 'destructive',
      title: 'Something went wrong',
      description: error?.message || 'An unexpected error occurred.',
    });

    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    // Example: logErrorToService(error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    // Reset this boundary's state. `onReset` (wired to react-query's
    // QueryErrorResetBoundary in App.tsx) clears the nearest query-error reset
    // flag so a query that threw to this boundary re-fetches on retry instead
    // of immediately re-throwing.
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-2xl p-8">
            <div className="text-center">
              <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-destructive" />

              <h1 className="mb-2 font-display text-2xl font-bold tracking-tight">
                Oops! Something went wrong
              </h1>

              <p className="mb-6 text-muted-foreground">
                We encountered an unexpected error. Don't worry, your data is safe.
              </p>

              {import.meta.env.DEV && this.state.error && (
                <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-left">
                  <p className="mb-2 font-mono text-sm text-destructive">
                    <strong>Error:</strong> {this.state.error.message}
                  </p>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="mb-2 cursor-pointer text-sm text-destructive">
                        Stack trace
                      </summary>
                      <pre className="max-h-48 overflow-auto text-xs text-destructive">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button
                  onClick={this.handleReset}
                  className="gap-2"
                  size="lg"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try again
                </Button>

                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="gap-2"
                  size="lg"
                >
                  <Home className="h-4 w-4" />
                  Go to homepage
                </Button>
              </div>

              <p className="mt-6 text-sm text-muted-foreground">
                If this problem persists, please contact support at{' '}
                <a href="mailto:support@glaspolitics.ie" className="font-semibold text-primary underline underline-offset-2">
                  support@glaspolitics.ie
                </a>
              </p>
            </div>
          </Card>
          {/* Render the toaster inside the fallback so the toast fired in
              componentDidCatch is visible while the app content is replaced. */}
          <Toaster />
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * QueryErrorNotifier - Surfaces React Query async failures as a toast with a
 * retry action.
 *
 * In @tanstack/react-query v5, queries do not throw to error boundaries by
 * default (`throwOnError` defaults to `false` unless suspense is enabled), so
 * we subscribe to the QueryCache and notify on the final `error` transition
 * of any query. This intentionally does not replace per-query inline error
 * UI; it is additive global visibility with a one-tap retry.
 */
function QueryErrorNotifier() {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const cache = queryClient.getQueryCache();
    const unsubscribe = cache.subscribe((event) => {
      if (event.type !== 'updated' || event.action?.type !== 'error') {
        return;
      }
      const error = event.action.error;
      toast({
        variant: 'destructive',
        title: 'Failed to load data',
        description:
          error instanceof Error
            ? error.message
            : 'The request could not be completed.',
        action: (
          <ToastAction
            altText="Retry"
            onClick={() =>
              queryClient.refetchQueries({
                queryKey: event.query.queryKey,
                exact: true,
              })
            }
          >
            Retry
          </ToastAction>
        ),
      });
    });
    return unsubscribe;
  }, [queryClient]);

  return null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * ErrorBoundary - Global error boundary.
 *
 * Wraps the app root to:
 *  1. Catch render errors (class boundary) and show a fallback UI.
 *  2. Surface React Query async failures with a toast + retry action
 *     (QueryErrorNotifier).
 *  3. Reset query errors on "Try Again" so failed queries re-fetch instead of
 *     re-throwing (QueryErrorResetBoundary).
 *  4. Reset itself when the route changes, so navigating to a different page
 *     after a crash shows that page instead of repeating the fallback UI.
 */
/** Error boundary that catches render and query errors with a fallback UI. */
export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  const [location] = useLocation();

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundaryCore key={location} onReset={reset} fallback={fallback}>
          <QueryErrorNotifier />
          {children}
        </ErrorBoundaryCore>
      )}
    </QueryErrorResetBoundary>
  );
}

export default ErrorBoundary;
