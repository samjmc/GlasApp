import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';

const AuthCallbackPage = () => {
  const [, navigate] = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const errorDescription = params.get('error_description') || params.get('error');

        if (errorDescription) {
          console.error('Auth callback error:', errorDescription);
          navigate('/login');
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          navigate('/login');
          return;
        }

        if (session) {
          // Successful authentication - redirect to home
          navigate('/');
        } else if (params.has('code')) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.get('code')!);

          if (exchangeError || !data.session) {
            console.error('Auth callback exchange error:', exchangeError);
            navigate('/login');
            return;
          }

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























