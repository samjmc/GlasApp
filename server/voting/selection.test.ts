import { describe, expect, it } from 'vitest';
import { selectDailyQuestions, type QuestionCandidate } from './selection';

const at = (day: number) => new Date(Date.UTC(2026, 8, day));
const candidate = (questionId: number, primaryDimension: QuestionCandidate['primaryDimension'], day: number) => ({
  questionId,
  primaryDimension,
  createdAt: at(day),
});

describe('selectDailyQuestions', () => {
  it('returns nothing when there is nothing to pick', () => {
    expect(selectDailyQuestions([], {}, 3)).toEqual([]);
  });

  it('returns fewer than asked when fewer exist', () => {
    expect(selectDailyQuestions([candidate(1, 'economic', 1)], {}, 3)).toEqual([1]);
  });

  it('spreads the session across different axes before repeating one', () => {
    const picked = selectDailyQuestions(
      [candidate(1, 'economic', 20), candidate(2, 'economic', 19), candidate(3, 'social', 10), candidate(4, 'welfare', 5)],
      {},
      3,
    );
    // Newest economic first, then the two other axes, even though economic #2 is newer.
    expect(picked).toEqual([1, 3, 4]);
  });

  it('prefers the axes this user has answered least', () => {
    const picked = selectDailyQuestions(
      [candidate(1, 'economic', 20), candidate(2, 'social', 20), candidate(3, 'cultural', 20)],
      { economic: 9, social: 1, cultural: 4 },
      2,
    );
    expect(picked).toEqual([2, 3]);
  });

  it('ranks questions without a named axis after those with one', () => {
    const picked = selectDailyQuestions([candidate(1, null, 30), candidate(2, 'economic', 1)], { economic: 50 }, 2);
    expect(picked).toEqual([2, 1]);
  });

  it('is deterministic: ties break on recency, then id', () => {
    const input = [candidate(5, 'economic', 3), candidate(9, 'social', 3), candidate(7, 'welfare', 3)];
    expect(selectDailyQuestions(input, {}, 3)).toEqual([9, 7, 5]);
    expect(selectDailyQuestions([...input].reverse(), {}, 3)).toEqual([9, 7, 5]);
  });

  it('never picks the same question twice', () => {
    const picked = selectDailyQuestions([candidate(1, 'economic', 1), candidate(2, 'economic', 2)], {}, 5);
    expect(new Set(picked).size).toBe(picked.length);
    expect(picked).toHaveLength(2);
  });
});
