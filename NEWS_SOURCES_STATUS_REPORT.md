# News Sources Status Report

## Date: November 4, 2025
## Analysis Period: Last 30 Days

---

## ✅ WORKING SOURCES (7 Active)

### 1. 🥇 **The Journal** - TOP PERFORMER
- **Volume:** 18 articles (40 per fetch)
- **Scored:** 9 articles (50% hit rate)
- **TDs Affected:** 25 unique TDs
- **Total Impact:** 151 points
- **Type:** RSS Feed
- **Quality:** ⭐⭐⭐⭐⭐ EXCELLENT
- **Notes:** Highest volume + great political coverage

### 2. 🥈 **Irish Independent** - BEST SCORING RATE
- **Volume:** 14 articles (25 per fetch)
- **Scored:** 9 articles (64.3% hit rate) 🏆
- **TDs Affected:** 15 unique TDs
- **Total Impact:** 75 points
- **Type:** RSS Feed (with images!)
- **Quality:** ⭐⭐⭐⭐⭐ EXCELLENT
- **Notes:** Only source providing RSS images consistently

### 3. 🥉 **RTE News** - STATE BROADCASTER
- **Volume:** 10 articles (20 per fetch)
- **Scored:** 4 articles (40% hit rate)
- **TDs Affected:** 12 unique TDs
- **Total Impact:** 37 points
- **Type:** RSS Feed
- **Quality:** ⭐⭐⭐⭐ GOOD
- **Notes:** Reliable, balanced coverage

### 4. ✅ **Gript Media** - WEB SCRAPING (FIXED!)
- **Volume:** 4 articles (12 per fetch)
- **Scored:** 2 articles (50% hit rate)
- **TDs Affected:** 4 unique TDs
- **Total Impact:** 17 points
- **Type:** Custom Playwright Scraper
- **Quality:** ⭐⭐⭐⭐ GOOD
- **Status:** ✅ **JUST FIXED** - Now fetching full content + scoring properly
- **Recent Success:**
  - "Protest held outside Tusla offices" → Simon Harris scored
  - "SDCC to return to Court" → 3 TDs scored (Emer Higgins, Eoin Ó Broin, Shane Moynihan)

### 5. ✅ **Irish Mirror Politics**
- **Volume:** 2 articles
- **Scored:** 2 articles (100% hit rate!) 🎯
- **TDs Affected:** 8 unique TDs
- **Total Impact:** 43 points
- **Type:** RSS Feed (or manual scraping?)
- **Quality:** ⭐⭐⭐⭐⭐ EXCELLENT (small sample)
- **Notes:** Perfect scoring rate but low volume

### 6. ⚠️ **The Irish Times** - LOW VOLUME
- **Volume:** 3 articles (20 per fetch)
- **Scored:** 1 article (33.3% hit rate)
- **TDs Affected:** 1 TD
- **Total Impact:** 2 points
- **Type:** RSS Feed
- **Quality:** ⭐⭐ NEEDS IMPROVEMENT
- **Issue:** Very low article volume (only 3 in 30 days!)
- **Recommendation:** Check if there's a better politics-specific RSS feed

### 7. ⚠️ **Breaking News** (Disabled)
- **Volume:** 1 article
- **Scored:** 1 article
- **Status:** RSS feed returns 404 errors
- **Action:** Keep disabled, historical data only

---

## ❌ NOT WORKING SOURCES

### 1. **The Ditch** - CONTENT SCRAPER BROKEN
- **Volume:** 1 article
- **Scored:** 0 articles (0% hit rate)
- **Type:** Custom Playwright Scraper
- **Issue:** Content scraper returns only title (92 chars vs expected 3000+)
- **Quality:** ❌ BROKEN
- **URL Tested:** `https://www.ontheditch.com/ivan-yates-lobbied-government/`
- **Action Required:** Fix `ditchScraper.ts` content extraction selectors

### 2. **Business Post** - XML ERROR
- **Status:** DISABLED (RSS feed has malformed XML)
- **Action:** Keep disabled or implement custom scraper

### 3. **Noteworthy** - 404 ERROR
- **Status:** DISABLED (RSS feed returns 404)
- **Action:** Keep disabled

### 4. **Irish Legal News** - 404 ERROR
- **Status:** DISABLED (RSS feed returns 404)
- **Action:** Keep disabled

---

## 🔧 RECOMMENDED ACTIONS

### Priority 1: Fix The Ditch Scraper ❌
**Problem:** Content extraction not working (only gets title)

**Test Article:** https://www.ontheditch.com/ivan-yates-lobbied-government/

**Steps:**
1. Test The Ditch scraper manually
2. Update CSS selectors in `ditchScraper.ts`
3. Verify content extraction works
4. Re-scrape article and mark as unprocessed

### Priority 2: Improve Irish Times Coverage ⚠️
**Problem:** Only 3 articles in 30 days (should get 20 per fetch)

**Current RSS:** `https://www.irishtimes.com/cmlink/news-1.1319192`

**Potential Solutions:**
1. Check if there's a politics-specific RSS feed
2. Add Irish Times Politics: `https://www.irishtimes.com/politics/`
3. Consider web scraping if RSS insufficient

### Priority 3: Monitor Irish Examiner ✅
**Status:** Recently fixed (was 404, now working)
**Volume:** Getting 9 articles per fetch
**Action:** Monitor next scrape to ensure consistency

---

## 📈 Overall Health

### Active Sources: 7
- RSS Feeds: 5 working
- Web Scrapers: 2 (Gript ✅ working, Ditch ❌ broken)

### Success Metrics:
- **Total Articles/Month:** ~60-70
- **Scoring Rate:** 40-50% average
- **TD Coverage:** 60+ unique TDs affected
- **Total Impact:** 370+ points monthly

### Political Balance:
- ✅ Establishment sources: Irish Times, RTE (working)
- ✅ Mainstream: Independent, Journal (excellent)
- ✅ Critical/Right: Gript (now working!)
- ❌ Investigative/Left: The Ditch (broken)

**Balance Issue:** The Ditch (left-leaning investigative) is broken, while Gript (right-leaning) now works. Need to fix The Ditch for political balance!

---

## 🎯 Next Steps

1. **Immediate:** Fix The Ditch content scraper
2. **Short-term:** Find better Irish Times RSS feed or add web scraper
3. **Long-term:** Consider adding more sources:
   - Sunday Business Post (print edition)
   - Irish Examiner politics section
   - NewsTalk (radio transcripts)

---

## Test Commands

```bash
# Test The Ditch scraper
npx tsx -e "import('./server/services/customScrapers/ditchScraper.ts').then(m => m.DitchScraper.test())"

# Test Irish Times current coverage
curl "https://www.irishtimes.com/cmlink/news-1.1319192"

# Run full scrape to verify all sources
npx tsx test-scraper-sync.ts
```











