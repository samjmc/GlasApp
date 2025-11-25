import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { supabase, type User } from '@/lib/supabase';

interface AuthUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  displayName?: string;
  username?: string;
  county?: string;
  bio?: string;
  role?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  updateProfile?: (data: Partial<AuthUser>) => Promise<void>;
  logout?: () => Promise<void>;
  deleteAccount?: () => Promise<void>;
  signInWithGoogle?: () => Promise<void>;
  signInWithMicrosoft?: () => Promise<void>;
  login?: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register?: (data: {
    username: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    county?: string;
  }) => Promise<{ success: boolean; message?: string }>;
}

const defaultContext: AuthContextType = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  updateProfile: async () => {},
  logout: async () => {},
  deleteAccount: async () => {},
  signInWithGoogle: async () => {},
  signInWithMicrosoft: async () => {},
  login: async () => ({ success: false, message: "Not implemented" }),
  register: async () => ({ success: false, message: "Not implemented" }),
};

const AuthContext = createContext<AuthContextType>(defaultContext);

// Convert Supabase User to AuthUser
function convertSupabaseUser(supabaseUser: User | null): AuthUser | null {
  if (!supabaseUser) return null;

  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    firstName: supabaseUser.user_metadata?.first_name || supabaseUser.user_metadata?.given_name,
    lastName: supabaseUser.user_metadata?.last_name || supabaseUser.user_metadata?.family_name,
    profileImageUrl: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture,
    displayName: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name,
    username: supabaseUser.user_metadata?.username,
    county: supabaseUser.user_metadata?.county,
    bio: supabaseUser.user_metadata?.bio,
    role: supabaseUser.user_metadata?.role || supabaseUser.app_metadata?.role,
  };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(convertSupabaseUser(session?.user ?? null));
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(convertSupabaseUser(session?.user ?? null));
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const updateProfile = async (data: Partial<AuthUser>) => {
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
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error signing out:', error);
      }
      // Even if signout fails, clear local user state
      setUser(null);
      throw new Error('Failed to sign out. Please try again.');
    }
  };

  const deleteAccount = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error('You need to be signed in to delete your account.');
      }

      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          result?.message ||
          (Array.isArray(result?.errors) && result.errors.length > 0
            ? result.errors.map((err: any) => err?.error || '').filter(Boolean).join('; ')
            : null) ||
          'Failed to delete account. Please try again.';
        throw new Error(message);
      }

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
  };

  const signInWithGoogle = async () => {
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
  };

  const signInWithMicrosoft = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'email openid profile',
        },
      });

      if (error) {
        if (error.message.includes('popup')) {
          throw new Error('Pop-up blocked. Please allow pop-ups for this site and try again.');
        }
        throw new Error(error.message || 'Failed to sign in with Microsoft. Please try again.');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error signing in with Microsoft:', error);
      }
      throw error;
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username.includes('@') ? username : `${username}@example.com`, // Handle username or email
        password,
      });

      if (error) {
        return { success: false, message: error.message || 'Login failed' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Login failed' };
    }
  };

  const register = async (data: {
    username: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    county?: string;
  }) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            username: data.username,
            first_name: data.firstName,
            last_name: data.lastName,
            county: data.county,
          },
        },
      });

      if (error) {
        return { success: false, message: error.message || 'Registration failed' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Registration failed' };
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    updateProfile,
    logout,
    deleteAccount,
    signInWithGoogle,
    signInWithMicrosoft,
    login,
    register,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    return defaultContext;
  }
  return context;
};