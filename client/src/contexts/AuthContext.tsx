import React, { createContext, useCallback, useContext, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { shouldClearCache } from '@/lib/authCache';
import { apiCall } from '@/lib/api';
import { sameAuthUser, toAuthUser, type AuthUser } from '@/lib/authUser';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  updateProfile: (data: Partial<AuthUser>) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<{ success: boolean; message?: string }>;
}

const defaultContext: AuthContextType = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  updateProfile: async () => {},
  logout: async () => {},
  deleteAccount: async () => {},
  signInWithGoogle: async () => {},
  signInWithMagicLink: async () => ({ success: false, message: "Not implemented" }),
};

const AuthContext = createContext<AuthContextType>(defaultContext);

/** React context provider for auth state. */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  // The user id the cache was last filled for; undefined until the session has been read.
  const cacheUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // A token refresh sends the same person again: keep the old object, so nothing re-renders.
    const applyUser = (next: AuthUser | null) => setUser((prev) => (sameAuthUser(prev, next) ? prev : next));

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (cacheUserIdRef.current === undefined) cacheUserIdRef.current = session?.user?.id ?? null;
        applyUser(toAuthUser(session?.user ?? null));
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error loading session:', error);
        // Still set loading to false to prevent infinite loading state
        setIsLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null;
      // Cleared before setUser, so queries that start for the new user are fresh.
      if (shouldClearCache(cacheUserIdRef.current, nextUserId, event)) queryClient.clear();
      cacheUserIdRef.current = nextUserId;
      applyUser(toAuthUser(session?.user ?? null));
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const updateProfile = useCallback(async (data: Partial<AuthUser>) => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          username: data.username,
          county: data.county,
          bio: data.bio,
        },
      });

      if (error) {
        // Provide user-friendly error messages
        if (error.message.includes('network')) {
          throw new Error('Network error. Please check your connection and try again.');
        }
        throw new Error(error.message || 'Failed to update profile. Please try again.');
      }

      // Update local state
      setUser((prev) => (prev ? { ...prev, ...data } : null));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error updating profile:', error);
      }
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error signing out:', error);
      }
      // Even if signout fails, clear local user state (and the data cached for that user)
      queryClient.clear();
      setUser(null);
      throw new Error('Failed to sign out. Please try again.');
    }
  }, [queryClient]);

  const deleteAccount = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error('You need to be signed in to delete your account.');
      }

      await apiCall('DELETE', '/api/account');

      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error deleting account:', error);
      }
      throw error instanceof Error
        ? error
        : new Error('Failed to delete account. Please try again.');
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        if (error.message.includes('popup')) {
          throw new Error('Pop-up blocked. Please allow pop-ups for this site and try again.');
        }
        throw new Error(error.message || 'Failed to sign in with Google. Please try again.');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error signing in with Google:', error);
      }
      throw error;
    }
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { success: false, message: error.message || 'Failed to send magic link.' };
      }

      return { success: true, message: 'Check your email for a login link!' };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error sending magic link:', error);
      }
      return { success: false, message: error instanceof Error ? error.message : 'Failed to send magic link.' };
    }
  }, []);

  // A new object only when something changed, so useAuth() consumers do not re-render on every render here.
  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      updateProfile,
      logout,
      deleteAccount,
      signInWithGoogle,
      signInWithMagicLink,
    }),
    [user, isLoading, updateProfile, logout, deleteAccount, signInWithGoogle, signInWithMagicLink]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/** React hook exposing the auth context value. */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    return defaultContext;
  }
  return context;
};
