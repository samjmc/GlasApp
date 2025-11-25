# Disabled RSS Feeds - Status & Recommendations

## Date: November 4, 2025

---

## 🔴 Currently Disabled Feeds (4)

### 1. **Breaking News** (breakingnews.ie)
- **RSS URL Tested:** `https://www.breakingnews.ie/rss/`
- **Status:** 404 Not Found
- **Reason:** RSS feed no longer exists
- **Website Status:** Unknown (domain may be down)
- **Recommendation:** ❌ **Keep disabled** - feed doesn't exist
- **Alternative:** None needed (covered by other sources)

---

### 2. **Business Post** (businesspost.ie)
- **RSS URL Tested:** `https://www.businesspost.ie/feed/`
- **Status:** **403 Forbidden** (blocked)
- **Reason:** RSS feed is blocked/protected (possibly subscriber-only)
- **Website Status:** ✅ Website is LIVE and active
- **Political Coverage:** HIGH (business + politics focus)
- **Credibility:** 0.88 (strong investigative)
- **Bias:** -0.05 (critical of government spending)
- **Recommendation:** ⚠️ **CREATE CUSTOM SCRAPER**

**Why We Need It:**
- Critical/investigative source (counter-balance to establishment media)
- Strong political coverage
- Website is accessible (just RSS blocked)

**Next Steps:**
1. Create `businessPostScraper.ts` using Playwright
2. Scrape politics section: `https://www.businesspost.ie/news/politics/`
3. Add to custom scrapers alongside Gript & Ditch

---

### 3. **Noteworthy** (noteworthy.ie)
- **RSS URL Tested:** `https://www.noteworthy.ie/rss/`
- **Status:** 404 Not Found
- **Reason:** RSS feed doesn't exist at this URL
- **Credibility:** 0.92 (investigative journalism)
- **Type:** Investigative, non-partisan
- **Recommendation:** 🔍 **INVESTIGATE ALTERNATIVES**

**Potential Solutions:**
1. Check if Noteworthy has moved to a different domain
2. Look for alternative RSS feed URLs
3. Noteworthy is part of TheJournal.ie - may have separate feed
4. Consider web scraping if RSS unavailable

**Action:** Test `https://www.thejournal.ie/noteworthy/` for scraping

---

### 4. **Irish Legal News** (irishlegal.com)
- **RSS URL Tested:** `https://www.irishlegal.com/rss/`
- **Status:** 404 Not Found
- **Reason:** RSS feed doesn't exist
- **Coverage:** Legal/tribunal coverage
- **Credibility:** 0.85
- **Recommendation:** ⚠️ **LOW PRIORITY**

**Why Low Priority:**
- Legal news is niche (less TD impact)
- Other sources cover tribunal/legal issues
- Limited political relevance

**Action:** Keep disabled unless specific legal coverage needed

---

## 📊 Impact on Coverage

### Current Working Sources: 7
1. The Journal (50% scoring rate, 151 impact)
2. Irish Independent (64% scoring rate, 75 impact) 
3. RTE News (40% scoring rate, 37 impact)
4. Gript Media (50% scoring rate, 17 impact) ✅ Fixed
5. The Ditch (100% scoring rate, 139 impact!) ✅ Fixed
6. Irish Mirror (100% scoring rate, 43 impact)
7. Irish Examiner (recently fixed, monitoring)

### Missing Coverage from Disabled Feeds:
- **Business Post**: Critical/investigative perspective (right-leaning economics)
- **Noteworthy**: Deep investigative journalism
- **Irish Legal News**: Tribunal coverage
- **Breaking News**: General news (not essential)

### Balance Analysis:
- ✅ Establishment sources: Irish Times, RTE, Independent
- ✅ Balanced: The Journal, Examiner
- ✅ Critical/Right: Gript ✅
- ✅ Investigative/Left: The Ditch ✅
- ❌ **Missing:** Business Post (critical economic coverage)

---

## 🎯 Priority Actions

### High Priority: Business Post Scraper
**Rationale:**
- Only major critical/business-focused source missing
- Active website with regular political content
- Would improve source diversity
- RSS blocked but scrapable

**Implementation Plan:**
```typescript
// server/services/customScrapers/businessPostScraper.ts

export async function scrapeBusinessPostLatestArticles() {
  // Scrape https://www.businesspost.ie/news/politics/
  // or https://www.businesspost.ie/latest/
}

export async function scrapeBusinessPostArticleContent(url: string) {
  // Scrape full article text
}
```

**Estimated Effort:** 2-3 hours
**Expected Return:** 5-10 articles/week with business + political angle

---

### Medium Priority: Noteworthy Investigation
**Options:**
1. Check if part of TheJournal.ie feeds
2. Look for alternative Noteworthy RSS
3. Create scraper if no RSS available

**Estimated Effort:** 1-2 hours investigation
**Expected Return:** 2-5 investigative articles/month

---

### Low Priority: Irish Legal News
**Recommendation:** Keep disabled unless tribunal coverage becomes important

---

## 📈 Current Coverage Assessment

### Sufficient?
**YES** - Current 7 sources provide:
- 130+ articles per scrape
- 15-20 political articles per day
- Good political balance (left/center/right)
- Mix of establishment + critical sources

### Worth Adding Business Post?
**YES** - Would add:
- Critical business/economics perspective
- Investigation into government spending
- Additional counter-balance to establishment
- More diverse opinion spectrum

### Worth Adding Noteworthy?
**MAYBE** - Depends on:
- How much effort to implement
- If TheJournal.ie already covers their stories
- Need for deep investigative pieces

---

## 🔧 Recommendation Summary

| Source | Action | Priority | Effort | Value |
|--------|--------|----------|--------|-------|
| **Business Post** | Create custom scraper | 🔴 HIGH | Medium | HIGH |
| **Noteworthy** | Investigate alternatives | 🟡 MEDIUM | Low | MEDIUM |
| **Irish Legal News** | Keep disabled | 🟢 LOW | N/A | LOW |
| **Breaking News** | Keep disabled | 🟢 LOW | N/A | NONE |

---

## ✅ System Status

**Current State:** Fully operational with 7 working sources

**Next Steps (Optional):**
1. Implement Business Post scraper for additional critical coverage
2. Investigate Noteworthy alternatives
3. Monitor current sources for consistency

**No Urgent Action Required** - System is working well with current sources!











