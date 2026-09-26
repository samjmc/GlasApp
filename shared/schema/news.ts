/**
 * News ingestion tables, in the `politics` schema.
 *
 * One writer (`server/news/ingest.ts`) inserts articles; the TD pipeline claims and marks
 * them through `server/news/articleSource.ts`. Nothing else writes these tables.
 */
import { sql } from 'drizzle-orm';
import { type AnyPgColumn, boolean, check, index, integer, serial, smallint, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import type { NewsCategory } from '../news';
import { politics } from './politics';

/**
 * Article lifecycle. `claimed` rows belong to one scoring run until their lease expires.
 * `duplicate`: ingest found an earlier article about the same event (`duplicate_of`); hidden
 * from the feed and never scored, so one event shows once.
 */
export const ARTICLE_STATUSES = ['pending', 'claimed', 'scored', 'skipped', 'duplicate', 'failed'] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

// ---------------------------------------------------------------------------
// Sources. Mirrors the const in server/news/sources.ts, upserted on every ingest.
// ---------------------------------------------------------------------------
export const newsSources = politics.table('news_sources', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  homepageUrl: text('homepage_url').notNull(),
  /** NULL for the `manual` source, which has no feed. */
  feedUrl: text('feed_url'),
  logoUrl: text('logo_url'),
  enabled: boolean('enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Articles.
// ---------------------------------------------------------------------------
export const newsArticles = politics.table(
  'news_articles',
  {
    id: serial('id').primaryKey(),
    sourceId: integer('source_id')
      .notNull()
      .references(() => newsSources.id),
    /** Canonical: no query string, no fragment, no trailing slash. */
    url: text('url').notNull(),
    title: text('title').notNull(),
    /** Publisher's own standfirst from the feed, cut at a sentence end. */
    summary: text('summary'),
    /** Body text. Feed text at ingest; the scoring pipeline may replace it with the full page. */
    content: text('content').notNull().default(''),
    imageUrl: text('image_url'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 16 }).$type<ArticleStatus>().notNull().default('pending'),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    /** Claims so far. A row claimed MAX_ATTEMPTS times without finishing goes to `failed`. */
    attempts: smallint('attempts').notNull().default(0),
    /**
     * 0–100 from the ingest relevance pass. Below RELEVANCE_FLOOR the row is stored (so its URL
     * is never scored again) but never shown or scored. NULL = the pass failed; shown anyway.
     */
    relevanceScore: smallint('relevance_score'),
    category: varchar('category', { length: 32 }).$type<NewsCategory>(),
    /** Neutral two-sentence summary from the relevance pass. The publisher's own is `summary`. */
    aiSummary: text('ai_summary'),
    /** 0–100 from scoring triage. NULL until triaged. */
    importanceScore: smallint('importance_score'),
    importanceReasoning: text('importance_reasoning'),
    skipReason: text('skip_reason'),
    errorMessage: text('error_message'),
    /**
     * The root canonical article for the same event. Set exactly when status is `duplicate`.
     * RESTRICT: a canonical with duplicates cannot be deleted until they are re-pointed, since
     * SET NULL would break the check below.
     */
    duplicateOf: integer('duplicate_of').references((): AnyPgColumn => newsArticles.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('news_articles_url_idx').on(t.url),
    index('news_articles_status_published_idx').on(t.status, t.publishedAt),
    index('news_articles_published_idx').on(sql`${t.publishedAt} desc`),
    index('news_articles_duplicate_of_idx').on(t.duplicateOf).where(sql`${t.duplicateOf} is not null`),
    check('news_articles_duplicate_link_chk', sql`(${t.status} = 'duplicate') = (${t.duplicateOf} is not null)`),
  ],
);

export type NewsSourceRow = typeof newsSources.$inferSelect;
export type NewsArticleRow = typeof newsArticles.$inferSelect;
export type NewNewsArticle = typeof newsArticles.$inferInsert;
