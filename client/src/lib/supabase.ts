/**
 * Supabase client for the browser. Auth only; application data comes from the API.
 *
 * VITE_SUPABASE_URL defaults to the GlasCore project. VITE_SUPABASE_ANON_KEY has no default:
 * the old fallback pointed at a Supabase project that no longer exists, so sign-in failed
 * silently. Without the key, sign-in is off and the console says so; public pages still work.
 */

import { createClient } from '@supabase/supabase-js';

export const GLASCORE_SUPABASE_URL = 'https://ihecemdupqnxltdyebsh.supabase.co';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || GLASCORE_SUPABASE_URL;
const supabaseAnonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** False when no anon key is configured; sign-in calls will fail. */
export const isAuthConfigured = Boolean(supabaseAnonKey);

if (!isAuthConfigured) {
  console.error('VITE_SUPABASE_ANON_KEY is not set: sign-in is disabled. Set it to the GlasCore anon key.');
}

// Create Supabase client
/** Supabase client configured with env vars, PKCE auth, and app metadata. */
// createClient rejects an empty key; a placeholder keeps public pages working, and every
// auth call then fails with Supabase's own 401 rather than a crash at import.
export const supabase = createClient(supabaseUrl, supabaseAnonKey ?? 'missing-anon-key', {
  auth: {
    // Auto-refresh the session before it expires
    autoRefreshToken: true,
    // Persist the session in localStorage
    persistSession: true,
    // Detect OAuth redirects in URL
    detectSessionInUrl: true,
    // Storage key for the session
    storageKey: 'glas-politics-auth',
    // Flow type for OAuth
    flowType: 'pkce',
  },
  // Global headers for all requests
  global: {
    headers: {
      'X-Client-Info': 'glas-politics-web',
    },
  },
});

// Helper function to get current user
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Error getting current user:', error);
    return null;
  }
  
  return user;
}

// Helper function to get current session
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error getting current session:', error);
    return null;
  }
  
  return session;
}

// Helper function to sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

// Sign in with Google OAuth
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  
  if (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
  
  return data;
}

// Sign in with Microsoft OAuth
export async function signInWithMicrosoft() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'email openid profile',
    },
  });
  
  if (error) {
    console.error('Error signing in with Microsoft:', error);
    throw error;
  }
  
  return data;
}

// Sign in with email/password
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    console.error('Error signing in with email:', error);
    throw error;
  }
  
  return data;
}

// Sign up with email/password
export async function signUpWithEmail(email: string, password: string, metadata?: unknown) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  
  if (error) {
    console.error('Error signing up:', error);
    throw error;
  }
  
  return data;
}

// Send password reset email
export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  
  if (error) {
    console.error('Error sending password reset:', error);
    throw error;
  }

  return data;
}

// Set a new password for the signed-in user (the reset link signs them in first)
export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

// Export types
export type { User, Session } from '@supabase/supabase-js';



