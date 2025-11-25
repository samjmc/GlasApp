/**
 * Gript Media Web Scraper
 * 
 * Uses Playwright (browser automation) to handle JavaScript-rendered content
 * Gript uses Vue.js, so we need a real browser to see the articles
 */

import { chromium } from 'playwright';
import { ScrapedArticle, normalizeArticleUrl } from '../newsScraperService';

const GRIPT_BASE_URL = 'https://gript.ie';
const GRIPT_NEWS_URL = 'https://gript.ie/news/';

/**
 * Scrape latest articles from Gript Media using Playwright
 * Handles JavaScript-rendered content (Vue.js)
 */
export async function scrapeGriptLatestArticles(): Promise<ScrapedArticle[]> {
  let browser;
  
  try {
    console.log('📡 Scraping Gript Media news page with browser automation...');
    
    // Launch headless browser
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    // Navigate to news page
    console.log('  🌐 Loading page...');
    await page.goto(GRIPT_NEWS_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait for Vue.js to render articles
    console.log('  ⏳ Waiting for content to load...');
    try {
      await page.waitForSelector('h3, article, .v-card', { timeout: 10000 });
    } catch {
      console.log('  ⚠️ Timeout waiting for selectors, proceeding anyway...');
    }
    
    // Give extra time for JavaScript rendering
    await page.waitForTimeout(2000);
    
    // Extract articles using browser JavaScript
    console.log('  🔍 Extracting articles...');
    const articles = await page.evaluate(() => {
      const items: any[] = [];
      
      // Find all links that look like article links
      const links = document.querySelectorAll('a[href]');
      
      links.forEach(link => {
          const href = (link as HTMLAnchorElement).href;
        
        // Must be an article URL (not category, tag, author, etc.)
        if (href.includes('gript.ie') && 
            !href.includes('/category/') && 
            !href.includes('/tag/') && 
            !href.includes('/author/') &&
            href !== 'https://gript.ie/' &&
            href !== 'https://gript.ie/news/') {
          
          // Try to find h3 within this link
          const h3 = link.querySelector('h3');
          const title = h3?.textContent?.trim();
          
          // Also try other heading levels
          const anyHeading = link.querySelector('h1, h2, h3, h4');
          const fallbackTitle = anyHeading?.textContent?.trim();
          
          const finalTitle = title || fallbackTitle;
          
          if (finalTitle && finalTitle.length > 10) {
            // Try to find date
            const timeElem = link.querySelector('time');
            const dateStr = timeElem?.getAttribute('datetime') || timeElem?.textContent;
            
            items.push({
              title: finalTitle,
              url: href,
              dateStr: dateStr || null
            });
          }
        }
      });
      
      return items;
    });
    
    await browser.close();
    
    // Convert to ScrapedArticle format
    const scrapedArticles: ScrapedArticle[] = articles.slice(0, 20)
      .map(item => {
        if (!item.dateStr) {
          console.log(`  ⚠️ Skipping Gript article without date: ${item.title}`);
          return null;
        }
        
        let publishedDate: Date | null = null;
        const parsed = new Date(item.dateStr);
        if (!Number.isNaN(parsed.getTime())) {
          publishedDate = parsed;
        } else {
          const dateMatch = item.dateStr.match(/(\w+)\s+(\d+),\s+(\d{4})/i);
          if (dateMatch) {
            const fallback = new Date(`${dateMatch[1]} ${dateMatch[2]}, ${dateMatch[3]}`);
            if (!Number.isNaN(fallback.getTime())) {
              publishedDate = fallback;
            }
          }
        }
        
        if (!publishedDate) {
          console.log(`  ⚠️ Skipping Gript article with unparseable date (${item.dateStr}): ${item.title}`);
          return null;
        }
        
        return {
          title: item.title,
          url: normalizeArticleUrl(item.url),
          content: item.title,  // Will be filled in when scraping full content
          published_date: publishedDate,
          source: 'Gript Media',
          credibility: 0.75
        };
      })
      .filter((article): article is ScrapedArticle => article !== null);
    
    // Deduplicate
    const uniqueArticles = Array.from(
      new Map(scrapedArticles.map(a => [a.url, a])).values()
    );
    
    console.log(`  ✅ Found ${uniqueArticles.length} articles from Gript Media`);
    
    return uniqueArticles;
    
  } catch (error: any) {
    console.error('  ❌ Failed to scrape Gript Media:', error.message);
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
 * Scrape full content from a Gript article URL using Playwright
 */
export async function scrapeGriptArticleContent(url: string): Promise<string> {
  let browser;
  
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);  // Wait for Vue.js
    
    // Extract article content using browser JavaScript
    const content = await page.evaluate(() => {
      // Remove unwanted elements
      const unwanted = document.querySelectorAll('script, style, nav, header, footer, aside, .advertisement, .social-share, .comments, .newsletter');
      unwanted.forEach(el => el.remove());
      
      // Try multiple selectors for article content
      const selectors = [
        '.v-card-text',
        '.entry-content',
        'div.entry-content.text-body-1',
        '.article-body',
        'article',
        'main'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent && element.textContent.trim().length > 300) {
          return element.textContent.trim();
        }
      }
      
      // Fallback: get all paragraphs
      const paragraphs: string[] = [];
      document.querySelectorAll('article p, .entry-content p, main p').forEach(p => {
        const text = p.textContent?.trim();
        if (text && text.length > 50) {
          paragraphs.push(text);
        }
      });
      
      return paragraphs.join('\n\n');
    });
    
    await browser.close();
    
    // Clean up whitespace
    const cleaned = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
    
    return cleaned;
    
  } catch (error: any) {
    console.error(`  ❌ Failed to scrape Gript article content: ${error.message}`);
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
 * Test Gript scraper
 */
export async function testGriptScraper(): Promise<void> {
  console.log('\n🧪 Testing Gript Media scraper...\n');
  
  const articles = await scrapeGriptLatestArticles();
  
  if (articles.length === 0) {
    console.log('❌ No articles found - scraper may need updating');
    console.log('💡 Visit https://gript.ie and inspect HTML structure');
    return;
  }
  
  console.log(`✅ Found ${articles.length} articles\n`);
  console.log('Sample articles:');
  articles.slice(0, 3).forEach((a, i) => {
    console.log(`${i + 1}. ${a.title}`);
    console.log(`   URL: ${a.url}`);
    console.log(`   Date: ${a.published_date.toLocaleDateString()}`);
  });
  
  // Test full content scraping
  if (articles.length > 0) {
    console.log(`\n🧪 Testing full content scraping...`);
    const fullContent = await scrapeGriptArticleContent(articles[0].url);
    
    if (fullContent && fullContent.length > 200) {
      console.log(`✅ Successfully scraped full content (${fullContent.length} characters)`);
      console.log(`   Preview: ${fullContent.substring(0, 150)}...`);
    } else {
      console.log(`⚠️ Content scraping may need adjustment (${fullContent.length} chars)`);
    }
  }
}

export const GriptScraper = {
  scrapeLatestArticles: scrapeGriptLatestArticles,
  scrapeArticleContent: scrapeGriptArticleContent,
  test: testGriptScraper
};

