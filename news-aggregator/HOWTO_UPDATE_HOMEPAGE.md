# How to Update Homepage with Fresh Articles

## Quick Manual Update

### Step 1: Run the Aggregator
```bash
cd news-aggregator
python run_aggregator.py
```

This will:
- Fetch ~108 articles from 5 Irish news sources
- Filter to politically relevant articles
- Scrape and score them
- Save top 5 to `output/latest_irish_politics.json`

**Cost:** ~$0.10 per run

**Time:** ~2-3 minutes

---

### Step 2: Update the API Route

The aggregator saves articles to JSON, but you need to manually copy them to the API route:

1. Open `news-aggregator/output/latest_irish_politics.json`
2. Copy the top articles
3. Edit `server/routes/newsFeedRoutes.ts`
4. Replace the `realArticles` array with the new articles

**OR** just rerun the aggregator - it posts to the `/api/news-feed/save` endpoint automatically (though that's not wired up to the database yet due to connection issues).

---

## Current Articles on Homepage

**Last Updated:** 2025-10-25 at 11:22 AM

**Articles (all scored above 60):**

1. **Mary Lou McDonald canvassers threatened** - The Journal (91)
2. **Final Presidential Election debate** - Irish Mirror (91)
3. **TD office vandalized in Tipperary** - The Journal (90)
4. **Presidential race "Trumpiest" analysis** - Irish Mirror (87)
5. **Man arrested after assault on canvassers** - The Journal (86)

All articles are REAL from:
- The Journal
- Irish Mirror Politics
- RTE News
- Irish Times
- Irish Independent

---

## Automated Daily Updates (Optional)

### Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Name: "Glas Politics Daily News"
4. Trigger: Daily at 6:00 AM
5. Action: Start a program
   - Program: `python`
   - Arguments: `run_aggregator.py`
   - Start in: `C:\path\to\news-aggregator`

### Result

Every day at 6 AM:
- ✅ Fresh articles fetched automatically
- ✅ Saved to `output/latest_irish_politics.json`
- ⚠️ Still need to manually update API route (until database connection fixed)

---

## Once Database Works

When the Supabase connection is fixed:

1. Aggregator will save directly to `news_articles` table
2. API route will query the database instead of hardcoded array
3. Fully automated - no manual copying needed!

**Current blocker:** `SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature is missing` error

**Workaround:** Use MCP tools to interact with database, or manually update the API route after each aggregator run.

---

## Quick Commands

```bash
# Fetch fresh articles
cd news-aggregator && python run_aggregator.py

# Test just RSS feeds
python test_rss_feeds.py

# See what articles were found
cat output/latest_irish_politics.json
```

---

**Current Status:** Homepage showing 5 real Irish political articles from yesterday! ✅


