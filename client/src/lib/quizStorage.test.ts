import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAllQuizStorage, loadDeviceSeed, loadDraft, loadStoredQuiz, parseDraft, quizStorageEpoch, storeDeviceSeed, storeDraft, storeQuiz } from './quizStorage';

// quizStorage imports ideologyApi only for defaultWeights; keep the Supabase client out of a node test.
// vi.mock is hoisted above the imports.
vi.mock('@/lib/ideologyApi', () => ({ defaultWeights: () => ({}) }));

/** A Storage that keeps its items in a Map, for the node test environment (no window). */
function fakeStorage(): Storage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, String(value)),
    removeItem: (key) => void items.delete(key),
    clear: () => items.clear(),
    key: (index) => Array.from(items.keys())[index] ?? null,
    get length() {
      return items.size;
    },
  };
}

describe('clearAllQuizStorage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it("removes the result, its answers and seed and the in-progress draft, and leaves the device's seed", () => {
    vi.stubGlobal('window', { sessionStorage: fakeStorage(), localStorage: fakeStorage() });
    const result = { id: 7, vector: { economic: 1 }, ideology: 'x', description: 'y' } as never;
    storeQuiz(result, [{ questionId: 1, answerIndex: 0 }] as never, 42);
    storeDraft({ seed: 42, answers: { 1: 2 } });
    storeDeviceSeed(99);
    expect(loadStoredQuiz()).not.toBeNull();
    expect(loadDraft()).not.toBeNull();

    clearAllQuizStorage();

    expect(loadStoredQuiz()).toBeNull();
    expect(loadDraft()).toBeNull();
    expect(loadDeviceSeed()).toBe(99);
  });
});

describe('storeQuiz and the epoch', () => {
  afterEach(() => vi.unstubAllGlobals());
  const result = { id: 7, vector: { economic: 1 }, ideology: 'x', description: 'y' } as never;
  const answers = [{ questionId: 1, answerIndex: 0 }] as never;

  it('does not store a result whose save began before the quiz was cleared: it belongs to someone who has gone', () => {
    vi.stubGlobal('window', { sessionStorage: fakeStorage(), localStorage: fakeStorage() });
    const since = quizStorageEpoch();
    clearAllQuizStorage(); // a sign-out, a different person, or a withdrawal while the save was in flight
    storeQuiz(result, answers, 42, since);
    expect(loadStoredQuiz()).toBeNull();
  });

  it('stores it when nothing was cleared since, and always when no epoch is given', () => {
    vi.stubGlobal('window', { sessionStorage: fakeStorage(), localStorage: fakeStorage() });
    storeQuiz(result, answers, 42, quizStorageEpoch());
    expect(loadStoredQuiz()).not.toBeNull();
    clearAllQuizStorage();
    storeQuiz(result, answers, 42);
    expect(loadStoredQuiz()).not.toBeNull();
  });
});

describe('parseDraft', () => {
  it('keeps a draft with a seed and answers', () => {
    expect(parseDraft({ seed: 42, answers: { 1: 2, 20: 0 } })).toEqual({ seed: 42, answers: { 1: 2, 20: 0 } });
    expect(parseDraft({ seed: 0, answers: {} })).toEqual({ seed: 0, answers: {} });
    expect(parseDraft({ seed: 0xffffffff, answers: {} })).toEqual({ seed: 0xffffffff, answers: {} });
  });

  it('discards the old shape (answers only) and anything without a valid seed', () => {
    expect(parseDraft({ 1: 2, 20: 0 })).toBeNull();
    expect(parseDraft({ answers: { 1: 2 } })).toBeNull();
    for (const seed of [-1, 1.5, 2 ** 32, '42', null]) expect(parseDraft({ seed, answers: {} }), String(seed)).toBeNull();
    expect(parseDraft({ seed: 42 })).toBeNull();
    expect(parseDraft({ seed: 42, answers: [1, 2] })).toBeNull();
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('x')).toBeNull();
  });
});
