/**
 * Database Schema for Automated News Scoring System
 * Tracks news articles, TD scores, and score history
 */

import { pgTable, serial, text, varchar, timestamp, decimal, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// News articles table
export const newsArticles = pgTable("news_articles", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  publishedDate: timestamp("published_date").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow(),
  
  // TD linkage
  politicianName: varchar("politician_name", { length: 255 }),
  constituency: varchar("constituency", { length: 100 }),
  party: varchar("party", { length: 100 }),
  
  // AI Analysis results
  storyType: varchar("story_type", { length: 50 }), // scandal, achievement, policy_work, etc.
  sentiment: varchar("sentiment", { length: 20 }), // very_positive, positive, neutral, negative, very_negative
  impactScore: decimal("impact_score", { precision: 4, scale: 2 }), // -10.00 to +10.00
  
  // Dimensional impacts
  transparencyImpact: decimal("transparency_impact", { precision: 4, scale: 2 }),
  effectivenessImpact: decimal("effectiveness_impact", { precision: 4, scale: 2 }),
  integrityImpact: decimal("integrity_impact", { precision: 4, scale: 2 }),
  consistencyImpact: decimal("consistency_impact", { precision: 4, scale: 2 }),
  constituencyServiceImpact: decimal("constituency_service_impact", { precision: 4, scale: 2 }),
  
  // AI analysis details
  aiSummary: text("ai_summary"),
  aiReasoning: text("ai_reasoning"),
  keyQuotes: text("key_quotes"), // JSON array
  
  // Processing status
  processed: boolean("processed").default(false),
  scoreApplied: boolean("score_applied").default(false),
  needsReview: boolean("needs_review").default(false), // Flag for human review
  credibilityScore: decimal("credibility_score", { precision: 3, scale: 2 }).default("0.8"),
  
  // AI model info
  analyzedBy: varchar("analyzed_by", { length: 50 }), // 'claude', 'gpt4', 'both'
  crossChecked: boolean("cross_checked").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_news_politician").on(table.politicianName),
  index("idx_news_date").on(table.publishedDate),
  index("idx_news_processed").on(table.processed),
]);

// TD Scores table (ELO-style ratings)
export const tdScores = pgTable("td_scores", {
  id: serial("id").primaryKey(),
  politicianName: varchar("politician_name", { length: 255 }).notNull().unique(),
  constituency: varchar("constituency", { length: 100 }).notNull(),
  party: varchar("party", { length: 100 }),
  
  // Overall ELO score
  overallElo: integer("overall_elo").default(1500).notNull(),
  
  // Dimensional ELO scores
  transparencyElo: integer("transparency_elo").default(1500).notNull(),
  effectivenessElo: integer("effectiveness_elo").default(1500).notNull(),
  integrityElo: integer("integrity_elo").default(1500).notNull(),
  consistencyElo: integer("consistency_elo").default(1500).notNull(),
  constituencyServiceElo: integer("constituency_service_elo").default(1500).notNull(),
  
  // Statistics
  totalStories: integer("total_stories").default(0).notNull(),
  positiveStories: integer("positive_stories").default(0).notNull(),
  negativeStories: integer("negative_stories").default(0).notNull(),
  neutralStories: integer("neutral_stories").default(0).notNull(),
  
  // Rankings
  nationalRank: integer("national_rank"),
  constituencyRank: integer("constituency_rank"),
  partyRank: integer("party_rank"),
  
  // Week-over-week change
  weeklyEloChange: integer("weekly_elo_change").default(0),
  monthlyEloChange: integer("monthly_elo_change").default(0),
  
  // Metadata
  imageUrl: text("image_url"),
  bio: text("bio"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_td_constituency").on(table.constituency),
  index("idx_td_overall_elo").on(table.overallElo),
]);

// Score history for tracking changes over time
export const tdScoreHistory = pgTable("td_score_history", {
  id: serial("id").primaryKey(),
  politicianName: varchar("politician_name", { length: 255 }).notNull(),
  articleId: integer("article_id"), // References news_articles.id
  
  // Score changes
  oldOverallElo: integer("old_overall_elo").notNull(),
  newOverallElo: integer("new_overall_elo").notNull(),
  eloChange: integer("elo_change").notNull(),
  
  // What caused the change
  dimensionAffected: varchar("dimension_affected", { length: 50 }),
  impactScore: decimal("impact_score", { precision: 4, scale: 2 }),
  storyType: varchar("story_type", { length: 50 }),
  
  // Metadata
  articleUrl: text("article_url"),
  articleTitle: text("article_title"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_history_politician").on(table.politicianName),
  index("idx_history_date").on(table.createdAt),
]);

// News sources configuration
export const newsSources = pgTable("news_sources", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  url: text("url").notNull(),
  rssFeed: text("rss_feed"),
  scrapingEnabled: boolean("scraping_enabled").default(true),
  credibilityScore: decimal("credibility_score", { precision: 3, scale: 2 }).default("0.8"),
  politicalBias: varchar("political_bias", { length: 20 }), // 'left', 'center', 'right', 'neutral'
  constituency: varchar("constituency", { length: 100 }), // null for national news
  lastScraped: timestamp("last_scraped"),
  articlesProcessed: integer("articles_processed").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Scraping jobs log
export const scrapingJobs = pgTable("scraping_jobs", {
  id: serial("id").primaryKey(),
  jobType: varchar("job_type", { length: 50 }).notNull(), // 'daily_scrape', 'manual_scrape', etc.
  status: varchar("status", { length: 20 }).notNull(), // 'running', 'completed', 'failed'
  
  // Results
  articlesFound: integer("articles_found").default(0),
  articlesProcessed: integer("articles_processed").default(0),
  tdsMentioned: integer("tds_mentioned").default(0),
  scoresUpdated: integer("scores_updated").default(0),
  
  // Error tracking
  errors: text("errors"), // JSON array of errors
  
  // Performance
  durationMs: integer("duration_ms"),
  
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Zod schemas for validation
export const insertNewsArticleSchema = createInsertSchema(newsArticles).omit({ id: true, createdAt: true, fetchedAt: true });
export const insertTDScoreSchema = createInsertSchema(tdScores).omit({ id: true, createdAt: true, lastUpdated: true });
export const insertTDScoreHistorySchema = createInsertSchema(tdScoreHistory).omit({ id: true, createdAt: true });
export const insertNewsSourceSchema = createInsertSchema(newsSources).omit({ id: true, createdAt: true });
export const insertScrapingJobSchema = createInsertSchema(scrapingJobs).omit({ id: true, startedAt: true });

// TypeScript types
export type NewsArticle = typeof newsArticles.$inferSelect;
export type InsertNewsArticle = z.infer<typeof insertNewsArticleSchema>;

export type TDScore = typeof tdScores.$inferSelect;
export type InsertTDScore = z.infer<typeof insertTDScoreSchema>;

export type TDScoreHistory = typeof tdScoreHistory.$inferSelect;
export type InsertTDScoreHistory = z.infer<typeof insertTDScoreHistorySchema>;

export type NewsSource = typeof newsSources.$inferSelect;
export type InsertNewsSource = z.infer<typeof insertNewsSourceSchema>;

export type ScrapingJob = typeof scrapingJobs.$inferSelect;
export type InsertScrapingJob = z.infer<typeof insertScrapingJobSchema>;



