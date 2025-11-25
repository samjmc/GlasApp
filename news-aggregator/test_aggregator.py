#!/usr/bin/env python3
"""
Test the Irish Political News Aggregator
Runs a quick test with limited articles to verify setup
"""

import sys
import os
from pathlib import Path
import logging

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from irish_politics_aggregator import IrishPoliticsAggregator

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def main():
    print("\n*** TESTING IRISH POLITICAL NEWS AGGREGATOR ***")
    print("="*60)
    print("This is a test run with limited articles\n")
    
    try:
        # Initialize
        aggregator = IrishPoliticsAggregator('config_irish_politics.yaml')
        
        # Run aggregation
        stats = aggregator.run_daily_aggregation()
        
        print("\n[SUCCESS] TEST COMPLETE!")
        print("="*60)
        print("\nResults:")
        print(f"   Articles found: {stats['rss_articles_found']}")
        print(f"   Filtered: {stats['filtered_articles']}")
        print(f"   Scraped: {stats['scraped_articles']}")
        print(f"   Scored: {stats['scored_articles']}")
        print(f"   Top articles: {stats['top_articles_count']}")
        print(f"   Saved: {stats['saved_to_database']}")
        
        if stats.get('errors'):
            print(f"\n[WARNING] Errors: {len(stats['errors'])}")
            for error in stats['errors']:
                print(f"   - {error}")
        
        print("\nCheck output/latest_irish_politics.json for results\n")
        
        return 0 if not stats.get('errors') else 1
        
    except Exception as e:
        print(f"\n[ERROR] TEST FAILED: {str(e)}\n")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())

