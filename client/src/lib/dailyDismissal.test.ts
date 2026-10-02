import { beforeEach, describe, expect, it } from 'vitest';
import { dismissDailyForToday, dublinDate, isDailyDismissedToday, resetDailyDismissalForTests } from './dailyDismissal';

const memoryStore = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};
const brokenStore = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

const monday = new Date('2026-09-28T10:00:00Z');
const tuesday = new Date('2026-09-29T10:00:00Z');

beforeEach(() => resetDailyDismissalForTests());

describe('dublinDate', () => {
  it('uses the Dublin calendar day, not UTC', () => {
    // 23:30 UTC in September is 00:30 the next day in Dublin (UTC+1).
    expect(dublinDate(new Date('2026-09-28T23:30:00Z'))).toBe('2026-09-29');
    expect(dublinDate(new Date('2026-09-28T22:30:00Z'))).toBe('2026-09-28');
  });
});

describe('daily dismissal', () => {
  it('is not dismissed until the user closes it', () => {
    expect(isDailyDismissedToday(monday, memoryStore())).toBe(false);
  });

  it('stays dismissed for the rest of the day, in a new page load too', () => {
    const store = memoryStore();
    dismissDailyForToday(monday, store);
    expect(isDailyDismissedToday(monday, store)).toBe(true);
    resetDailyDismissalForTests(); // a reload forgets memory but keeps storage
    expect(isDailyDismissedToday(new Date('2026-09-28T20:00:00Z'), store)).toBe(true);
  });

  it('opens again the next day', () => {
    const store = memoryStore();
    dismissDailyForToday(monday, store);
    expect(isDailyDismissedToday(tuesday, store)).toBe(false);
  });

  it('still holds for this page load when storage is blocked, and never throws', () => {
    expect(() => dismissDailyForToday(monday, brokenStore)).not.toThrow();
    expect(isDailyDismissedToday(monday, brokenStore)).toBe(true);
    resetDailyDismissalForTests();
    expect(isDailyDismissedToday(monday, brokenStore)).toBe(false);
    expect(isDailyDismissedToday(monday, null)).toBe(false);
  });
});
