import { describe, expect, it } from 'vitest';
import { afterVote, dimensionLabel, firstUnansweredIndex } from './dailySessionFlow';

const items = (...voted: boolean[]) => voted.map((hasVoted) => ({ hasVoted }));

describe('firstUnansweredIndex', () => {
  it('is 0 for a fresh session and the next question after the answered ones', () => {
    expect(firstUnansweredIndex(items(false, false, false))).toBe(0);
    expect(firstUnansweredIndex(items(true, false, false))).toBe(1);
    expect(firstUnansweredIndex(items(true, true, false))).toBe(2);
  });

  it('finds an unanswered question that comes BEFORE an answered one', () => {
    // The third was answered on its article page; the first two are still waiting.
    expect(firstUnansweredIndex(items(false, false, true))).toBe(0);
    expect(firstUnansweredIndex(items(true, false, true))).toBe(1);
  });

  it('starts at `from` and wraps round to the start', () => {
    expect(firstUnansweredIndex(items(false, true, false), 1)).toBe(2);
    expect(firstUnansweredIndex(items(false, true, true), 1)).toBe(0);
  });

  it('is -1 when everything is answered, or there is nothing to answer', () => {
    expect(firstUnansweredIndex(items(true, true, true))).toBe(-1);
    expect(firstUnansweredIndex([])).toBe(-1);
  });
});

describe('afterVote', () => {
  it('moves to the next question', () => {
    expect(afterVote(items(true, false, false), 0)).toEqual({ isFinal: false, nextIndex: 1 });
  });

  it('finishes after the last answer', () => {
    expect(afterVote(items(true, true, true), 2)).toEqual({ isFinal: true, nextIndex: -1 });
  });

  it('does not finish while an earlier question is still unanswered', () => {
    // Question 3 was answered elsewhere; answering question 2 must send the user back to 1.
    expect(afterVote(items(false, true, true), 1)).toEqual({ isFinal: false, nextIndex: 0 });
  });

  it('skips a question that was answered elsewhere', () => {
    expect(afterVote(items(true, true, false), 0)).toEqual({ isFinal: false, nextIndex: 2 });
  });
});

describe('dimensionLabel', () => {
  it('names each ideology axis in plain words', () => {
    expect(dimensionLabel('economic')).toBe('Economy');
    expect(dimensionLabel('technocratic')).toBe('Experts and the public');
    expect(dimensionLabel('globalism')).toBe('Ireland and the world');
  });

  it('keeps the older policy-area names, and prettifies an unknown one', () => {
    expect(dimensionLabel('housing')).toBe('Housing');
    expect(dimensionLabel('public_transport')).toBe('Public Transport');
  });

  it('falls back to a neutral word when there is none', () => {
    expect(dimensionLabel(null)).toBe('Policy');
    expect(dimensionLabel(undefined)).toBe('Policy');
  });
});
