/**
 * Breaking News Web Scraper
 * 
 * Uses Playwright (browser automation) to scrape Irish news articles
 * RSS feed returns 404, so we scrape the website directly
 */

import { chromium } from 'playwright';
import { ScrapedArticle } from '../newsScraperService';

const BREAKING_NEWS_IRELAND_URL = 'https://www.breakingnews.ie/ireland/';
const BREAKING_NEWS_BASE_URL = 'https://www.breakingnews.ie';

/**
 * Scrape latest articles from Breaking News Ireland section using Playwright
 */
export async function scrapeBreakingNewsLatestArticles(): Promise<ScrapedArticle[]> {
  let browser;
  
  try {
    console.log('📡 Scraping Breaking News Ireland page with browser automation...');
    
    // Launch headless browser
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    // Navigate to Ireland section
    console.log('  🌐 Loading Ireland news page...');
    await page.goto(BREAKING_NEWS_IRELAND_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait for content to load
    console.log('  ⏳ Waiting for content to load...');
    try {
      await page.waitForSelector('article, .item, .article-item', { timeout: 10000 });
    } catch {
      console.log('  ⚠️ Timeout waiting for selectors, proceeding anyway...');
    }
    
    // Give extra time for JavaScript
    await page.waitForTimeout(2000);
    
    // Extract articles
    console.log('  🔍 Extracting articles...');
    const articles = await page.evaluate(() => {
      const items: any[] = [];
      const seen = new Set<string>();
      
      // Find all article elements or links to articles
      const articleElements = document.querySelectorAll('article, [class*="article"], [class*="item"]');
      
      articleElements.forEach(element => {
        // Find link within element
        const link = element.querySelector('a[href*="/ireland/"]') as HTMLAnchorElement;
        if (!link) return;
        
        const href = link.href;
        
        // Skip if already seen or not a valid article
        if (seen.has(href)) return;
        if (!href.includes('breakingnews.ie/ireland/')) return;
        if (href === 'https://www.breakingnews.ie/ireland/' || href === 'https://www.breakingnews.ie/') return;
        if (href.includes('#') || href.includes('/category/') || href.includes('/tag/')) return;
        
        // Find title (h1, h2, h3, or h4)
        const heading = element.querySelector('h1, h2, h3, h4');
        const title = heading?.textContent?.trim() || link.textContent?.trim();
        
        if (title && title.length > 10) {
          // Try to find date
          const timeElem = element.querySelector('time, [class*="date"], [class*="time"]');
          const dateStr = timeElem?.getAttribute('datetime') || timeElem?.textContent;
          
          seen.add(href);
          items.push({
            title: title,
            url: href,
            dateStr: dateStr || null
          });
        }
      });
      
      // Also check the live ticker / headlines at the top
      const liveLinks = document.querySelectorAll('a[href*="/ireland/"]');
      liveLinks.forEach((link: any) => {
        const href = link.href;
        const text = link.textContent?.trim();
        
        // Extract title from "| HH:MM – Title" format
        const match = text?.match(/\|\s*\d{2}:\d{2}\s*[–-]\s*(.+)/);
        const title = match ? match[1].trim() : text;
        
        if (title && title.length > 10 && !seen.has(href) && href.includes('.html')) {
          seen.add(href);
          items.push({
            title: title,
            url: href,
            dateStr: null
          });
        }
      });
      
      return items;
    });
    
    await browser.close();
    
    // Convert to ScrapedArticle format
    const scrapedArticles: ScrapedArticle[] = articles.slice(0, 25).map(item => {
      let publishedDate = new Date();
      
      if (item.dateStr) {
        const parsed = new Date(item.dateStr);
        if (!isNaN(parsed.getTime())) {
          publishedDate = parsed;
        }
      }
      
      return {
        title: item.title,
        url: item.url,
        content: item.title,  // Will be filled in when scraping full content
        published_date: publishedDate,
        source: 'Breaking News',
        credibility: 0.82
      };
    });
    
    // Deduplicate
    const uniqueArticles = Array.from(
      new Map(scrapedArticles.map(a => [a.url, a])).values()
    );
    
    console.log(`  ✅ Found ${uniqueArticles.length} articles from Breaking News`);
    
    return uniqueArticles;
    
  } catch (error: any) {
    console.error('  ❌ Failed to scrape Breaking News:', error.message);
    return [];
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
  }
}

/**
 * Scrape full content from a Breaking News article URL using Playwright
 */
export async function scrapeBreakingNewsArticleContent(url: string): Promise<string> {
  let browser;
  
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Extract article content
    const content = await page.evaluate(() => {
      // Remove unwanted elements
      const unwanted = document.querySelectorAll('script, style, nav, header, footer, aside, .advertisement, .social-share, .comments, .newsletter, .related-articles');
      unwanted.forEach(el => el.remove());
      
      // Breaking News specific: Get all paragraphs from article
      const paragraphs: string[] = [];
      
      // Find article content
      const articleSelectors = [
        'article .article-body',
        'article .content',
        '.article-content',
        'article',
        'main article'
      ];
      
      for (const selector of articleSelectors) {
        const article = document.querySelector(selector);
        if (article) {
          article.querySelectorAll('p').forEach(p => {
            const text = p.textContent?.trim();
            // Skip ads and non-content
            if (text && 
                text.length > 40 && 
                !text.includes('Subscribe to') &&
                !text.includes('Sign up for') &&
                !text.includes('newsletter')) {
              paragraphs.push(text);
            }
          });
          
          if (paragraphs.length > 2) break;
        }
      }
      
      if (paragraphs.length > 0) {
        return paragraphs.join('\n\n');
      }
      
      // Fallback: Get main content
      const mainContent = document.querySelector('main, .main-content, #content');
      if (mainContent && mainContent.textContent && mainContent.textContent.trim().length > 300) {
        return mainContent.textContent.trim();
      }
      
      return '';
    });
    
    await browser.close();
    
    const cleaned = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
    
    return cleaned;
    
  } catch (error: any) {
    console.error(`  ❌ Failed to scrape Breaking News article content: ${error.message}`);
    return '';
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
  }
}

/**
 * Test Breaking News scraper
 */
export async function testBreakingNewsScraper(): Promise<void> {
  console.log('\n🧪 Testing Breaking News scraper...\n');
  
  const articles = await scrapeBreakingNewsLatestArticles();
  
  if (articles.length === 0) {
    console.log('❌ No articles found - scraper may need updating');
    console.log('💡 Visit https://www.breakingnews.ie/ireland/ and inspect HTML structure');
    return;
  }
  
  console.log(`✅ Found ${articles.length} articles\n`);
  console.log('Sample articles:');
  articles.slice(0, 5).forEach((a, i) => {
    console.log(`${i + 1}. ${a.title}`);
    console.log(`   URL: ${a.url}`);
  });
  
  // Test full content scraping
  if (articles.length > 0) {
    console.log(`\n🧪 Testing full content scraping...`);
    const fullContent = await scrapeBreakingNewsArticleContent(articles[0].url);
    
    if (fullContent && fullContent.length > 200) {
      console.log(`✅ Successfully scraped full content (${fullContent.length} characters)`);
      console.log(`   Preview: ${fullContent.substring(0, 150)}...`);
    } else {
      console.log(`⚠️ Content scraping may need adjustment (${fullContent.length} chars)`);
    }
  }
}

export const BreakingNewsScraper = {
  scrapeLatestArticles: scrapeBreakingNewsLatestArticles,
  scrapeArticleContent: scrapeBreakingNewsArticleContent,
  test: testBreakingNewsScraper
};











