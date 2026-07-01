import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase, type Session } from '@/lib/supabase';

const SESSION_WAIT_TIMEOUT_MS = 5000;

const AuthCallbackPage = () => {
  const [, navigate] = useLocation();

  useEffect(() => {
    let isMounted = true;

    const navigateIfMounted = (path: string) => {
      if (isMounted) {
        navigate(path);
      }
    };

    const waitForSession = async (): Promise<Session | null> => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      if (session) {
        return session;
      }

      return new Promise((resolve) => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (!nextSession) return;

          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          subscription.unsubscribe();
          resolve(nextSession);
        });

        timeoutId = setTimeout(() => {
          subscription.unsubscribe();
          resolve(null);
        }, SESSION_WAIT_TIMEOUT_MS);
      });
    };

    // Handle the OAuth/magic-link callback.
    const handleCallback = async () => {
      try {
        const callbackUrl = new URL(window.location.href);
        const callbackError =
          callbackUrl.searchParams.get('error_description') ||
          callbackUrl.searchParams.get('error');

        if (callbackError) {
          console.error('Auth callback error:', callbackError);
          navigateIfMounted('/login');
          return;
        }

        const code = callbackUrl.searchParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            // Supabase's detectSessionInUrl may already be processing the same code.
            // If that path wins the race, a session will still appear shortly.
            console.error('Auth callback exchange error:', error);
          } else if (data.session) {
            navigateIfMounted('/');
            return;
          }
        }

        const session = await waitForSession();

        if (session) {
          // Successful authentication - redirect to home
          navigateIfMounted('/');
        } else {
          // No session found - redirect to login
          navigateIfMounted('/login');
        }
      } catch (error) {
        console.error('Unexpected auth callback error:', error);
        navigateIfMounted('/login');
      }
    };

    handleCallback();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-lg text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallbackPage;























