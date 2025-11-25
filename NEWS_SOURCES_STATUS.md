# News Sources Status Summary

## ✅ Active RSS Feeds (5 sources)
- **The Irish Times** - Main establishment paper
- **RTE News** - State broadcaster
- **Irish Independent** - Major daily newspaper  
- **The Journal** - Independent news site (includes former Noteworthy content)
- **Irish Examiner** - Cork-based national newspaper

## 🤖 Custom Web Scrapers (3 sources)
These sources use Playwright browser automation instead of RSS feeds:

- **Gript Media** - Alternative/conservative perspective
  - `server/services/customScrapers/griptScraper.ts`
  
- **The Ditch** - Investigative journalism
  - `server/services/customScrapers/ditchScraper.ts`
  
- **Breaking News** ✨ **NEW** - General Irish news
  - RSS feed returns `404 Not Found`
  - `server/services/customScrapers/breakingNewsScraper.ts`

## ℹ️ Status of Previously Disabled Feeds

### Noteworthy
- **Status:** Merged into The Journal
- **Action:** No custom scraper needed - content already covered by The Journal RSS feed
- **Note:** Noteworthy.ie now redirects to `thejournal.ie/investigates/`

### Business Post
- **Status:** Paywall prevents full content extraction
- **Action:** Scraper built but not used - can fetch article titles but not full text needed for AI analysis
- **Note:** `businessPostScraper.ts` exists if paywall situation changes

### Irish Legal News  
- **Status:** RSS unavailable (404)
- **Action:** Not included - focuses on legal industry news (appointments, law firms) rather than political news
- **Note:** Could add custom scraper in future if political/legislative content becomes more relevant

## 📊 Total Coverage
- **8 active news sources** total (5 RSS + 3 custom scrapers)
- Covers: establishment, alternative, investigative, and general news perspectives
- All sources automatically integrated in the daily news scraper job

## 🔄 Integration
All custom scrapers are automatically called in `fetchAllIrishNews()` within:
- `server/services/newsScraperService.ts`
- `server/jobs/dailyNewsScraper.ts`

## 📝 Note
Business Post scraper (`businessPostScraper.ts`) exists but is not currently used due to paywall restrictions. Can be re-enabled if subscription/API access is obtained.

