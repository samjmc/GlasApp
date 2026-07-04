import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';

const waitForAuthSession = (timeoutMs = 5000): Promise<boolean> => {
  return new Promise((resolve) => {
    let settled = false;
    let subscription: { unsubscribe: () => void } | null = null;
    const finish = (hasSession: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      subscription?.unsubscribe();
      resolve(hasSession);
    };

    const timeout = window.setTimeout(() => finish(false), timeoutMs);
    const authListener = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        finish(true);
      }
    });
    subscription = authListener.data.subscription;

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session) {
          finish(true);
        }
      })
      .catch((error) => {
        console.error('Auth session check failed:', error);
      });
  });
};

const AuthCallbackPage = () => {
  const [, navigate] = useLocation();

  useEffect(() => {
    let isActive = true;

    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const callbackError = params.get('error_description') || params.get('error');
        const code = params.get('code');

        if (callbackError) {
          throw new Error(callbackError);
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }

          if (isActive) {
            navigate('/');
          }
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }

        const hasSession = !!session || await waitForAuthSession();
        if (!isActive) {
          return;
        }

        if (hasSession) {
          navigate('/');
        } else {
          navigate('/login');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        if (isActive) {
          navigate('/login');
        }
      }
    };

    handleCallback();

    return () => {
      isActive = false;
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























