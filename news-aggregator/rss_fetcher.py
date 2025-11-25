"""
RSS Feed Fetcher Module
Fetches and parses RSS feeds from Irish news sources
"""

import feedparser
import logging
from datetime import datetime, timedelta
from typing import List, Dict
from dateutil import parser as date_parser

logger = logging.getLogger(__name__)


class RSSFetcher:
    def __init__(self, config: Dict):
        self.config = config
        self.max_age_days = config.get('filtering', {}).get('max_age_days', 7)
        
    def fetch_all_feeds(self, feed_urls: List[Dict[str, str]]) -> List[Dict]:
        """
        Fetch all RSS feeds and aggregate articles
        
        Args:
            feed_urls: List of dicts with 'url' and 'name' keys
            
        Returns:
            List of article dictionaries
        """
        all_articles = []
        
        for feed_info in feed_urls:
            url = feed_info['url']
            name = feed_info.get('name', 'Unknown Source')
            
            try:
                logger.info(f"Fetching RSS feed: {name}")
                articles = self.fetch_feed(url, name)
                all_articles.extend(articles)
                logger.info(f"Retrieved {len(articles)} articles from {name}")
            except Exception as e:
                logger.error(f"Error fetching feed {name}: {str(e)}")
                
        # Remove duplicates based on title
        unique_articles = self._deduplicate_articles(all_articles)
        logger.info(f"Total unique articles after deduplication: {len(unique_articles)}")
        
        return unique_articles
    
    def fetch_feed(self, url: str, source_name: str) -> List[Dict]:
        """Fetch and parse a single RSS feed"""
        feedparser.USER_AGENT = "GlasPoliticsBot/1.0 (Irish Political News)"
        feed = feedparser.parse(url)
        articles = []
        
        cutoff_date = datetime.now() - timedelta(days=self.max_age_days)
        
        for entry in feed.entries:
            try:
                # Parse publication date
                pub_date = None
                if hasattr(entry, 'published'):
                    try:
                        pub_date = date_parser.parse(entry.published)
                    except:
                        pass
                elif hasattr(entry, 'updated'):
                    try:
                        pub_date = date_parser.parse(entry.updated)
                    except:
                        pass
                
                article = {
                    'title': entry.get('title', 'No Title'),
                    'link': entry.get('link', ''),
                    'published': pub_date.isoformat() if pub_date else None,
                    'summary': entry.get('summary', ''),
                    'source': source_name,
                    'raw_entry': entry
                }
                
                # No keyword filtering - let LLM handle all filtering
                articles.append(article)
                
            except Exception as e:
                logger.warning(f"Error parsing entry: {str(e)}")
                continue
                
        return articles
    
    def _deduplicate_articles(self, articles: List[Dict]) -> List[Dict]:
        """Remove duplicate articles based on title similarity"""
        seen_titles = set()
        unique_articles = []
        
        for article in articles:
            title_normalized = article['title'].lower().strip()
            
            if title_normalized not in seen_titles:
                seen_titles.add(title_normalized)
                unique_articles.append(article)
                
        return unique_articles


