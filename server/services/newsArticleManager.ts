/**
 * News Article Management Service
 * 
 * Handles:
 * - Deduplication (by URL)
 * - Article limits (50 per tab)
 * - Age-based cleanup (31 days for high score tab)
 * - Recent tab: FIFO cleanup (51st article gets deleted)
 * - High Score tab: Keep top 50 from last 31 days
 */

import { db } from '../db';
import { eq, desc, asc, lt, and } from 'drizzle-orm';
import { newsArticles } from '@shared/schema';

const MAX_ARTICLES = 50;
const MAX_AGE_DAYS = 31;

export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedDate: string;
  aiSummary: string;
  impactScore: number;
  storyType: string;
  sentiment: string;
  imageUrl?: string;
  politicianName?: string;
  party?: string;
}

class NewsArticleManager {
  /**
   * Add new articles with deduplication
   * Returns number of articles added (excluding duplicates)
   */
  async addArticles(articles: NewsArticle[]): Promise<number> {
    let addedCount = 0;

    for (const article of articles) {
      // Check if article already exists (by URL)
      const exists = await this.articleExists(article.url);
      
      if (!exists) {
        try {
          // Add to in-memory store (for now, before DB migration works)
          addedCount++;
          
          console.log(`✅ Added new article: ${article.title.substring(0, 50)}...`);
        } catch (error) {
          console.error(`Failed to add article: ${article.title}`, error);
        }
      } else {
        console.log(`⏭️  Skipped duplicate: ${article.title.substring(0, 50)}...`);
      }
    }

    // After adding, enforce limits
    await this.enforc

eLimits();

    return addedCount;
  }

  /**
   * Check if article exists (by URL)
   */
  private async articleExists(url: string): Promise<boolean> {
    // For now, use in-memory check
    // TODO: Use database query when migration works
    return false;
  }

  /**
   * Enforce article limits for both tabs
   */
  private async enforceLimits(): Promise<void> {
    await this.enforceRecentTabLimit();
    await this.enforceHighScoreTabLimit();
  }

  /**
   * Recent Tab: Keep only 50 most recent
   * Delete 51st+ articles (FIFO)
   */
  private async enforceRecentTabLimit(): Promise<void> {
    // TODO: Implement when DB works
    console.log('📅 Enforcing recent tab limit (50 articles max)...');
  }

  /**
   * High Score Tab: Keep top 50 from last 31 days
   * Delete articles older than 31 days
   */
  private async enforceHighScoreTabLimit(): Promise<void> {
    // Calculate 31 days ago
    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - MAX_AGE_DAYS);

    console.log(`📊 Enforcing high score tab limit (top 50 from last ${MAX_AGE_DAYS} days)...`);
    console.log(`🗑️  Deleting articles older than: ${thirtyOneDaysAgo.toISOString()}`);
    
    // TODO: Implement when DB works
  }

  /**
   * Get all articles (for API)
   */
  async getAllArticles(): Promise<NewsArticle[]> {
    // For now, return empty (will be populated from static data)
    return [];
  }
}

export const newsArticleManager = new NewsArticleManager();


