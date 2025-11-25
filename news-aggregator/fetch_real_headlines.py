#!/usr/bin/env python3
"""
Quick script to fetch REAL Irish political headlines from today
No AI needed - just raw RSS feeds
"""

import feedparser
from datetime import datetime, timedelta
import json

print("\n*** Fetching REAL Irish Political Headlines from RSS Feeds...")
print("="*70)

feeds = [
    ("Irish Times", "https://www.irishtimes.com/cmlink/news-1.1319192"),
    ("RTE News", "https://www.rte.ie/rss/news.xml"),
    ("The Journal", "https://www.thejournal.ie/feed/"),
    ("Irish Independent", "https://www.independent.ie/irish-news/rss/"),
]

all_articles = []
cutoff = datetime.now() - timedelta(hours=24)

for source_name, url in feeds:
    try:
        print(f"\n[*] Fetching from {source_name}...")
        feed = feedparser.parse(url)
        
        count = 0
        for entry in feed.entries[:10]:  # Get first 10 from each source
            title = entry.get('title', 'No title')
            link = entry.get('link', '')
            published = entry.get('published', '')
            summary = entry.get('summary', entry.get('description', ''))
            
            # Simple political keyword filter
            text = (title + ' ' + summary).lower()
            political_keywords = ['td', 'dail', 'government', 'minister', 
                                'taoiseach', 'politics', 'election', 'sinn fein',
                                'fianna fail', 'fine gael', 'budget', 'coalition']
            
            if any(keyword in text for keyword in political_keywords):
                all_articles.append({
                    'source': source_name,
                    'title': title,
                    'link': link,
                    'published': published,
                    'summary': summary[:200]
                })
                count += 1
        
        print(f"   [OK] Found {count} political articles")
        
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")

print(f"\nTOTAL: {len(all_articles)} political articles from last 24 hours\n")
print("="*70)
print("\nTOP HEADLINES:\n")

for i, article in enumerate(all_articles[:10], 1):
    print(f"{i}. [{article['source']}] {article['title']}")
    if article.get('published'):
        print(f"   Published: {article['published']}")
    print(f"   Link: {article['link'][:80]}...")
    print()

# Save to JSON
with open('output/real_headlines_today.json', 'w', encoding='utf-8') as f:
    json.dump({
        'fetched_at': datetime.now().isoformat(),
        'total': len(all_articles),
        'articles': all_articles[:20]
    }, f, indent=2, ensure_ascii=False)

print(f"[SAVED] output/real_headlines_today.json")
print(f"\n[DONE] These are REAL headlines from Irish news sources TODAY!\n")

