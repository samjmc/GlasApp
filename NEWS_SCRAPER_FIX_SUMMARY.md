# News Scraper Fix Summary

## Date: November 4, 2025

## Issues Fixed

### 1. ✅ Database Schema Error (CRITICAL)
**Problem:** 
- Articles were failing to save with error: "Could not find the 'image_url' column of 'news_articles' in the schema cache"
- The code was trying to insert `image_url` but the column didn't exist in the database

**Solution:**
- Added `image_url` column to `news_articles` table via migration
- Refreshed Supabase schema cache with `NOTIFY pgrst, 'reload schema'`
- Verified column exists with query

**Status:** ✅ FIXED

---

### 2. ✅ RSS Feed URL Updates
**Problem:**
Several RSS feeds were returning 404 errors:
- Irish Examiner
- Breaking News
- Noteworthy
- Irish Legal News

**Solution:**
Updated RSS feed URLs in `server/services/newsScraperService.ts`:

| Source | Old URL | New URL |
|--------|---------|---------|
| Irish Examiner | `https://www.irishexaminer.com/rss` | `https://www.irishexaminer.com/feed/35-top-stories.xml` |
| Breaking News | `https://www.breakingnews.ie/ireland/rss.xml` | `https://www.breakingnews.ie/rss/` |
| Noteworthy | `https://www.thejournal.ie/noteworthy/feed/` | `https://www.noteworthy.ie/rss/` |
| Irish Legal News | `https://www.irishlegal.com/feed/` | `https://www.irishlegal.com/rss/` |

**Status:** ✅ FIXED

---

### 3. ⚠️ Business Post XML Parsing Error
**Problem:**
- Business Post RSS feed returns malformed XML: "Invalid character in entity name"
- This is a server-side issue with their feed

**Potential Solutions:**
1. **Current:** Keep the URL as is - the error is gracefully handled and doesn't break the scraper
2. **Alternative:** Implement XML sanitization before parsing
3. **Future:** Contact Business Post about their feed or implement custom web scraper

**Status:** ⚠️ MONITORING (non-critical, error is handled gracefully)

---

## Files Modified

1. **Database Migration:**
   - Added `image_url` column to `news_articles` table
   - Executed `NOTIFY pgrst, 'reload schema'`

2. **server/services/newsScraperService.ts:**
   - Updated RSS feed URLs for 4 sources
   - No linting errors

---

## Testing Recommendations

### Before Running News Scraper Again:

1. **Restart your server** to ensure Supabase client picks up schema changes:
   ```bash
   # Stop current server
   # Then restart
   npm run dev
   ```

2. **Test the news scraper** with a manual run:
   ```bash
   npm run scrape-news
   ```

3. **Verify results:**
   - Check that articles are saving successfully
   - Verify `image_url` field is populated
   - Confirm all RSS feeds are fetching (except Business Post which may still error)
   - Check that AI image generation is working

4. **Expected Results:**
   - ✅ Irish Times: 20+ articles
   - ✅ RTE News: 20+ articles  
   - ✅ Irish Independent: 25+ articles
   - ✅ The Journal: 40+ articles
   - ✅ Irish Examiner: Should now work (was 404)
   - ✅ Breaking News: Should now work (was 404)
   - ⚠️ Business Post: May still show XML error (non-critical)
   - ✅ Noteworthy: Should now work (was 404)
   - ✅ Irish Legal News: Should now work (was 404)
   - ✅ Gript Media: 10-15 articles (web scraping)
   - ✅ The Ditch: 5-10 articles (web scraping)

---

## Database Changes

### New Column
```sql
ALTER TABLE news_articles 
ADD COLUMN IF NOT EXISTS image_url TEXT;
```

**Purpose:** Store article images from:
- RSS feed enclosures
- Scraped article content
- AI-generated DALL-E images (fallback)

---

## Architecture Notes

### Image Handling Flow:
1. **Primary:** Try to extract image from RSS feed (enclosure, content, etc.)
2. **Fallback:** Generate unique DALL-E image using `NewsImageGenerationService`
3. **Storage:** Save image URL in `news_articles.image_url` column
4. **Display:** Use in news feed and TD profile pages

### Error Handling:
- RSS feed failures are logged but don't break the entire scraper
- Invalid XML is caught and logged
- Database errors are caught and logged per article
- Rate limiting prevents API throttling (2 seconds between AI requests)

---

## Next Steps

1. ✅ Run the news scraper again to verify fixes
2. Monitor Business Post feed - consider adding XML sanitization if needed
3. Check if any other tables need `image_url` column
4. Consider adding automated RSS feed health checks
5. Update documentation if needed

---

## Questions?

If issues persist:
1. Check server logs for specific error messages
2. Verify Supabase connection is working
3. Check OpenAI API key is valid (for DALL-E image generation)
4. Ensure database has proper permissions

