/**
 * The TD pipeline's view of `politics.news_articles`, through the news repository.
 */
import * as news from './repository';

export interface Article {
  id: number;
  title: string;
  content: string;
  summary: string | null;
  source: string | null;
  url: string | null;
  imageUrl: string | null;
  publishedDate: Date | null;
  /** 0–100 from the ingest relevance pass; NULL when it was not ranked. */
  relevanceScore: number | null;
}

export interface ArticleOutcome {
  /** Stored as `importance_score`, which orders the feed's "top" sort. */
  importanceScore: number;
  importanceReasoning?: string;
  skippedReason?: string;
  errorMessage?: string;
}

export interface ArticleSource {
  /** Claims the rows it returns: a concurrent call never receives the same article. */
  fetchUnprocessed(limit: number): Promise<Article[]>;
  fetchById(id: number): Promise<Article | null>;
  /** Persist a fuller body fetched from the publisher. */
  saveContent(id: number, content: string): Promise<void>;
  markProcessed(id: number, outcome: ArticleOutcome): Promise<void>;
  /** Hand a claimed article back untouched, its claim not counted (the run stopped before it). */
  release(id: number): Promise<void>;
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
    relevanceScore: row.relevanceScore,
  };
}

/**
 * An error wins over everything; any skip is `skipped`; a finished run with neither is `scored`,
 * even if no TD matched. Same-event duplicates are linked at ingest and never reach the pipeline.
 */
export function toOutcome(outcome: ArticleOutcome): news.Outcome {
  const status = outcome.errorMessage ? 'failed' : outcome.skippedReason ? 'skipped' : 'scored';
  return {
    status,
    importanceScore: outcome.importanceScore,
    importanceReasoning: outcome.importanceReasoning ?? null,
    skipReason: outcome.skippedReason ?? null,
    errorMessage: outcome.errorMessage ?? null,
  };
}

export const articleSource: ArticleSource = {
  async fetchUnprocessed(limit) {
    return (await news.claimForPipeline(limit)).map(toArticle);
  },
  async fetchById(id) {
    const row = await news.findForPipeline(id);
    return row ? toArticle(row) : null;
  },
  saveContent: (id, content) => news.saveContent(id, content),
  markProcessed: (id, outcome) => news.markOutcome(id, toOutcome(outcome)),
  release: (id) => news.releaseClaim(id),
};
