/**
 * News ingestion tables, in the `politics` schema.
 *
 * One writer (`server/news/ingest.ts`) inserts articles; the scoring pipeline claims and
 * marks them through `server/scoring/articleSource.ts`. Nothing else writes these tables.
 */
import { sql } from 'drizzle-orm';
import { boolean, index, integer, real, serial, smallint, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { politics } from './politics';

/** Article lifecycle. `claimed` rows belong to one scoring run until their lease expires. */
export const ARTICLE_STATUSES = ['pending', 'claimed', 'scored', 'skipped', 'failed'] as const;
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
  /** 0–1. */
  credibility: real('credibility').notNull(),
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
    /** 0–100 from scoring triage. NULL until triaged. */
    importanceScore: smallint('importance_score'),
    importanceReasoning: text('importance_reasoning'),
    skipReason: text('skip_reason'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('news_articles_url_idx').on(t.url),
    index('news_articles_status_published_idx').on(t.status, t.publishedAt),
    index('news_articles_published_idx').on(sql`${t.publishedAt} desc`),
  ],
);

export type NewsSourceRow = typeof newsSources.$inferSelect;
export type NewsArticleRow = typeof newsArticles.$inferSelect;
export type NewNewsArticle = typeof newsArticles.$inferInsert;
