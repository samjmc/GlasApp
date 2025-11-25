import json

with open('output/latest_irish_politics.json', encoding='utf-8') as f:
    data = json.load(f)

print("\nEXTRACTED IMAGES FROM REAL ARTICLES:\n")
print("="*70)

for i, article in enumerate(data['top_articles'], 1):
    title = article['title'][:60]
    image = article.get('scraped_content', {}).get('top_image', 'None')
    print(f"\n{i}. {title}...")
    print(f"   Image: {image}")


