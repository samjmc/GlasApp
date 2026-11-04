/**
 * Supabase sends a new user object on every auth event, including the hourly token refresh and a
 * refresh on tab focus. Passing each one to setUser reset the profile form mid-edit and re-rendered
 * every useAuth() consumer; the onboarding card and welcome banner asked Supabase over the network
 * each time. The decision is tested as pure functions and the wiring is read as text: the client has
 * no component test setup.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { User } from '@/lib/supabase';
import { sameAuthUser, toAuthUser } from './authUser';

const supabaseUser = (meta: Record<string, unknown> = {}) =>
  ({ id: 'u1', email: 'a@b.ie', user_metadata: { first_name: 'Áine', ...meta }, app_metadata: {} }) as unknown as User;

describe('toAuthUser', () => {
  it('reads the onboarding flag from the session', () => {
    expect(toAuthUser(supabaseUser({ has_seen_onboarding: true }))?.hasSeenOnboarding).toBe(true);
    expect(toAuthUser(supabaseUser())?.hasSeenOnboarding).toBe(false);
  });

  it('prefers our uploaded avatar over the one Google rewrites', () => {
    expect(toAuthUser(supabaseUser({ glas_avatar_url: 'ours', avatar_url: 'google' }))?.profileImageUrl).toBe('ours');
  });

  it('maps no user to null', () => {
    expect(toAuthUser(null)).toBeNull();
  });
});

describe('sameAuthUser', () => {
  it('a token refresh (a new object with the same content) is the same user', () => {
    expect(sameAuthUser(toAuthUser(supabaseUser()), toAuthUser(supabaseUser()))).toBe(true);
  });

  it('a real change is not', () => {
    expect(sameAuthUser(toAuthUser(supabaseUser()), toAuthUser(supabaseUser({ first_name: 'Bríd' })))).toBe(false);
    expect(sameAuthUser(toAuthUser(supabaseUser()), toAuthUser(supabaseUser({ has_seen_onboarding: true })))).toBe(false);
    expect(sameAuthUser(toAuthUser(supabaseUser()), null)).toBe(false);
    expect(sameAuthUser(null, null)).toBe(true);
  });
});

describe('wiring', () => {
  const SRC = path.resolve(__dirname, '..');
  const read = (...parts: string[]) => fs.readFileSync(path.join(SRC, ...parts), 'utf8');

  it('the provider keeps the old user when nothing changed, and memoises its value', () => {
    const auth = read('contexts', 'AuthContext.tsx');
    expect(auth).toMatch(/sameAuthUser\(prev, next\) \? prev : next/);
    expect(auth).toMatch(/const value = useMemo/);
  });

  it('onboarding and the welcome banner read the flag from the session, not the network', () => {
    for (const file of ['OnboardingModal.tsx', 'WelcomeBanner.tsx']) {
      const text = read('components', 'onboarding', file);
      expect(text).toMatch(/hasSeenOnboarding/);
      expect(text).not.toMatch(/auth\.getUser\(/);
    }
  });

  it('the profile form is not reset while the user is editing', () => {
    expect(read('pages', 'ProfilePage.tsx')).toMatch(/if \(user && !isEditing\)/);
  });
});
