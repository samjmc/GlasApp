/**
 * Business Post Web Scraper
 * 
 * Uses Playwright (browser automation) to scrape political articles
 * RSS feed is blocked (403), so we scrape the website directly
 */

import { chromium } from 'playwright';
import { ScrapedArticle } from '../newsScraperService';

const BUSINESS_POST_POLITICS_URL = 'https://www.businesspost.ie/politics/';
const BUSINESS_POST_BASE_URL = 'https://www.businesspost.ie';

/**
 * Scrape latest political articles from Business Post using Playwright
 */
export async function scrapeBusinessPostLatestArticles(): Promise<ScrapedArticle[]> {
  let browser;
  
  try {
    console.log('📡 Scraping Business Post politics page with browser automation...');
    
    // Launch headless browser
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    // Navigate to politics page
    console.log('  🌐 Loading politics page...');
    await page.goto(BUSINESS_POST_POLITICS_URL, { 
      waitUntil: 'domcontentloaded',  // Changed from networkidle to be more lenient
      timeout: 45000 
    });
    
    // Wait for content to load
    console.log('  ⏳ Waiting for content to load...');
    try {
      await page.waitForSelector('article, h2, h3, .post, a[href*="/politics/"]', { timeout: 15000 });
    } catch {
      console.log('  ⚠️ Timeout waiting for selectors, proceeding anyway...');
    }
    
    // Give extra time for JavaScript
    await page.waitForTimeout(3000);
    
    // Extract articles
    console.log('  🔍 Extracting articles...');
    const articles = await page.evaluate(() => {
      const items: any[] = [];
      const seen = new Set<string>();
      
      // Find all article cards
      const articleCards = document.querySelectorAll('article');
      
      articleCards.forEach(card => {
        // Find link within card
        const link = card.querySelector('a[href]') as HTMLAnchorElement;
        if (!link) return;
        
        const href = link.href;
        
        // Skip if already seen or not a politics article
        if (seen.has(href)) return;
        if (!href.includes('businesspost.ie')) return;
        if (href === 'https://www.businesspost.ie/' || href === 'https://www.businesspost.ie/politics/') return;
        if (href.includes('/author/') || href.includes('/tag/') || href.includes('/#')) return;
        if (href.includes('/subscribe/') || href.includes('/events/')) return;
        
        // Find title (h2, h3, or h4)
        const heading = card.querySelector('h2, h3, h4');
        const title = heading?.textContent?.trim();
        
        if (title && title.length > 10) {
          // Try to find date
          const timeElem = card.querySelector('time');
          const dateStr = timeElem?.getAttribute('datetime') || timeElem?.textContent;
          
          seen.add(href);
          items.push({
            title: title,
            url: href,
            dateStr: dateStr || null
          });
        }
      });
      
      // Also try finding article links in the "Live News" section if present
      const liveNewsArticles = document.querySelectorAll('.live-news article, [class*="live"] article');
      liveNewsArticles.forEach(article => {
        const link = article.querySelector('a[href]') as HTMLAnchorElement;
        const heading = article.querySelector('h3, h4');
        
        if (link && heading) {
          const href = link.href;
          const title = heading.textContent?.trim();
          
          if (title && title.length > 10 && !seen.has(href)) {
            seen.add(href);
            items.push({
              title: title,
              url: href,
              dateStr: null
            });
          }
        }
      });
      
      return items;
    });
    
    await browser.close();
    
    // Convert to ScrapedArticle format
    const scrapedArticles: ScrapedArticle[] = articles.slice(0, 20).map(item => {
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
        source: 'Business Post',
        credibility: 0.88
      };
    });
    
    // Deduplicate
    const uniqueArticles = Array.from(
      new Map(scrapedArticles.map(a => [a.url, a])).values()
    );
    
    console.log(`  ✅ Found ${uniqueArticles.length} articles from Business Post`);
    
    return uniqueArticles;
    
  } catch (error: any) {
    console.error('  ❌ Failed to scrape Business Post:', error.message);
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
 * Scrape full content from a Business Post article URL using Playwright
 */
export async function scrapeBusinessPostArticleContent(url: string): Promise<string> {
  let browser;
  
  try {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);
    
    // Extract article content
    const content = await page.evaluate(() => {
      // Remove unwanted elements
      const unwanted = document.querySelectorAll('script, style, nav, header, footer, aside, .advertisement, .social-share, .comments, .newsletter, .subscribe-box');
      unwanted.forEach(el => el.remove());
      
      // Business Post specific: Get all paragraphs from article
      const paragraphs: string[] = [];
      
      // Find article tag and get all p elements
      const article = document.querySelector('article');
      if (article) {
        article.querySelectorAll('p').forEach(p => {
          const text = p.textContent?.trim();
          // Skip subscription prompts and other non-content
          if (text && 
              text.length > 50 && 
              !text.includes('Subscribe to') &&
              !text.includes('Sign up for') &&
              !text.includes('Powered by')) {
            paragraphs.push(text);
          }
        });
      }
      
      if (paragraphs.length > 0) {
        return paragraphs.join('\n\n');
      }
      
      // Fallback: Try other selectors
      const selectors = [
        '.article-content',
        '.post-content',
        '.entry-content',
        'main article',
        'main'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent && element.textContent.trim().length > 300) {
          return element.textContent.trim();
        }
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
    console.error(`  ❌ Failed to scrape Business Post article content: ${error.message}`);
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
 * Test Business Post scraper
 */
export async function testBusinessPostScraper(): Promise<void> {
  console.log('\n🧪 Testing Business Post scraper...\n');
  
  const articles = await scrapeBusinessPostLatestArticles();
  
  if (articles.length === 0) {
    console.log('❌ No articles found - scraper may need updating');
    console.log('💡 Visit https://www.businesspost.ie/politics/ and inspect HTML structure');
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
    const fullContent = await scrapeBusinessPostArticleContent(articles[0].url);
    
    if (fullContent && fullContent.length > 200) {
      console.log(`✅ Successfully scraped full content (${fullContent.length} characters)`);
      console.log(`   Preview: ${fullContent.substring(0, 150)}...`);
    } else {
      console.log(`⚠️ Content scraping may need adjustment (${fullContent.length} chars)`);
    }
  }
}

export const BusinessPostScraper = {
  scrapeLatestArticles: scrapeBusinessPostLatestArticles,
  scrapeArticleContent: scrapeBusinessPostArticleContent,
  test: testBusinessPostScraper
};

