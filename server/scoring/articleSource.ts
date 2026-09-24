/**
 * The pipeline's view of the news domain: `politics.news_articles`, through the news
 * repository. This adapter is the only place the scoring module touches news.
 */
import * as news from '../news/repository';

export interface Article {
  id: number;
  title: string;
  content: string;
  summary: string | null;
  source: string | null;
  url: string | null;
  imageUrl: string | null;
  publishedDate: Date | null;
  /** Source credibility 0–1. */
  credibility: number;
}

export interface ArticleOutcome {
  importanceScore: number;
  importanceReasoning: string;
  /** True when at least one TD was scored from it. */
  scoreApplied: boolean;
  skippedReason?: string;
  errorMessage?: string;
  /** Kept for the pipeline's call shape; the per-TD verdicts live in article_td_scores. */
  primaryTd?: { name: string; party: string | null; constituency: string | null };
}

export interface ArticleSource {
  /** Claims the rows it returns: a concurrent call never receives the same article. */
  fetchUnprocessed(limit: number): Promise<Article[]>;
  fetchById(id: number): Promise<Article | null>;
  /** Persist a fuller body fetched from the publisher. */
  saveContent(id: number, content: string): Promise<void>;
  markProcessed(id: number, outcome: ArticleOutcome): Promise<void>;
}

function toArticle(row: news.ClaimedArticle): Article {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    summary: row.summary,
    source: row.sourceName,
    url: row.url,
    imageUrl: row.imageUrl,
    publishedDate: row.publishedAt,
    credibility: row.credibility,
  };
}

/** An error wins over a skip; a finished run with neither is `scored`, even if no TD matched. */
export function toOutcome(outcome: ArticleOutcome): news.Outcome {
  const status = outcome.errorMessage ? 'failed' : outcome.skippedReason ? 'skipped' : 'scored';
  return {
    status,
    importanceScore: outcome.importanceScore,
    importanceReasoning: outcome.importanceReasoning,
    skipReason: outcome.skippedReason ?? null,
    errorMessage: outcome.errorMessage ?? null,
  };
}

export const articleSource: ArticleSource = {
  async fetchUnprocessed(limit) {
    return (await news.claimForScoring(limit)).map(toArticle);
  },
  async fetchById(id) {
    const row = await news.findForScoring(id);
    return row ? toArticle(row) : null;
  },
  saveContent: (id, content) => news.saveContent(id, content),
  markProcessed: (id, outcome) => news.markOutcome(id, toOutcome(outcome)),
};
