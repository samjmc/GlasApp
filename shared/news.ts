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
