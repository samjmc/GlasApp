import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase, type Session } from '@/lib/supabase';

const waitForAuthSession = (timeoutMs: number): Promise<Session | null> =>
  new Promise((resolve) => {
    let settled = false;
    let timeout: number;
    let subscription: { unsubscribe: () => void } | null = null;

    const finish = (session: Session | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      subscription?.unsubscribe();
      resolve(session);
    };

    timeout = window.setTimeout(() => finish(null), timeoutMs);

    const authListener = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        finish(session);
      }
    });
    subscription = authListener.data.subscription;
    if (settled) {
      subscription.unsubscribe();
    }
  });

const AuthCallbackPage = () => {
  const [, navigate] = useLocation();

  useEffect(() => {
    // Handle the OAuth callback
    const handleCallback = async () => {
      try {
        const callbackUrl = new URL(window.location.href);
        const authCode = callbackUrl.searchParams.get('code');
        let session: Session | null = null;
        
        if (authCode) {
          const {
            data: { session: exchangedSession },
            error: exchangeError,
          } = await supabase.auth.exchangeCodeForSession(authCode);

          if (exchangeError) {
            console.error('Auth callback exchange error:', exchangeError);
          }

          session = exchangedSession;
        }

        if (!session) {
          const {
            data: { session: existingSession },
            error,
          } = await supabase.auth.getSession();

          if (error) {
            console.error('Auth callback session error:', error);
          }

          session = existingSession;
        }

        if (!session && authCode) {
          session = await waitForAuthSession(3000);
        }

        if (session) {
          // Successful authentication - redirect to home
          navigate('/');
        } else {
          // No session found - redirect to login
          navigate('/login');
        }
      } catch (error) {
        console.error('Unexpected auth callback error:', error);
        navigate('/login');
      }
    };

    handleCallback();
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























