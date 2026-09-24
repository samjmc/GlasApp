import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, hasMore, parseFeedQuery, startOfLocalDay } from './feed';

describe('parseFeedQuery', () => {
  it('defaults to the score tab, first page', () => {
    expect(parseFeedQuery({})).toEqual({ sort: 'score', limit: DEFAULT_PAGE_SIZE, offset: 0 });
  });
  it('reads offset (the old route ignored it, so every page was page 1)', () => {
    expect(parseFeedQuery({ sort: 'recent', limit: '10', offset: '20' })).toEqual({ sort: 'recent', limit: 10, offset: 20 });
  });
  it('maps the legacy "highest" sort and rejects unknown ones', () => {
    expect(parseFeedQuery({ sort: 'highest' }).sort).toBe('score');
    expect(parseFeedQuery({ sort: 'drop table' }).sort).toBe('score');
    expect(parseFeedQuery({ sort: 'today' }).sort).toBe('today');
  });
  it('clamps and ignores non-integers', () => {
    expect(parseFeedQuery({ limit: '9999', offset: '-5' })).toEqual({ sort: 'score', limit: MAX_PAGE_SIZE, offset: 0 });
    expect(parseFeedQuery({ limit: '0' }).limit).toBe(1);
    expect(parseFeedQuery({ limit: ['5'], offset: '1e3' })).toEqual({ sort: 'score', limit: DEFAULT_PAGE_SIZE, offset: 0 });
  });
});

describe('startOfLocalDay (Europe/Dublin)', () => {
  it('summer: midnight IST is 23:00 UTC the day before', () => {
    expect(startOfLocalDay(new Date('2026-09-22T12:00:00Z'))).toEqual(new Date('2026-09-21T23:00:00Z'));
  });
  it('just after local midnight belongs to the NEW day, though UTC is still the old one', () => {
    expect(startOfLocalDay(new Date('2026-09-22T23:30:00Z'))).toEqual(new Date('2026-09-22T23:00:00Z'));
  });
  it('winter: midnight GMT is midnight UTC', () => {
    expect(startOfLocalDay(new Date('2026-12-10T08:00:00Z'))).toEqual(new Date('2026-12-10T00:00:00Z'));
  });
  it('the day clocks go back (25 Oct 2026) starts at 23:00 UTC the day before', () => {
    expect(startOfLocalDay(new Date('2026-10-25T15:00:00Z'))).toEqual(new Date('2026-10-24T23:00:00Z'));
  });
  it('the day clocks go forward (29 Mar 2026) starts at 00:00 UTC', () => {
    expect(startOfLocalDay(new Date('2026-03-29T15:00:00Z'))).toEqual(new Date('2026-03-29T00:00:00Z'));
  });
});

describe('hasMore', () => {
  it('is true only while rows remain past this page', () => {
    expect(hasMore({ sort: 'score', limit: 10, offset: 0 }, 25)).toBe(true);
    expect(hasMore({ sort: 'score', limit: 10, offset: 20 }, 25)).toBe(false);
    expect(hasMore({ sort: 'score', limit: 10, offset: 10 }, 20)).toBe(false);
  });
});
