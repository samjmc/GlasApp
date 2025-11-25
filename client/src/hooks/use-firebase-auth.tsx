import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, auth, signInWithGoogle, signOutUser, onAuthStateChange, handleRedirectResult } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  signInAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check for saved guest user first
    const savedGuestUser = localStorage.getItem('guestUser');
    if (savedGuestUser) {
      try {
        const guestUser = JSON.parse(savedGuestUser);
        setUser(guestUser);
        setLoading(false);
        return;
      } catch (error) {
        localStorage.removeItem('guestUser');
      }
    }

    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);
      
      // Show welcome message when user signs in successfully
      if (user) {
        toast({
          title: "Welcome!",
          description: "Successfully signed in with Google"
        });
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    if (loading) return; // Prevent multiple clicks
    
    setLoading(true);
    
    // Set a timeout to reset loading state if redirect doesn't happen
    const timeoutId = setTimeout(() => {
      setLoading(false);
      toast({
        title: "Authentication Timeout",
        description: "Sign in took too long. Please try again.",
        variant: "destructive"
      });
    }, 10000); // 10 second timeout
    
    try {
      console.log('Starting sign in process...');
      console.log("HOSTNAME:", window.location.hostname);
      await signInWithGoogle();
      console.log('Sign in redirect initiated');
      // Clear timeout if redirect succeeds
      clearTimeout(timeoutId);
    } catch (error: any) {
      console.error('Sign in error:', error);
      console.log("HOSTNAME:", window.location.hostname);
      clearTimeout(timeoutId);
      setLoading(false);
      
      let errorMessage = error.message || "Failed to sign in with Google";
      
      if (error.code === 'auth/unauthorized-domain') {
        errorMessage = `Domain '${window.location.hostname}' not authorized. Add it to Firebase Console → Authentication → Settings → Authorized domains.`;
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = "Popup was blocked. Please allow popups for this site and try again.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = "Sign in was cancelled. Please try again.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your connection and try again.";
      }
      
      toast({
        title: "Authentication Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const signOut = async () => {
    try {
      if (user && (user as any).isGuest) {
        // Handle guest sign out
        setUser(null);
        localStorage.removeItem('guestUser');
        toast({
          title: "Signed Out",
          description: "Successfully signed out"
        });
        return;
      }
      
      await signOutUser();
      toast({
        title: "Signed Out",
        description: "Successfully signed out"
      });
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: "Sign Out Failed",
        description: error.message || "Failed to sign out",
        variant: "destructive"
      });
    }
  };

  const signInAsGuest = () => {
    const guestUser = {
      uid: 'guest-user',
      email: 'guest@demo.com',
      displayName: 'Guest User',
      photoURL: null,
      isGuest: true
    } as User & { isGuest: boolean };
    
    setUser(guestUser);
    localStorage.setItem('guestUser', JSON.stringify(guestUser));
    toast({
      title: "Signed In as Guest",
      description: "You can now explore the platform"
    });
  };

  const value = {
    user,
    loading,
    signIn,
    signOut,
    signInAsGuest
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}