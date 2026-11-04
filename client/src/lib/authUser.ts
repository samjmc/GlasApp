import type { User } from '@/lib/supabase';

/** The signed-in person as the app reads them, built from the Supabase user. */
export interface AuthUser {
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
  /** Set when the onboarding card was closed or finished (user_metadata.has_seen_onboarding). */
  hasSeenOnboarding: boolean;
}

/** Convert a Supabase user to an AuthUser. */
export function toAuthUser(supabaseUser: User | null): AuthUser | null {
  if (!supabaseUser) return null;
  const meta = supabaseUser.user_metadata ?? {};

  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    firstName: meta.first_name || meta.given_name,
    lastName: meta.last_name || meta.family_name,
    // glas_avatar_url is our upload; Google rewrites avatar_url and picture at every sign-in.
    profileImageUrl: meta.glas_avatar_url || meta.avatar_url || meta.picture,
    displayName: meta.full_name || meta.name,
    username: meta.username,
    county: meta.county,
    bio: meta.bio,
    role: supabaseUser.app_metadata?.role,
    hasSeenOnboarding: meta.has_seen_onboarding === true,
  };
}

/**
 * Whether two AuthUsers say the same thing. Supabase sends a new user object on every auth event
 * (a token refresh each hour and on tab focus); keeping the old object when nothing changed stops
 * every consumer re-rendering and a profile form being reset mid-edit.
 */
export function sameAuthUser(a: AuthUser | null, b: AuthUser | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as (keyof AuthUser)[]);
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
}
