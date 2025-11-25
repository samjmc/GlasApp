import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';

const AuthCallbackPage = () => {
  const [, navigate] = useLocation();

  useEffect(() => {
    // Handle the OAuth callback
    const handleCallback = async () => {
      try {
        // Supabase automatically handles the callback and stores the session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          navigate('/login');
          return;
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























