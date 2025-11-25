"""
Irish Political News Aggregator for Glas Politics
Fetches, scores, and saves top Irish political news daily
"""

import os
import sys
import logging
import json
import yaml
from datetime import datetime
from typing import List, Dict
from pathlib import Path
import requests

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from rss_fetcher import RSSFetcher
from content_scraper import ContentScraper
from llm_article_filter import LLMArticleFilter
from ai_scorer import AIScorer
from ai_image_generator import AIImageGenerator
from database_checker import DatabaseChecker

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class IrishPoliticsAggregator:
    def __init__(self, config_path: str = 'config_irish_politics.yaml'):
        """Initialize the Irish political news aggregator"""
        self.config = self._load_config(config_path)
        self.api_key = os.getenv('OPENAI_API_KEY')
        
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        
        # Initialize components
        self.rss_fetcher = RSSFetcher(self.config)
        self.content_scraper = ContentScraper(self.config)
        self.article_filter = LLMArticleFilter(self.api_key)
        self.ai_scorer = AIScorer(self.api_key, self.config)
        self.db_checker = DatabaseChecker()
        
        # Initialize image generator if enabled
        self.image_generation_enabled = self.config.get('image_generation', {}).get('enabled', False)
        if self.image_generation_enabled:
            self.image_generator = AIImageGenerator(self.api_key, self.config)
            logger.info("✅ AI Image Generation enabled")
        
        # Backend API URL
        self.api_url = os.getenv('API_URL', 'http://localhost:5000/api')
        
        logger.info("✅ Irish Politics Aggregator initialized")
    
    def _load_config(self, config_path: str) -> Dict:
        """Load configuration from YAML file"""
        try:
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            return config
        except Exception as e:
            logger.error(f"Failed to load config: {str(e)}")
            raise
    
    def run_daily_aggregation(self) -> Dict:
        """
        Run the full daily news aggregation pipeline
        
        Returns:
            Dict with summary statistics
        """
        logger.info("\n" + "="*60)
        logger.info("🗞️  STARTING IRISH POLITICAL NEWS AGGREGATION")
        logger.info(f"📅 {datetime.now().strftime('%A, %B %d, %Y %I:%M %p')}")
        logger.info("="*60 + "\n")
        
        stats = {
            'started_at': datetime.now().isoformat(),
            'rss_articles_found': 0,
            'new_articles': 0,
            'skipped_existing': 0,
            'filtered_articles': 0,
            'scraped_articles': 0,
            'scored_articles': 0,
            'top_articles_count': 0,
            'saved_to_database': 0,
            'errors': []
        }
        
        try:
            # Step 1: Fetch RSS feeds
            logger.info("📡 Step 1: Fetching RSS feeds from Irish news sources...")
            feed_urls = self.config.get('rss_feeds', [])
            raw_articles = self.rss_fetcher.fetch_all_feeds(feed_urls)
            stats['rss_articles_found'] = len(raw_articles)
            logger.info(f"✅ Found {len(raw_articles)} articles\n")
            
            if len(raw_articles) == 0:
                logger.warning("No articles found in RSS feeds!")
                return stats
            
            # Step 1.5: Check database for existing articles (SAVE MONEY!)
            logger.info("🔍 Step 1.5: Checking database for existing articles...")
            new_articles = self.db_checker.filter_new_articles(raw_articles)
            stats['new_articles'] = len(new_articles)
            stats['skipped_existing'] = len(raw_articles) - len(new_articles)
            logger.info(f"✅ {len(new_articles)} new articles (skipped {stats['skipped_existing']} existing)\n")
            
            if len(new_articles) == 0:
                logger.info("No new articles to process - all articles already in database!")
                logger.info("💰 Cost saved by skipping duplicate processing!")
                return stats
            
            # Step 2: Filter for political relevance using AI
            logger.info("🤖 Step 2: Filtering for political relevance using AI...")
            filtered_articles = self.article_filter.filter_articles(new_articles, batch_size=50)
            stats['filtered_articles'] = len(filtered_articles)
            logger.info(f"✅ {len(filtered_articles)} politically relevant articles\n")
            
            if len(filtered_articles) == 0:
                logger.warning("No politically relevant articles after filtering!")
                return stats
            
            # Step 3: Scrape full article content
            logger.info("📰 Step 3: Scraping full article content...")
            # Limit to 30 articles to avoid long scraping times
            articles_to_scrape = filtered_articles[:30]
            scraped_articles = self.content_scraper.scrape_batch(articles_to_scrape)
            stats['scraped_articles'] = len(scraped_articles)
            logger.info(f"✅ Successfully scraped {len(scraped_articles)} articles\n")
            
            # Step 4: Score articles with AI
            logger.info("🎯 Step 4: Scoring articles with AI (this may take a while)...")
            scored_articles = self.ai_scorer.score_batch(scraped_articles)
            stats['scored_articles'] = len(scored_articles)
            logger.info(f"✅ Successfully scored {len(scored_articles)} articles\n")
            
            # Step 5: Get top 5 articles
            logger.info("🏆 Step 5: Selecting top articles...")
            top_count = self.config.get('output', {}).get('top_articles_count', 5)
            top_articles = self.ai_scorer.get_top_articles(scored_articles, count=top_count)
            stats['top_articles_count'] = len(top_articles)
            
            # Step 5.5: Generate AI images for top articles (if enabled)
            if self.image_generation_enabled:
                logger.info("🎨 Step 5.5: Generating AI images for articles...")
                top_articles = self.image_generator.generate_batch(top_articles)
                logger.info(f"✅ Generated {len(top_articles)} AI images\n")
            
            # Log top articles
            logger.info(f"\n📊 TOP {len(top_articles)} ARTICLES:")
            for i, article in enumerate(top_articles, 1):
                logger.info(f"\n{i}. {article['title']}")
                logger.info(f"   Source: {article.get('source', 'Unknown')}")
                logger.info(f"   Score: {article.get('ai_score', 0):.1f}/100")
                logger.info(f"   Summary: {article.get('ai_summary', 'No summary')[:100]}...")
            
            # Step 6: Save to database via API
            logger.info("\n💾 Step 6: Saving to database...")
            if self.config.get('database', {}).get('save_to_database', True):
                saved_count = self._save_articles_to_database(top_articles)
                stats['saved_to_database'] = saved_count
                logger.info(f"✅ Saved {saved_count} articles to database\n")
            
            # Step 7: Save to JSON file (backup)
            self._save_to_json(top_articles, stats)
            
            stats['completed_at'] = datetime.now().isoformat()
            
            logger.info("\n" + "="*60)
            logger.info("✅ DAILY NEWS AGGREGATION COMPLETE!")
            logger.info("="*60)
            logger.info(f"📊 Statistics:")
            logger.info(f"   RSS Articles Found: {stats['rss_articles_found']}")
            logger.info(f"   💰 Skipped (existing): {stats['skipped_existing']}")
            logger.info(f"   ✨ New Articles: {stats['new_articles']}")
            logger.info(f"   Filtered (political): {stats['filtered_articles']}")
            logger.info(f"   Scraped: {stats['scraped_articles']}")
            logger.info(f"   Scored: {stats['scored_articles']}")
            logger.info(f"   Top Articles: {stats['top_articles_count']}")
            logger.info(f"   Saved to DB: {stats['saved_to_database']}")
            logger.info("="*60 + "\n")
            
            return stats
            
        except Exception as e:
            logger.error(f"❌ Fatal error in aggregation pipeline: {str(e)}")
            stats['errors'].append(str(e))
            stats['completed_at'] = datetime.now().isoformat()
            return stats
    
    def _save_articles_to_database(self, articles: List[Dict]) -> int:
        """Save articles to Supabase via API"""
        saved_count = 0
        
        for article in articles:
            try:
                # Prepare article data for database
                article_data = {
                    'url': article.get('link', ''),
                    'title': article.get('title', ''),
                    'content': article.get('content', ''),
                    'source': article.get('source', ''),
                    'published_date': article.get('published', datetime.now().isoformat()),
                    'ai_summary': article.get('ai_summary', ''),
                    'impact_score': article.get('ai_score', 0),
                    'score_breakdown': json.dumps(article.get('score_breakdown', {})),
                    'processed': True
                }
                
                # Check if article mentions a TD
                if article.get('score_breakdown', {}).get('mentions_td'):
                    article_data['politician_name'] = article.get('score_breakdown', {}).get('td_name')
                    article_data['party'] = article.get('score_breakdown', {}).get('party')
                
                # Save via API
                response = requests.post(
                    f"{self.api_url}/news-feed/save",
                    json=article_data,
                    timeout=10
                )
                
                if response.status_code == 201 or response.status_code == 200:
                    saved_count += 1
                    logger.debug(f"✅ Saved: {article.get('title', '')[:50]}...")
                else:
                    logger.warning(f"⚠️  API returned {response.status_code} for: {article.get('title', '')[:50]}")
                    
            except Exception as e:
                logger.error(f"Failed to save article: {str(e)}")
        
        return saved_count
    
    def _save_to_json(self, articles: List[Dict], stats: Dict):
        """Save results to JSON file (backup)"""
        try:
            output_dir = Path('output')
            output_dir.mkdir(exist_ok=True)
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_file = output_dir / f'irish_politics_top_articles_{timestamp}.json'
            
            output_data = {
                'generated_at': datetime.now().isoformat(),
                'statistics': stats,
                'top_articles': articles
            }
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"💾 Saved to: {output_file}")
            
            # Also save as "latest" for easy access
            latest_file = output_dir / 'latest_irish_politics.json'
            with open(latest_file, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            
        except Exception as e:
            logger.error(f"Failed to save JSON: {str(e)}")


def main():
    """Main entry point"""
    try:
        # Load environment variables
        from dotenv import load_dotenv
        load_dotenv()
        
        # Initialize aggregator
        aggregator = IrishPoliticsAggregator('config_irish_politics.yaml')
        
        # Run aggregation
        stats = aggregator.run_daily_aggregation()
        
        # Exit with appropriate code
        if stats.get('errors'):
            sys.exit(1)
        else:
            sys.exit(0)
            
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()

