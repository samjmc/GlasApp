import { useEffect } from 'react';
import { useLocation } from 'wouter';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const SESSION_WAIT_MS = 2500;

async function waitForCallbackSession(): Promise<Session | null> {
  const {
    data: { session: existingSession },
  } = await supabase.auth.getSession();

  if (existingSession) {
    return existingSession;
  }

  return new Promise<Session | null>((resolve) => {
    let settled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    const finish = (session: Session | null) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      subscription?.unsubscribe();
      resolve(session);
    };

    const timeoutId = window.setTimeout(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      finish(session);
    }, SESSION_WAIT_MS);

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        finish(session);
      }
    });

    subscription = authSubscription;
  });
}

const AuthCallbackPage = () => {
  const [, navigate] = useLocation();

  useEffect(() => {
    let isMounted = true;

    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const callbackError = params.get('error_description') || params.get('error');

        if (callbackError) {
          throw new Error(callbackError);
        }

        let session: Session | null = null;
        const code = params.get('code');

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            session = await waitForCallbackSession();
            if (!session) {
              throw error;
            }
          } else {
            session = data.session;
          }
        }

        session = session ?? await waitForCallbackSession();

        if (!isMounted) {
          return;
        }

        navigate(session ? '/' : '/login');
      } catch (error) {
        console.error('Unexpected auth callback error:', error);
        if (isMounted) {
          navigate('/login');
        }
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























