# 📰 Irish Political News Aggregator

Automated news aggregation system for Glas Politics. Fetches, filters, scores, and posts Irish political news to the homepage daily.

---

## 🚀 Quick Start

### 1. Install Python Dependencies

```bash
cd news-aggregator
pip install -r requirements.txt
```

### 2. Set Environment Variables

Create `.env` file in this directory:

```env
OPENAI_API_KEY=sk-your-openai-key-here
API_URL=http://localhost:5000/api
```

### 3. Run Manually

```bash
python run_aggregator.py
```

### 4. Schedule Daily (6 AM)

**Windows (Task Scheduler):**
1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Daily at 6:00 AM
4. Action: Start a program
5. Program: `python`
6. Arguments: `C:\path\to\news-aggregator\run_aggregator.py`

**Linux/Mac (cron):**
```bash
0 6 * * * cd /path/to/news-aggregator && python run_aggregator.py
```

---

## 📊 What It Does

```
6:00 AM Daily:
  1. Fetches RSS feeds (7 Irish news sources)
  2. Filters for political relevance (AI)
  3. Scrapes full article content (top 30)
  4. Scores each article (AI - 4 dimensions)
  5. Selects top 5 articles
  6. Saves to Supabase database
  7. Homepage updates automatically
```

---

## 🔧 Configuration

Edit `config_irish_politics.yaml`:

### Add More News Sources:
```yaml
rss_feeds:
  - url: "https://example.com/rss"
    name: "Source Name"
```

### Adjust Scoring:
```yaml
scoring:
  model: "gpt-4o-mini"  # or "gpt-4" for better quality
  temperature: 0.2
```

### Change Top Articles Count:
```yaml
output:
  top_articles_count: 10  # Show top 10 instead of 5
```

---

## 💰 Costs

**Per Daily Run:**
- RSS Fetching: Free
- AI Filtering: ~$0.05 (gpt-4o-mini on 200 articles)
- Content Scraping: Free
- AI Scoring: ~$0.30 (gpt-4o-mini on 30 articles)

**Total: ~$0.35/day = $10.50/month**

**To reduce costs:**
- Use gpt-3.5-turbo instead of gpt-4o-mini
- Reduce number of articles scraped
- Skip filtering step (use keyword matching)

---

## 📁 Output

### JSON Files (backup):
- `output/latest_irish_politics.json` - Most recent run
- `output/irish_politics_top_articles_YYYYMMDD_HHMMSS.json` - Historical

### Database:
Articles saved to `news_articles` table in Supabase

### Homepage:
Top 5 articles appear on homepage automatically

---

## 🔍 Troubleshooting

### "OPENAI_API_KEY not set"
- Create `.env` file with your API key
- Or set environment variable manually

### "Failed to scrape article"
- Some sites block scraping
- Articles still get scored using RSS summary
- Not all articles will scrape successfully (expected)

### "No articles found"
- Check RSS feed URLs are still valid
- Verify internet connection
- Check if sites changed their RSS format

### "API connection failed"
- Make sure Glas Politics backend is running
- Verify API_URL in `.env` is correct
- Articles still saved to JSON even if API fails

---

## 🎯 Integration with Glas Politics

The aggregator sends articles to:
```
POST /api/news-feed/save
```

With data:
```json
{
  "url": "https://...",
  "title": "Article title",
  "content": "Full content...",
  "source": "Irish Times",
  "published_date": "2025-10-25T06:00:00",
  "ai_summary": "AI-generated summary",
  "impact_score": 85,
  "score_breakdown": {...},
  "td_name": "Micheál Martin",
  "party": "Fianna Fáil"
}
```

---

## 📅 Recommended Schedule

**Development:** Run manually as needed

**Production:**
- **Daily at 6:00 AM Irish time** - Main aggregation
- **Optional: 6:00 PM** - Evening update for breaking news

---

## ✅ System Health

Check logs for:
- ✅ "DAILY NEWS AGGREGATION COMPLETE"
- ✅ "Saved X articles to database"
- ❌ Any errors or warnings

---

## 🎉 You're Ready!

1. Install dependencies: `pip install -r requirements.txt`
2. Set OPENAI_API_KEY in `.env`
3. Run: `python run_aggregator.py`
4. Check homepage for articles!

---

**Last Updated:** October 24, 2025  
**Status:** Ready for production use


