"""
Content Scraper Module
Extracts full article content from URLs
"""

import requests
import logging
from typing import Optional, Dict, List
from bs4 import BeautifulSoup
import time
from newspaper import Article
import html2text

logger = logging.getLogger(__name__)


class ContentScraper:
    def __init__(self, config: Dict):
        self.timeout = config.get('scraping', {}).get('timeout', 10)
        self.user_agent = config.get('scraping', {}).get('user_agent',
                                                         'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
        self.min_content_length = config.get('filtering', {}).get('min_content_length', 200)
        self.delay = config.get('scraping', {}).get('delay_between_requests', 1)
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': self.user_agent})
        
    def scrape_article(self, url: str, title: str = '') -> Optional[Dict[str, str]]:
        """
        Scrape article content from URL using multiple methods
        
        Returns:
            Dict with 'content', 'title', 'authors', 'publish_date' or None
        """
        if not url or not url.startswith('http'):
            logger.warning(f"Invalid URL: {url}")
            return None
            
        # Try newspaper3k first (best for news articles)
        result = self._scrape_with_newspaper(url, title)
        if result and len(result.get('content', '')) >= self.min_content_length:
            return result
            
        # Fallback to BeautifulSoup
        logger.debug(f"Newspaper3k failed, trying BeautifulSoup for: {url}")
        result = self._scrape_with_beautifulsoup(url, title)
        if result and len(result.get('content', '')) >= self.min_content_length:
            return result
            
        logger.warning(f"Failed to scrape sufficient content from: {url}")
        return None
        
    def _scrape_with_newspaper(self, url: str, fallback_title: str) -> Optional[Dict[str, str]]:
        """Scrape using newspaper3k library"""
        try:
            article = Article(url)
            article.download()
            article.parse()
            
            time.sleep(self.delay)
            
            content = article.text.strip()
            
            if not content:
                return None
                
            return {
                'content': content,
                'title': article.title or fallback_title,
                'authors': ', '.join(article.authors) if article.authors else 'Unknown',
                'publish_date': str(article.publish_date) if article.publish_date else None,
                'url': url,
                'top_image': article.top_image if hasattr(article, 'top_image') else None
            }
            
        except Exception as e:
            logger.debug(f"Newspaper3k error for {url}: {str(e)}")
            return None
            
    def _scrape_with_beautifulsoup(self, url: str, fallback_title: str) -> Optional[Dict[str, str]]:
        """Scrape using BeautifulSoup as fallback"""
        try:
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
            
            time.sleep(self.delay)
            
            soup = BeautifulSoup(response.content, 'lxml')
            
            # Remove script and style elements
            for script in soup(["script", "style", "nav", "footer", "header"]):
                script.decompose()
                
            # Try to find article content
            article_content = None
            
            # Look for common article container tags
            for selector in ['article', 'div.article-content', 'div.post-content', 
                           'div.entry-content', 'div.content', 'main']:
                article_content = soup.select_one(selector)
                if article_content:
                    break
                    
            # If no specific article container, use body
            if not article_content:
                article_content = soup.body
                
            if not article_content:
                return None
                
            # Extract text
            h = html2text.HTML2Text()
            h.ignore_links = False
            h.ignore_images = True
            text = h.handle(str(article_content))
            
            # Clean up
            text = '\n'.join(line.strip() for line in text.split('\n') if line.strip())
            
            if not text:
                return None
                
            # Try to get title
            title = fallback_title
            title_tag = soup.find('title')
            if title_tag:
                title = title_tag.get_text().strip()
            elif soup.find('h1'):
                title = soup.find('h1').get_text().strip()
                
            return {
                'content': text,
                'title': title,
                'authors': 'Unknown',
                'publish_date': None,
                'url': url,
                'top_image': None
            }
            
        except Exception as e:
            logger.debug(f"BeautifulSoup error for {url}: {str(e)}")
            return None
            
    def scrape_batch(self, articles: List[Dict]) -> List[Dict]:
        """
        Scrape content for multiple articles
        
        Args:
            articles: List of article dicts with 'link' and 'title' keys
            
        Returns:
            List of articles with 'scraped_content' added
        """
        results = []
        
        for i, article in enumerate(articles):
            logger.info(f"Scraping article {i+1}/{len(articles)}: {article.get('title', 'No title')[:60]}...")
            
            scraped_data = self.scrape_article(
                article.get('link', ''),
                article.get('title', '')
            )
            
            if scraped_data:
                article['scraped_content'] = scraped_data
                article['content'] = scraped_data['content']
                results.append(article)
            else:
                logger.warning(f"Skipping article due to scraping failure: {article.get('title')}")
                
        return results


