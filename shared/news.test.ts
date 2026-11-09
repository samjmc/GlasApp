import { describe, expect, it } from 'vitest';
import { FEED_COUNT_CAP, feedCountCap, feedTotalLabel } from './news';

describe('feed total', () => {
  it('caps at FEED_COUNT_CAP, or one row past the page when that is further', () => {
    expect(feedCountCap(0, 10)).toBe(FEED_COUNT_CAP);
    expect(feedCountCap(990, 10)).toBe(1001);
    expect(feedCountCap(2000, 10)).toBe(2011);
  });

  it('shows "+" only when the count stopped at the cap', () => {
    expect(feedTotalLabel(FEED_COUNT_CAP, 0, 10)).toBe(`${FEED_COUNT_CAP}+`);
    expect(feedTotalLabel(FEED_COUNT_CAP - 1, 0, 10)).toBe(String(FEED_COUNT_CAP - 1));
    expect(feedTotalLabel(37, 20, 10)).toBe('37');
    // Deep in the feed the cap moves past the page: 1001 is capped there, 1000 is exact.
    expect(feedTotalLabel(1001, 990, 10)).toBe('1001+');
    expect(feedTotalLabel(1000, 990, 10)).toBe('1000');
  });
});
