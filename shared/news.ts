/**
 * News constants shared by server and client. The LLM relevance pass may only return these
 * categories; anything else is stored as `other`.
 */
export const NEWS_CATEGORIES = [
  'government',
  'oireachtas',
  'elections',
  'economy',
  'housing',
  'health',
  'justice',
  'immigration',
  'environment',
  'education',
  'foreign_affairs',
  'northern_ireland',
  'eu',
  'local',
  'other',
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export function isNewsCategory(value: unknown): value is NewsCategory {
  return typeof value === 'string' && (NEWS_CATEGORIES as readonly string[]).includes(value);
}

/**
 * A feed total counts at most this many rows, or one row past the requested page when that is
 * further. An exact count walks every visible article on every request. Below the cap the total
 * is exact; at the cap "has more" (offset + limit < total) is still exact, because the cap is
 * always past the end of the page.
 */
export const FEED_COUNT_CAP = 1000;

/** The most a feed total can be for this page (server/news/repository.ts counts up to it). */
export function feedCountCap(offset: number, limit: number): number {
  return Math.max(FEED_COUNT_CAP, offset + limit + 1);
}

/** A feed total for display: "1000+" when the count stopped at the cap, so there may be more. */
export function feedTotalLabel(total: number, offset: number, limit: number): string {
  return total >= feedCountCap(offset, limit) ? `${total}+` : String(total);
}
