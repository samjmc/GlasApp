#!/usr/bin/env python3
"""
Test Irish News RSS Feeds
Check which feeds are accessible and scrapable
"""

import feedparser
import requests
from datetime import datetime

print("\n*** TESTING IRISH NEWS RSS FEEDS ***")
print("="*70)

feeds_to_test = [
    ("Irish Times - News", "https://www.irishtimes.com/cmlink/news-1.1319192"),
    ("Irish Times - Politics", "https://www.irishtimes.com/cmlink/politics-1.1319195"),
    ("RTE News", "https://www.rte.ie/rss/news.xml"),
    ("Irish Independent", "https://www.independent.ie/irish-news/rss/"),
    ("The Journal", "https://www.thejournal.ie/feed/"),
    ("Breaking News Ireland", "https://www.breakingnews.ie/ireland/rss.xml"),
    ("Irish Examiner", "https://www.irishexaminer.com/rss/news.rss"),
    ("Irish Mirror", "https://www.irishmirror.ie/all-about/politics?service=rss"),
    ("Newstalk", "https://www.newstalk.com/podcasts/RSS"),
]

working_feeds = []
broken_feeds = []

for name, url in feeds_to_test:
    try:
        print(f"\n[Testing] {name}")
        print(f"   URL: {url}")
        
        # Test RSS feed
        feed = feedparser.parse(url)
        
        if not feed.entries:
            print(f"   [FAIL] No entries found")
            broken_feeds.append((name, url, "No entries"))
            continue
        
        entry_count = len(feed.entries)
        print(f"   [OK] Found {entry_count} entries")
        
        # Test if we can get a link
        if feed.entries[0].get('link'):
            test_url = feed.entries[0]['link']
            print(f"   [OK] Sample link: {test_url[:60]}...")
            
            # Quick test if link is accessible
            try:
                response = requests.head(test_url, timeout=5, allow_redirects=True)
                if response.status_code < 400:
                    print(f"   [OK] Link accessible (status {response.status_code})")
                    working_feeds.append((name, url, entry_count))
                else:
                    print(f"   [WARN] Link returns {response.status_code}")
                    working_feeds.append((name, url, entry_count))  # Still might work
            except Exception as e:
                print(f"   [WARN] Could not verify link: {str(e)[:50]}")
                working_feeds.append((name, url, entry_count))  # RSS works at least
        else:
            print(f"   [FAIL] No links in entries")
            broken_feeds.append((name, url, "No links"))
            
    except Exception as e:
        print(f"   [FAIL] {str(e)[:60]}")
        broken_feeds.append((name, url, str(e)[:60]))

print("\n" + "="*70)
print("\nSUMMARY:")
print(f"\n[OK] WORKING FEEDS ({len(working_feeds)}):")
for name, url, count in working_feeds:
    print(f"   - {name}: {count} articles")

print(f"\n[FAIL] BROKEN FEEDS ({len(broken_feeds)}):")
for name, url, reason in broken_feeds:
    print(f"   - {name}: {reason}")

print("\n" + "="*70)
print(f"\nTotal: {len(working_feeds)}/{len(feeds_to_test)} feeds working")

if len(working_feeds) < 3:
    print("\n[WARNING] Less than 3 working feeds!")
    print("   Consider using NewsAPI.org instead")

print()

