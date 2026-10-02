import { describe, expect, it } from 'vitest';
import { MANUAL_SOURCE_SLUG, NEWS_SOURCES, sourceForUrl } from './sources';

describe('NEWS_SOURCES', () => {
  it('has unique slugs, one manual source, and a feed for every other', () => {
    expect(new Set(NEWS_SOURCES.map((s) => s.slug)).size).toBe(NEWS_SOURCES.length);
    expect(NEWS_SOURCES.filter((s) => s.feedUrl === null).map((s) => s.slug)).toEqual([MANUAL_SOURCE_SLUG]);
  });
});

describe('sourceForUrl', () => {
  it('matches a configured publisher with or without www', () => {
    // Two RTÉ feeds share the host; the first listed labels a pasted URL.
    expect(sourceForUrl('https://www.rte.ie/news/x').name).toBe('RTÉ News');
    expect(sourceForUrl('https://ontheditch.com/x').slug).toBe('the-ditch');
  });
  it('falls back to manual for any other site or a bad URL', () => {
    expect(sourceForUrl('https://www.businesspost.ie/x').slug).toBe(MANUAL_SOURCE_SLUG);
    expect(sourceForUrl('nonsense').slug).toBe(MANUAL_SOURCE_SLUG);
  });
});
