/**
 * News Scraper Service
 * Fetches Irish news articles from RSS feeds and web scraping
 */

import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { TopicClassificationService } from './topicClassificationService';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'GlasPoliticsBot/1.0 (Irish Political News Aggregator)'
  }
});

// Irish news sources with RSS feeds
export const IRISH_NEWS_SOURCES = [
  // ESTABLISHMENT SOURCES (Pro-government bias)
  {
    name: 'The Irish Times',
    rss: 'https://www.irishtimes.com/cmlink/news-1.1319192',
    credibility: 0.95,
    bias: 0.10  // Slight pro-establishment bias
  },
  {
    name: 'RTE News',
    rss: 'https://www.rte.ie/rss/news.xml',
    credibility: 0.95,
    bias: 0.15  // Pro-government (state broadcaster)
  },
  {
    name: 'Irish Independent',
    rss: 'https://www.independent.ie/irish-news/rss/',
    credibility: 0.85,
    bias: 0.08  // Slight pro-establishment
  },
  
  // BALANCED SOURCES (Minimal bias)
  {
    name: 'The Journal',
    rss: 'https://www.thejournal.ie/feed/',
    credibility: 0.90,
    bias: 0.0  // Generally balanced
  },
  {
    name: 'Irish Examiner',
    rss: 'https://www.irishexaminer.com/feed/35-top-stories.xml',
    credibility: 0.85,
    bias: 0.0
  },
  // Breaking News - RSS feed no longer available (404 errors)
  // {
  //   name: 'Breaking News',
  //   rss: 'https://www.breakingnews.ie/rss/',
  //   credibility: 0.80,
  //   bias: 0.0,
  //   active: false
  // },
  
  // CRITICAL/INVESTIGATIVE SOURCES (Counter-balance to establishment)
  // Business Post - RSS feed has malformed XML (temporarily disabled)
  // {
  //   name: 'Business Post',
  //   rss: 'https://www.businesspost.ie/feed/',
  //   credibility: 0.88,
  //   bias: -0.05,  // Critical of government spending/policy
  //   active: false
  // },
  // Noteworthy - RSS feed returns 404 (temporarily disabled)
  // {
  //   name: 'Noteworthy',
  //   rss: 'https://www.noteworthy.ie/rss/',
  //   credibility: 0.92,
  //   bias: 0.0,  // Investigative, non-partisan
  //   active: false
  // },
  // Irish Legal News - RSS feed returns 404 (temporarily disabled)
  // {
  //   name: 'Irish Legal News',
  //   rss: 'https://www.irishlegal.com/rss/',
  //   credibility: 0.85,
  //   bias: 0.0,  // Legal/tribunal coverage
  //   active: false
  // }
  
  // NOTE: Gript and The Ditch use custom web scrapers (no RSS)
  // They're integrated via customScrapers service
  // See: server/services/customScrapers/griptScraper.ts
  // See: server/services/customScrapers/ditchScraper.ts
].filter(source => source.active !== false);  // Only include active sources

export interface ScrapedArticle {
  title: string;
  url: string;
  content: string;
  published_date: Date;
  source: string;
  credibility: number;
  imageUrl?: string;  // Article image from RSS feed or scraping
}

/**
 * Fetch articles from RSS feed
 */
export async function fetchRSSFeed(feedUrl: string, sourceName: string, credibility: number): Promise<ScrapedArticle[]> {
  try {
    console.log(`📡 Fetching RSS feed: ${sourceName}`);
    
    const feed = await parser.parseURL(feedUrl);
    const articles: ScrapedArticle[] = [];
    
    for (const item of feed.items.slice(0, 50)) { // Limit to 50 most recent
      if (!item.link) continue;
      
      // Ensure we have a valid publication date
      if (!item.pubDate) {
        console.log(`  ⚠️ Skipping article without pubDate from ${sourceName}: ${item.title}`);
        continue;
      }
      
      const publishedDate = new Date(item.pubDate);
      if (Number.isNaN(publishedDate.getTime())) {
        console.log(`  ⚠️ Skipping article with unparseable pubDate (${item.pubDate}) from ${sourceName}: ${item.title}`);
        continue;
      }
      
      // Try to extract image from RSS feed
      let imageUrl: string | undefined;
      
      // Method 1: Check enclosure (common in RSS)
      if (item.enclosure?.url) {
        imageUrl = item.enclosure.url;
      }
      
      // Method 2: Check content for images (parse HTML)
      if (!imageUrl && item.content) {
        const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/i);
        if (imgMatch) {
          imageUrl = imgMatch[1];
        }
      }
      
      // Method 3: Check contentSnippet for image URLs
      if (!imageUrl && item.contentSnippet) {
        const urlMatch = item.contentSnippet.match(/https?:\/\/[^\s]+\.(jpg|jpeg|png|webp)/i);
        if (urlMatch) {
          imageUrl = urlMatch[0];
        }
      }
      
      const normalizedUrl = normalizeArticleUrl(item.link);
      
      articles.push({
        title: item.title || 'Untitled',
        url: normalizedUrl,
        content: item.contentSnippet || item.content || '',
        published_date: publishedDate,
        source: sourceName,
        credibility,
        imageUrl  // Include image URL if found
      });
    }
    
    console.log(`  ✅ Found ${articles.length} articles from ${sourceName}`);
    return articles;
    
  } catch (error) {
    console.error(`  ❌ Failed to fetch RSS feed: ${sourceName}`, error);
    return [];
  }
}

/**
 * Scrape full article content from URL
 */
export async function scrapeArticleContent(url: string): Promise<string> {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GlasPoliticsBot/1.0; +https://glaspolitics.ie)'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(data);
    
    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .advertisement, .ad, .social-share, .comments').remove();
    
    // Try to find main article content
    let content = '';
    
    // Common article content selectors for Irish news sites
    const contentSelectors = [
      'article',
      '.article-content',
      '.story-content',
      '.entry-content',
      '[itemprop="articleBody"]',
      '.article-body',
      'main'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        content = element.text();
        break;
      }
    }
    
    // Fallback to body if no content found
    if (!content) {
      content = $('body').text();
    }
    
    // Clean up whitespace
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
    
    return content;
    
  } catch (error) {
    console.error(`Failed to scrape article: ${url}`, error);
    return '';
  }
}

/**
 * Fetch articles from all Irish news sources (RSS + custom scrapers)
 */
interface FetchNewsOptions {
  lookbackHours?: number;
}

export async function fetchAllIrishNews(options: FetchNewsOptions = {}): Promise<ScrapedArticle[]> {
  console.log('🗞️ Fetching from all Irish news sources...');
  
  const allArticles: ScrapedArticle[] = [];
  const lookbackHours = options.lookbackHours ?? 48;
  
  // Fetch from RSS sources
  for (const source of IRISH_NEWS_SOURCES) {
    const articles = await fetchRSSFeed(source.rss, source.name, source.credibility);
    allArticles.push(...articles);
    
    // Rate limiting - be respectful to news sites
    await sleep(1000);
  }
  
  // Fetch from custom scrapers (Gript, The Ditch)
  try {
    const { GriptScraper } = await import('./customScrapers/griptScraper');
    const griptArticles = await GriptScraper.scrapeLatestArticles();
    allArticles.push(...griptArticles);
    await sleep(2000);  // Longer delay for web scraping
  } catch (error: any) {
    console.log('  ⚠️ Gript scraper not available or failed');
  }
  
  try {
    const { DitchScraper } = await import('./customScrapers/ditchScraper');
      const ditchArticles = await DitchScraper.scrapeLatestArticles();
    allArticles.push(...ditchArticles);
    await sleep(2000);
  } catch (error: any) {
    console.log('  ⚠️ Ditch scraper not available or failed');
  }
  
  // Deduplicate by URL
  const uniqueArticles = Array.from(
    new Map(allArticles.map(a => [a.url, a])).values()
  );

  // Limit to articles within last 48 hours
  const cutoff = Date.now() - lookbackHours * 60 * 60 * 1000;
  const recentArticles = uniqueArticles.filter(article => {
    const published = article.published_date instanceof Date
      ? article.published_date.getTime()
      : new Date(article.published_date).getTime();
    
    if (Number.isNaN(published)) {
      console.log(`   ⚠️ Skipping article with invalid published date: ${article.title}`);
      return false;
    }
    
    return published >= cutoff;
  });
  
  console.log(`📊 Total unique articles: ${uniqueArticles.length}`);
  console.log(`   From RSS sources: ${IRISH_NEWS_SOURCES.length} sources`);
  console.log(`   From custom scrapers: Gript + The Ditch`);
  console.log(`🕒 Articles within 48h window: ${recentArticles.length}`);
  
  return recentArticles;
}

/**
 * Filter articles that mention Irish politics
 */
export async function filterPoliticalArticles(articles: ScrapedArticle[]): Promise<ScrapedArticle[]> {
  const politicalKeywords = [
    'td', 'tds', 'dáil', 'dail', 'oireachtas', 'minister', 'taoiseach',
    'tánaiste', 'tanaiste', 'deputy', 'senator', 'constituency',
    'department', 'cabinet', 'referendum', 'legislation', 'bill',
    'budget', 'programme for government',
    'fianna fáil', 'fine gael', 'sinn féin', 'sinn fein',
    'labour', 'green party', 'social democrats', 'people before profit',
    'aontú', 'aontu', 'independent ireland',
    'local election', 'general election',
    'dail debate', 'opposition', 'government', 'coalition'
  ];

  const fastMatches: ScrapedArticle[] = [];
  const maybePolitical: ScrapedArticle[] = [];

  for (const article of articles) {
    const textLower = (article.title + ' ' + article.content).toLowerCase();
    const hasKeyword = politicalKeywords.some(keyword => textLower.includes(keyword));
    if (hasKeyword) {
      fastMatches.push(article);
    } else {
      maybePolitical.push(article);
    }
  }

  const classified: ScrapedArticle[] = [];
  if (maybePolitical.length > 0) {
    console.log(`🔎 Topic classifier reviewing ${maybePolitical.length} articles without keyword hits...`);
    for (const article of maybePolitical) {
      const classification = await TopicClassificationService.classifyArticle({
        title: article.title,
        content: article.content,
        source: article.source,
      });

      if (
        classification?.isPolitical &&
        classification.confidence >= 0.55 &&
        classification.relevance >= 0.4
      ) {
        classified.push(article);
      }
    }
  }

  const total = fastMatches.length + classified.length;
  console.log(`✅ Political filter retained ${total} articles (${fastMatches.length} keyword, ${classified.length} classifier)`);
  return [...fastMatches, ...classified];
}

/**
 * Check if article was already processed
 */
export async function isArticleAlreadyProcessed(url: string): Promise<boolean> {
  // Query database to check if URL exists
  // Implementation depends on your database setup
  return false; // Placeholder
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export default service object
export const NewsScraperService = {
  fetchAllIrishNews,
  fetchRSSFeed,
  scrapeArticleContent,
  filterPoliticalArticles,
  isArticleAlreadyProcessed,
  normalizeArticleUrl
};

export function normalizeArticleUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString();
  } catch {
    return url;
  }
}



