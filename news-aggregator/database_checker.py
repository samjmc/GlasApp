"""
Database Checker for Article Deduplication
Checks which articles already exist in the database to avoid reprocessing
"""

import os
import logging
from typing import List, Dict, Set
from dotenv import load_dotenv
from supabase import create_client, Client

logger = logging.getLogger(__name__)

load_dotenv()


class DatabaseChecker:
    def __init__(self):
        """Initialize Supabase client"""
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_ANON_KEY')
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY environment variables must be set")
        
        self.supabase: Client = create_client(supabase_url, supabase_key)
        
    def get_existing_urls(self, days_back: int = 30) -> Set[str]:
        """
        Get URLs of articles already in the database
        
        Args:
            days_back: Only check articles from last N days (default 30)
            
        Returns:
            Set of URLs already in database
        """
        try:
            from datetime import datetime, timedelta
            
            # Calculate the cutoff date
            cutoff_date = (datetime.now() - timedelta(days=days_back)).isoformat()
            
            # Query database for existing article URLs
            # We only check recent articles to keep the query fast
            response = self.supabase.table('news_articles')\
                .select('url')\
                .gte('created_at', cutoff_date)\
                .execute()
            
            existing_urls = {article['url'] for article in response.data}
            
            logger.info(f"Found {len(existing_urls)} existing articles in database (last {days_back} days)")
            return existing_urls
            
        except Exception as e:
            logger.error(f"Error fetching existing URLs from database: {str(e)}")
            # Return empty set so we don't skip articles if there's an error
            return set()
    
    def filter_new_articles(self, articles: List[Dict]) -> List[Dict]:
        """
        Filter out articles that already exist in database
        
        Args:
            articles: List of articles with 'link' field
            
        Returns:
            List of only new articles (not in database)
        """
        if not articles:
            return []
        
        existing_urls = self.get_existing_urls()
        
        new_articles = [
            article for article in articles
            if article.get('link', '') not in existing_urls
        ]
        
        skipped_count = len(articles) - len(new_articles)
        
        logger.info(f"Article deduplication: {len(articles)} total → {len(new_articles)} new (skipped {skipped_count} existing)")
        
        if skipped_count > 0:
            logger.info(f"💰 Cost savings: Skipped AI processing for {skipped_count} articles already in database")
        
        return new_articles

