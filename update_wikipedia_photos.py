#!/usr/bin/env python3
"""
Fetch and update Wikipedia profile photos for all Irish TDs
"""

import requests
import time
import sys

# Use MCP proxy
SUPABASE_URL = "http://localhost:54321"  # MCP proxy URL if available

tds = [
    # Sample batch - we'll do a few manually first to test
    {"id": 4, "name": "Mary Lou McDonald"},
    {"id": 1, "name": "Jack Chambers"},
    {"id": 143, "name": "Simon Harris"},
    {"id": 169, "name": "Micheál Martin"},
    {"id": 2, "name": "Roderic O'Gorman"},
    {"id": 67, "name": "Holly Cairns"},
    {"id": 19, "name": "Ivana Bacik"},
    {"id": 113, "name": "Pearse Doherty"},
    {"id": 24, "name": "Richard Boyd Barrett"},
    {"id": 247, "name": "Peadar Tóibín"}
]

def search_wikipedia(td_name):
    """Search Wikipedia for a politician's page"""
    try:
        clean_name = td_name.strip()
        
        url = "https://en.wikipedia.org/w/api.php"
        params = {
            'action': 'query',
            'list': 'search',
            'srsearch': f'{clean_name} Irish politician TD',
            'format': 'json',
            'utf8': 1
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if not data.get('query', {}).get('search'):
            print(f"  ⚠️  No Wikipedia page found for {td_name}")
            return None
        
        title = data['query']['search'][0]['title']
        return title
    except Exception as e:
        print(f"  ❌ Error searching Wikipedia for {td_name}: {e}")
        return None

def get_wikipedia_image(page_title):
    """Get the main image from a Wikipedia page"""
    try:
        url = "https://en.wikipedia.org/w/api.php"
        params = {
            'action': 'query',
            'titles': page_title,
            'prop': 'pageimages',
            'pithumbsize': 500,
            'format': 'json',
            'utf8': 1
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        pages = data.get('query', {}).get('pages', {})
        page_id = list(pages.keys())[0]
        
        if page_id == '-1':
            print(f"  ⚠️  Page not found: {page_title}")
            return None
        
        page = pages[page_id]
        
        if 'thumbnail' not in page:
            print(f"  ⚠️  No image found for {page_title}")
            return None
        
        return page['thumbnail']['source']
    except Exception as e:
        print(f"  ❌ Error fetching image for {page_title}: {e}")
        return None

def main():
    print("🔍 Fetching Wikipedia images for Irish TDs...\n")
    
    results = []
    
    for i, td in enumerate(tds):
        print(f"[{i + 1}/{len(tds)}] Processing: {td['name']}")
        
        # Search for Wikipedia page
        wiki_title = search_wikipedia(td['name'])
        if not wiki_title:
            results.append({
                'id': td['id'],
                'name': td['name'],
                'wikipedia_title': None,
                'image_url': None
            })
            print()
            continue
        
        print(f"  📖 Found: {wiki_title}")
        
        # Get image URL
        image_url = get_wikipedia_image(wiki_title)
        
        if image_url:
            print(f"  ✅ Image: {image_url[:60]}...")
            results.append({
                'id': td['id'],
                'name': td['name'],
                'wikipedia_title': wiki_title,
                'image_url': image_url
            })
        else:
            results.append({
                'id': td['id'],
                'name': td['name'],
                'wikipedia_title': wiki_title,
                'image_url': None
            })
        
        print()
        time.sleep(0.5)  # Be respectful to Wikipedia's API
    
    print("\n" + "=" * 50)
    print("📊 Results Summary:")
    print("=" * 50)
    
    print("\nSQL UPDATE statements:\n")
    for result in results:
        if result['image_url']:
            wiki_title_escaped = result['wikipedia_title'].replace("'", "''")
            image_url_escaped = result['image_url'].replace("'", "''")
            print(f"UPDATE td_scores SET ")
            print(f"  wikipedia_title = '{wiki_title_escaped}',")
            print(f"  image_url = '{image_url_escaped}',")
            print(f"  has_profile_image = true")
            print(f"WHERE id = {result['id']};")
            print()

if __name__ == "__main__":
    main()

