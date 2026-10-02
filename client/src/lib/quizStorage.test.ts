import { describe, expect, it, vi } from 'vitest';
import { parseDraft } from './quizStorage';

// quizStorage imports ideologyApi only for defaultWeights; keep the Supabase client out of a node test.
// vi.mock is hoisted above the imports.
vi.mock('@/lib/ideologyApi', () => ({ defaultWeights: () => ({}) }));

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
