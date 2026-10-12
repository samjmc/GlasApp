/**
 * The query cache never expires (staleTime is Infinity), so it must be emptied when the signed-in
 * person changes, and every key that holds one person's data must carry their id. Without both, a
 * second person on a shared device saw the first one's saved priorities and daily session. The
 * client has no component test setup, so the wiring is read as text and the decision is tested as a
 * pure function.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { queryKeys } from './queryKeys';
import { shouldClearCache, shouldClearQuizStorage } from './authCache';

const SRC = path.resolve(__dirname, '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(SRC, ...parts), 'utf8');

describe('shouldClearCache', () => {
  it('clears on sign-out, whoever was signed in', () => {
    expect(shouldClearCache('user-a', null, 'SIGNED_OUT')).toBe(true);
    expect(shouldClearCache(null, null, 'SIGNED_OUT')).toBe(true);
    expect(shouldClearCache(undefined, null, 'SIGNED_OUT')).toBe(true);
  });

  it('clears when a different person signs in', () => {
    expect(shouldClearCache('user-a', 'user-b', 'SIGNED_IN')).toBe(true);
  });

  it('clears when a visitor signs in, so what they saw signed out is not kept', () => {
    expect(shouldClearCache(null, 'user-a', 'SIGNED_IN')).toBe(true);
  });

  it('keeps the cache for the same person (token refresh, tab refocus, user update)', () => {
    expect(shouldClearCache('user-a', 'user-a', 'TOKEN_REFRESHED')).toBe(false);
    expect(shouldClearCache('user-a', 'user-a', 'SIGNED_IN')).toBe(false);
    expect(shouldClearCache('user-a', 'user-a', 'USER_UPDATED')).toBe(false);
  });

  it('keeps the cache for the first session read after load', () => {
    expect(shouldClearCache(undefined, 'user-a', 'INITIAL_SESSION')).toBe(false);
    expect(shouldClearCache(undefined, null, 'INITIAL_SESSION')).toBe(false);
  });
});

describe('per-user query keys', () => {
  it('differ between two users and between a user and a visitor', () => {
    const build: Array<(userId: string | undefined) => readonly unknown[]> = [
      queryKeys.pledges.priorities,
      queryKeys.pledges.parties,
      (userId) => queryKeys.dailySession('IE', userId),
    ];
    expect(build.length).toBe(3);
    for (const key of build) {
      expect(key('user-a')).not.toEqual(key('user-b'));
      expect(key('user-a')).not.toEqual(key(undefined));
    }
  });

  it('are the keys the components and hooks really use', () => {
    // Re-adding a literal key would bring the leak back, so the literals must be gone.
    expect(read('components', 'pledges', 'PledgePriorities.tsx')).not.toMatch(/queryKey:\s*\["\/api\/pledges\/priorities"\]/);
    expect(read('components', 'pledges', 'PartyPledgesPanel.tsx')).not.toMatch(/queryKey:\s*\["\/api\/pledges\/parties"\]/);
    expect(read('hooks', 'useDailySession.ts')).not.toMatch(/daily-session-state/);
    expect(read('components', 'pledges', 'PledgePriorities.tsx')).toMatch(/queryKeys\.pledges\.priorities\(user\?\.id\)/);
    expect(read('components', 'pledges', 'PartyPledgesPanel.tsx')).toMatch(/queryKeys\.pledges\.parties\(user\?\.id\)/);
    // The query, the vote and the completion each name the key, and all three must carry the user.
    expect(read('hooks', 'useDailySession.ts').match(/queryKeys\.dailySession\(regionCode, user\?\.id\)/g)).toHaveLength(3);
    expect(read('hooks', 'useDailySession.ts').match(/queryKeys\.dailySession\(/g)).toHaveLength(3);
  });
});

describe('AuthProvider', () => {
  const source = read('contexts', 'AuthContext.tsx');

  it('clears the query cache from the auth listener through shouldClearCache', () => {
    const listener = source.match(/onAuthStateChange\(([\s\S]*?)\n\s*\}\);/);
    expect(listener, 'the onAuthStateChange(...) call was not found').not.toBeNull();
    expect(listener![1]).toMatch(/shouldClearCache\(/);
    expect(listener![1]).toMatch(/queryClient\.clear\(\)/);
  });

  it('drops the quiz result this tab holds from the same listener, and when a sign-out call fails', () => {
    const listener = source.match(/onAuthStateChange\(([\s\S]*?)\n\s*\}\);/);
    expect(listener![1]).toMatch(/shouldClearQuizStorage\(/);
    expect(listener![1]).toMatch(/clearAllQuizStorage\(\)/);
    const logout = source.match(/const logout = async \(\) => \{([\s\S]*?)\n  \};/);
    expect(logout, 'logout was not found').not.toBeNull();
    expect(logout![1]).toMatch(/clearAllQuizStorage\(\)/);
  });
});

describe('ConsentProvider withdraw', () => {
  it('drops the quiz result this tab holds, which the server has just erased', () => {
    const withdraw = read('contexts', 'ConsentContext.tsx').match(/const withdraw = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[/);
    expect(withdraw, 'withdraw was not found').not.toBeNull();
    expect(withdraw![1]).toMatch(/clearAllQuizStorage\(\)/);
  });
});

describe('shouldClearQuizStorage', () => {
  it('clears when a signed-in person signs out, or a different person signs in', () => {
    expect(shouldClearQuizStorage('user-a', null, 'SIGNED_OUT')).toBe(true);
    expect(shouldClearQuizStorage('user-a', 'user-b', 'SIGNED_IN')).toBe(true);
    // A sign-out whose previous person this tab never saw (a reload, then an expired session) still clears.
    expect(shouldClearQuizStorage(undefined, null, 'SIGNED_OUT')).toBe(true);
    expect(shouldClearQuizStorage(null, null, 'SIGNED_OUT')).toBe(true);
  });

  it('keeps an anonymous result when a visitor signs in, so it can be saved to their account', () => {
    expect(shouldClearQuizStorage(null, 'user-a', 'SIGNED_IN')).toBe(false);
  });

  it('keeps it for the same person (token refresh, refocus, user update) and for the first read after load', () => {
    expect(shouldClearQuizStorage('user-a', 'user-a', 'TOKEN_REFRESHED')).toBe(false);
    expect(shouldClearQuizStorage('user-a', 'user-a', 'SIGNED_IN')).toBe(false);
    expect(shouldClearQuizStorage(undefined, 'user-a', 'INITIAL_SESSION')).toBe(false);
    expect(shouldClearQuizStorage(undefined, null, 'INITIAL_SESSION')).toBe(false);
  });
});
