/**
 * The Ditch Web Scraper
 * 
 * Uses Playwright (browser automation) to handle JavaScript-rendered content
 */

import { chromium } from 'playwright';
import { ScrapedArticle, normalizeArticleUrl } from '../newsScraperService';

const DITCH_BASE_URL = 'https://www.ontheditch.com';

/**
 * Scrape latest articles from The Ditch using Playwright
 */
export async function scrapeDitchLatestArticles(): Promise<ScrapedArticle[]> {
  let browser;
  
  try {
    console.log('📡 Scraping The Ditch homepage with browser automation...');
    
    // Launch headless browser
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    const page = await context.newPage();
    
    // Navigate to homepage
    console.log('  🌐 Loading page...');
    await page.goto(DITCH_BASE_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait for content to load
    console.log('  ⏳ Waiting for content to load...');
    try {
      await page.waitForSelector('article, h2, h3, .post', { timeout: 10000 });
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
      
      // Ghost CMS uses article cards with h2 headings
      // Try multiple selectors for Ghost structure
      
      // Method 1: Find article cards
      const articleCards = document.querySelectorAll('article, .post-card, .gh-card, [class*="article"]');
      
      articleCards.forEach(card => {
        // Find link within card
        const link = card.querySelector('a[href]') as HTMLAnchorElement;
        if (!link) return;
        
        const href = link.href;
        
        // Skip if already seen or not an article
        if (seen.has(href)) return;
        if (!href.includes('ontheditch.com')) return;
        if (href === 'https://www.ontheditch.com/' || href === 'http://www.ontheditch.com/') return;
        if (href.includes('/author/') || href.includes('/tag/') || href.includes('/#')) return;
        
        // Find title (h2 for Ghost typically)
        const heading = card.querySelector('h2, h1, h3');
        const title = heading?.textContent?.trim();
        
        if (title && title.length > 10) {
          seen.add(href);
          
          // Try to find date
          const timeElem = card.querySelector('time');
          const dateStr = timeElem?.getAttribute('datetime') || timeElem?.textContent;
          
          items.push({
            title: title,
            url: href,
            dateStr: dateStr || null
          });
        }
      });
      
      // Method 2: If no articles found, try finding all h2 links
      if (items.length === 0) {
        const headingLinks = document.querySelectorAll('h2 a, h1 a');
        
        headingLinks.forEach(link => {
          const href = (link as HTMLAnchorElement).href;
          
          if (!href.includes('ontheditch.com')) return;
          if (href === 'https://www.ontheditch.com/') return;
          if (seen.has(href)) return;
          
          const title = link.textContent?.trim();
          
          if (title && title.length > 10) {
            seen.add(href);
            items.push({
              title: title,
              url: href,
              dateStr: null
            });
          }
        });
      }
      
      return items;
    });
    
    await browser.close();
    
    // Convert to ScrapedArticle format
    const scrapedArticles: ScrapedArticle[] = articles.slice(0, 20)
      .map(item => {
        if (!item.dateStr) {
          console.log(`  ⚠️ Skipping Ditch article without date: ${item.title}`);
          return null;
        }
        
        const parsed = new Date(item.dateStr);
        if (Number.isNaN(parsed.getTime())) {
          console.log(`  ⚠️ Skipping Ditch article with unparseable date (${item.dateStr}): ${item.title}`);
          return null;
        }
        
        return {
          title: item.title,
          url: normalizeArticleUrl(item.url),
          content: item.title,
          published_date: parsed,
          source: 'The Ditch',
          credibility: 0.78
        };
      })
      .filter((article): article is ScrapedArticle => article !== null);
    
    // Deduplicate
    const uniqueArticles = Array.from(
      new Map(scrapedArticles.map(a => [a.url, a])).values()
    );
    
    console.log(`  ✅ Found ${uniqueArticles.length} articles from The Ditch`);
    
    return uniqueArticles;
    
  } catch (error: any) {
    console.error('  ❌ Failed to scrape The Ditch:', error.message);
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
 * Scrape full content from a Ditch article URL using Playwright
 */
export async function scrapeDitchArticleContent(url: string): Promise<string> {
  let browser;
  
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Extract article content
    const content = await page.evaluate(() => {
      // Remove unwanted elements
      const unwanted = document.querySelectorAll('script, style, nav, header, footer, aside, .advertisement, .social-share, .comments, .kg-bookmark-card');
      unwanted.forEach(el => el.remove());
      
      // Ghost CMS specific: Get all paragraphs from article
      const paragraphs: string[] = [];
      
      // Find article tag and get all p elements
      const article = document.querySelector('article');
      if (article) {
        article.querySelectorAll('p').forEach(p => {
          const text = p.textContent?.trim();
          // Skip donation buttons and other non-content
          if (text && 
              text.length > 50 && 
              !text.includes('Make a one-time donation') &&
              !text.includes('Powered by Ghost')) {
            paragraphs.push(text);
          }
        });
      }
      
      if (paragraphs.length > 0) {
        return paragraphs.join('\n\n');
      }
      
      // Fallback: Try other selectors
      const selectors = [
        '.gh-content',
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
    console.error(`  ❌ Failed to scrape Ditch article content: ${error.message}`);
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
 * Test The Ditch scraper
 */
export async function testDitchScraper(): Promise<void> {
  console.log('\n🧪 Testing The Ditch scraper...\n');
  
  const articles = await scrapeDitchLatestArticles();
  
  if (articles.length === 0) {
    console.log('❌ No articles found - scraper may need updating');
    console.log('💡 Visit https://www.theditch.ie and inspect HTML structure');
    console.log('💡 Use browser DevTools to find article selectors');
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
    const fullContent = await scrapeDitchArticleContent(articles[0].url);
    
    if (fullContent && fullContent.length > 200) {
      console.log(`✅ Successfully scraped full content (${fullContent.length} characters)`);
      console.log(`   Preview: ${fullContent.substring(0, 150)}...`);
    } else {
      console.log(`⚠️ Content scraping may need adjustment (${fullContent.length} chars)`);
    }
  }
}

export const DitchScraper = {
  scrapeLatestArticles: scrapeDitchLatestArticles,
  scrapeArticleContent: scrapeDitchArticleContent,
  test: testDitchScraper
};
