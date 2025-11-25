/**
 * Supabase Client Configuration
 * 
 * This file creates and exports the Supabase client for frontend use.
 * Make sure to set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file
 */

import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ospxqnxlotakujloltqy.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcHhxbnhsb3Rha3VqbG9sdHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwNjk1ODAsImV4cCI6MjA2NzY0NTU4MH0.-Udyszn2tSHbJW57R9OHdAtwmgULGP--9QQLWtOFetA';

// Validate that required environment variables are set
if (!supabaseUrl) {
  console.warn('⚠️  VITE_SUPABASE_URL is not set. Using default value.');
}

if (!supabaseAnonKey) {
  console.warn('⚠️  VITE_SUPABASE_ANON_KEY is not set. Using default value.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
export async function signUpWithEmail(email: string, password: string, metadata?: any) {
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

// Export types
export type { User, Session } from '@supabase/supabase-js';



