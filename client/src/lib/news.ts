/**
 * Shared types for the /api/news-feed API (FeedArticle contract).
 * Single source of truth — import this instead of redeclaring the shape.
 */

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
  url: string;
  source: string;
  sourceLogoUrl: string | null;
  publishedAt: string;
  imageUrl: string | null;
  storyType: string | null;
  sentiment: string | null;
  impactScore: number | null;
  affectedTDs: FeedArticleTD[];
  policyVote: FeedArticlePolicyVote | null;
}
