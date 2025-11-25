# 📊 Database Management via MCP

## ✅ MCP Connection Working Perfectly

Your Supabase database is fully accessible via MCP tools. Use this instead of the node-postgres driver when needed.

## 🔧 Available MCP Commands

### Query Data:
```sql
-- Get all TD scores
SELECT * FROM td_scores ORDER BY overall_elo DESC LIMIT 10;

-- Get recent news articles
SELECT * FROM news_articles ORDER BY published_date DESC LIMIT 10;

-- Get news sources
SELECT * FROM news_sources WHERE scraping_enabled = true;
```

### Insert Data:
```sql
-- Add a TD score
INSERT INTO td_scores (politician_name, constituency, party, overall_elo)
VALUES ('Example TD', 'Dublin Central', 'Fianna Fáil', 1500);

-- Add a news article (manually)
INSERT INTO news_articles (url, title, content, source, published_date, politician_name)
VALUES ('https://example.com', 'Test Article', 'Content...', 'Irish Times', NOW(), 'Example TD');
```

### Migrations:
All schema changes applied successfully. Tables created:
- news_articles
- td_scores  
- td_score_history
- news_sources (with 6 Irish outlets pre-loaded)
- scraping_jobs

## 💡 Why Use MCP

**Your Node app** has connection issues due to password authentication format.

**MCP** connects perfectly and can:
- ✅ Run queries
- ✅ Apply migrations
- ✅ Insert/update data
- ✅ Check logs
- ✅ Get advisories

**For development:** Use MCP for database operations until the NODE driver connection is fixed.

## 🎯 Database Summary

- **Project:** ospxqnxlotakujloltqy
- **Region:** EU West 1
- **Tables:** 39 total
- **Connection:** MCP working, node-postgres has auth issue
- **Status:** Fully operational via MCP

## 📝 Never Ask Again

All future database operations will use MCP tools without asking for credentials.



