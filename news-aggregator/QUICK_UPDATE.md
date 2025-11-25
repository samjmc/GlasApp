# Quick Update Guide - Irish Political News

## To Update Homepage with Fresh Articles

### 1. Run the Aggregator (takes 2-3 minutes)
```bash
cd "C:\Users\samuel.mcdonnell\OneDrive - Real World Analytics\Documents\Glas Politics\Glas-Politics-main\news-aggregator"
python run_aggregator.py
```

This will:
- ✅ Fetch ~108 articles from 5 Irish news sources
- ✅ AI filter to ~5 politically relevant articles
- ✅ Scrape full content
- ✅ AI score each article (4 dimensions)
- ✅ Generate 5 custom DALL-E images (1792x1024 landscape)
- ✅ Save to `output/latest_irish_politics.json`

**Cost:** ~$0.30 (AI filtering + scoring + 5 images)

### 2. Copy Images to Public Folder
```powershell
Copy-Item "news-aggregator\output\images\*.png" "public\news-images\" -Force
```

### 3. The Server Will Automatically Pick Them Up
No restart needed! Just:
- Open `news-aggregator/output/latest_irish_politics.json`
- See what articles were found
- Manually update `server/routes/newsFeedRoutes.ts` if you want different articles

---

## Image Size Changed

**Old:** 1024x1024 (square) - didn't fit cards well  
**New:** 1792x1024 (wide landscape) - perfect for news cards!

Next time you run the aggregator, images will be the correct aspect ratio.

---

## Current Setup

**RSS Feeds Working:** 5 (Irish Times, RTE, Irish Independent, The Journal, Irish Mirror)  
**Articles Per Day:** ~108  
**Filtered To:** ~5 politically relevant  
**AI Images:** DALL-E 3 at 1792x1024  
**Cost:** $0.30/day = $9/month  

---

## Features Working

✅ Real Irish political news  
✅ AI filtering for relevance  
✅ AI scoring (4 dimensions)  
✅ Custom AI-generated images  
✅ 4-5 sentence summaries  
✅ Sort by Most Recent / Highest Scored  
✅ Instagram-style cards  
✅ Comments & engagement  
✅ TD impact tracking


