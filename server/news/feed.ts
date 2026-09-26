/**
 * Feed query parameters and the "today" window. Pure.
 */

export const FEED_SORTS = ['top', 'recent', 'today'] as const;
export type FeedSort = (typeof FEED_SORTS)[number];

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;
/** `today` falls back to this window when nothing was published today. */
export const TODAY_FALLBACK_DAYS = 30;
export const FEED_TIMEZONE = 'Europe/Dublin';

export interface FeedQuery {
  sort: FeedSort;
  limit: number;
  offset: number;
}

function intParam(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : fallback;
  return Math.min(Math.max(n, min), max);
}

/** Unknown sorts fall back to `top`, the feed's default tab, so its old names `score` and `highest` still work. */
export function parseFeedQuery(query: Record<string, unknown>): FeedQuery {
  const raw = typeof query.sort === 'string' ? query.sort : '';
  const sort: FeedSort = (FEED_SORTS as readonly string[]).includes(raw) ? (raw as FeedSort) : 'top';
  return {
    sort,
    limit: intParam(query.limit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE),
    offset: intParam(query.offset, 0, 0, 10_000),
  };
}

/** Offset (ms) of `timeZone` from UTC at `at`. */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant local midnight began, in `timeZone`, on the local day containing `now`. */
export function startOfLocalDay(now: Date, timeZone = FEED_TIMEZONE): Date {
  const local = new Date(now.getTime() + zoneOffsetMs(now, timeZone));
  const midnightAsUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  // Offset at midnight can differ from offset now on a DST-change day.
  const guess = new Date(midnightAsUtc - zoneOffsetMs(now, timeZone));
  return new Date(midnightAsUtc - zoneOffsetMs(guess, timeZone));
}

export function hasMore(query: FeedQuery, total: number): boolean {
  return query.offset + query.limit < total;
}
