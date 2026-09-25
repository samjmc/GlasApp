/**
 * Shared types for the /api/news-feed API (FeedArticle contract).
 * Single source of truth — import this instead of redeclaring the shape.
 */

import type { NewsCategory } from '@shared/news';

export { NEWS_CATEGORIES, type NewsCategory } from '@shared/news';

export interface FeedArticleTD {
  name: string;
  impactScore: number;
}

export interface FeedArticlePolicyVote {
  id: number;
  question: string;
  options: Record<string, string>;
  domain: string;
  topic: string;
}

export interface FeedArticle {
  id: number;
  title: string;
  summary: string | null;
  aiSummary: string | null;
  url: string;
  source: string;
  sourceLogoUrl: string | null;
  publishedAt: string;
  imageUrl: string | null;
  storyType: string | null;
  sentiment: string | null;
  impactScore: number | null;
  affectedTDs: FeedArticleTD[];
  /** Other outlets that reported the same event later; this card is the first report. */
  alsoReportedBy: Array<{ source: string; url: string }>;
  policyVote: FeedArticlePolicyVote | null;
  category: NewsCategory | null;
}

/** Humanises a snake_case category/story-type value, e.g. 'foreign_affairs' -> 'Foreign affairs', 'eu' -> 'EU'. */
export function humanizeCategory(value: string): string {
  if (value.toLowerCase() === 'eu') return 'EU';
  const words = value.split('_');
  return words
    .map((word, idx) => (idx === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}
