# 🎯 Automatic TD Scoring from News Articles - Implementation Options

## 📊 Current System Analysis

### What You Have Built:

#### ✅ **News Aggregation System** (Python - `news-aggregator/`)
- Fetches articles from RSS feeds
- Filters for political relevance using AI
- Generates AI summaries and images
- Scores articles (85-92/100)
- **Saves to database** (`news_articles` table)

#### ✅ **TD Scoring System** (TypeScript - `server/`)
- **ELO scoring service** (`eloScoringService.ts`) - Already built!
- **5-dimensional scores**: Transparency, Effectiveness, Integrity, Consistency, Service
- **Party aggregate calculation** (`calculate-party-aggregate-scores.ts`)
- Database tables: `td_scores`, `td_score_history`, `party_performance_scores`

#### ❌ **The Missing Link:**
**News articles are being saved BUT TDs are NOT being extracted/scored from them automatically**

---

## 🔍 Current News Article Structure

Your news aggregator currently saves articles with:
```json
{
  "url": "...",
  "title": "Asylum-seekers working here will face bill of up to €238 a week",
  "content": "...",
  "source": "Irish Independent",
  "published_date": "2025-11-03",
  "ai_summary": "Recent developments...",
  "impact_score": 87.2,
  "score_breakdown": {
    "political_relevance": 90,
    "impact": 85,
    "timeliness": 88,
    "irish_relevance": 95,
    "mentions_td": false,  // ⚠️ NOT BEING DETECTED!
    "td_name": null        // ⚠️ NOT BEING EXTRACTED!
  }
}
```

**Problem**: `mentions_td` is always `false` because TD extraction is not happening!

---

## 🎯 Implementation Options

### **Option 1: Integrate TD Extraction into Python Aggregator** (Recommended)
**Location**: `news-aggregator/`  
**Language**: Python  
**Complexity**: Medium

#### What This Involves:
1. Create new Python module: `td_mention_extractor.py`
2. Add TD name list (all 174 TDs)
3. Search article content for TD mentions
4. Extract impact scores for each TD mentioned
5. Save to `news_articles` table with TD data populated

#### Pros:
- ✅ Everything in one place
- ✅ Real-time extraction during aggregation
- ✅ Python is fast for text processing
- ✅ Can reuse OpenAI client for TD analysis

#### Cons:
- ❌ Need to maintain TD list in Python
- ❌ Slightly longer aggregation time

#### Implementation:
```python
# news-aggregator/td_mention_extractor.py

class TDMentionExtractor:
    def __init__(self, openai_client):
        self.client = openai_client
        self.tds = self.load_td_list()  # From Supabase
    
    def extract_tds_from_article(self, article):
        """
        Searches article for TD mentions and scores impact
        """
        # 1. Search for TD names in content
        mentioned_tds = []
        for td in self.tds:
            if self.is_mentioned(td['name'], article['content']):
                mentioned_tds.append(td)
        
        if not mentioned_tds:
            return None
        
        # 2. Use AI to analyze impact for each TD
        for td in mentioned_tds:
            impact_analysis = self.analyze_td_impact(
                td_name=td['name'],
                article_content=article['content'],
                article_title=article['title']
            )
            
            # Returns: {
            #   "transparency_impact": -5,
            #   "integrity_impact": -8,
            #   "overall_impact": -6,
            #   "sentiment": "negative",
            #   "story_type": "scandal"
            # }
        
        return mentioned_tds
```

---

### **Option 2: Create Post-Processing Service** (Existing Server)
**Location**: `server/services/`  
**Language**: TypeScript  
**Complexity**: Low

#### What This Involves:
1. Create: `server/services/newsToTDScoringService.ts`
2. Runs periodically (every hour or daily)
3. Fetches unprocessed articles from `news_articles`
4. Extracts TD mentions using existing service
5. Calls existing ELO scoring service
6. Updates `td_scores` and `td_score_history`

#### Pros:
- ✅ Reuses existing TypeScript services
- ✅ Separates concerns (aggregation vs scoring)
- ✅ Can reprocess old articles if needed
- ✅ Easier to debug/maintain

#### Cons:
- ❌ Delay between article save and TD score update
- ❌ Requires scheduler/cron job

#### Implementation:
```typescript
// server/services/newsToTDScoringService.ts

export class NewsToTDScoringService {
  async processUnprocessedArticles() {
    // 1. Get articles where processed = false
    const articles = await supabase
      .from('news_articles')
      .select('*')
      .eq('processed', false)
      .limit(50);
    
    for (const article of articles) {
      // 2. Extract TD mentions
      const tdMentions = await tdExtractionService.extractTDs(article);
      
      // 3. For each TD mentioned
      for (const mention of tdMentions) {
        // 4. Analyze impact
        const analysis = await aiNewsAnalysisService.analyze(
          article,
          mention.td_name
        );
        
        // 5. Update TD scores
        const currentScores = await this.getTDScores(mention.td_name);
        const { updated, changes } = eloScoringService.updateTDScores(
          currentScores,
          analysis,
          article.credibility_score
        );
        
        // 6. Save updates
        await this.saveTDScores(mention.td_name, updated, changes, article);
      }
      
      // 7. Mark article as processed
      await supabase
        .from('news_articles')
        .update({ processed: true })
        .eq('id', article.id);
    }
    
    // 8. Recalculate party aggregates
    await this.recalculatePartyScores();
  }
}
```

---

### **Option 3: Hybrid Approach** (Best of Both)
**Combines both options**  
**Complexity**: High

#### What This Involves:
1. **Python**: Quick TD name detection (simple string matching)
2. **TypeScript**: Deep analysis and scoring (using existing services)

#### Flow:
```
Python Aggregator
  ↓
1. Fetch & filter articles
2. Quick TD mention detection (string match)
3. Save article with td_name field populated
  ↓
TypeScript Service (runs hourly)
  ↓
4. Process articles with td_name populated
5. Deep AI analysis for impact scoring
6. Update ELO scores
7. Update party aggregates
```

#### Pros:
- ✅ Fast initial detection (Python)
- ✅ Accurate scoring (TypeScript + existing services)
- ✅ Best of both worlds

#### Cons:
- ❌ Most complex to implement
- ❌ Two systems to maintain

---

## 💡 Recommended Approach: **Option 2** (Post-Processing)

### Why Option 2 is Best:

1. **Reuses existing code**:
   - ✅ `eloScoringService.ts` (already built!)
   - ✅ `aiNewsAnalysisService.ts` (already exists!)
   - ✅ `tdExtractionService.ts` (exists!)

2. **Clean separation**:
   - Python: Fast article aggregation (no AI delay)
   - TypeScript: Deep TD analysis (using your existing services)

3. **Easy to test**:
   - Can run manually
   - Can reprocess articles
   - Can adjust scoring logic without touching aggregator

4. **Scalable**:
   - Process 50 articles at a time
   - Can run multiple times per day
   - Won't slow down news aggregation

---

## 🚀 Implementation Plan (Option 2)

### Phase 1: Create TD Scoring Service (2-3 hours)

```typescript
// server/services/newsToTDScoringService.ts
// - Extract TD mentions from articles
// - Analyze impact using AI
// - Update TD ELO scores
// - Log changes to td_score_history
```

### Phase 2: Create Scheduler Job (1 hour)

```typescript
// server/jobs/hourlyTDScoring.ts
// - Runs every hour (or daily)
// - Calls NewsToTDScoringService
// - Processes unprocessed articles
// - Updates party aggregates
```

### Phase 3: Update Python Aggregator (30 mins)

```python
# news-aggregator/irish_politics_aggregator.py
# - Just save articles (no TD extraction yet)
# - Set processed = false
# - Let TypeScript service handle TD scoring
```

### Phase 4: Test & Deploy (1 hour)

```bash
# 1. Run Python aggregator (gets articles)
cd news-aggregator
py run_aggregator.py

# 2. Run TD scoring service (processes them)
npx tsx server/jobs/hourlyTDScoring.ts

# 3. Check results
- TD scores updated?
- Party scores updated?
- td_score_history logged?
```

---

## 📊 What Gets Updated

### When News Article is Processed:

1. **`news_articles` table**:
   ```sql
   UPDATE news_articles SET
     politician_name = 'Simon Harris',
     party = 'Fine Gael',
     story_type = 'scandal',
     sentiment = 'negative',
     impact_score = -7,
     transparency_impact = -5,
     integrity_impact = -9,
     processed = true,
     score_applied = true
   ```

2. **`td_scores` table**:
   ```sql
   UPDATE td_scores SET
     overall_elo = overall_elo + (-22),  -- ELO change
     transparency_elo = transparency_elo + (-16),
     integrity_elo = integrity_elo + (-29),
     total_stories = total_stories + 1,
     negative_stories = negative_stories + 1,
     last_updated = NOW()
   WHERE politician_name = 'Simon Harris'
   ```

3. **`td_score_history` table**:
   ```sql
   INSERT INTO td_score_history (
     politician_name,
     article_id,
     old_overall_elo,
     new_overall_elo,
     elo_change,
     dimension_affected,
     impact_score,
     story_type,
     article_url,
     article_title
   ) VALUES (...)
   ```

4. **`party_performance_scores` table**:
   ```sql
   UPDATE party_performance_scores SET
     overall_score = (average of all Fine Gael TD scores),
     transparency_score = (average transparency),
     integrity_score = (average integrity)
   WHERE party_id = (Fine Gael ID)
   ```

---

## 💰 Cost Estimate

### Option 2 (Post-Processing):
- **Article fetch**: $0 (already happening)
- **TD extraction**: $0 (string matching)
- **AI impact analysis**: $0.02 per TD-article pair
  - Average: 1-2 TDs per article
  - 8 articles/day × 1.5 TDs = 12 analyses
  - **Cost**: $0.24/day = $7.20/month

### Total Monthly Cost:
- News aggregation: $15-30
- TD scoring: $7.20
- **Total**: ~$22-37/month ✅

---

## 🎯 Next Steps

1. **Review Options** - Which appeals to you?
2. **I'll Implement** - Can build Option 2 right now
3. **Test with Real Data** - Process existing news articles
4. **Deploy Scheduler** - Auto-update TD scores daily

---

## 📝 Example Flow (Option 2)

### Morning (8 AM) - Python Runs:
```
✅ Fetched 105 articles
✅ Filtered 8 political articles
✅ Scored & saved to database
✅ Generated images
✅ Set processed = false
```

### Hourly (9 AM, 10 AM, etc.) - TypeScript Runs:
```
🔍 Found 8 unprocessed articles
📰 Article 1: "Simon Harris under fire for..."
   ├─ TDs mentioned: Simon Harris (Fine Gael)
   ├─ Impact: -7 overall, -9 integrity
   ├─ Updated ELO: 1580 → 1558 (-22)
   └─ ✅ Logged to td_score_history

📰 Article 2: "Michael Moynihan absence..."
   ├─ TDs mentioned: Michael Moynihan (FF)
   ├─ Impact: -5 effectiveness
   └─ ✅ Updated

... (6 more articles)

🏛️ Recalculating party aggregates...
   ├─ Fine Gael: 74/100 → 73/100 (-1)
   └─ Fianna Fáil: 71/100 → 70/100 (-1)

✅ Complete! 8 articles processed, 12 TDs updated
```

---

**Ready to implement? I recommend Option 2. Want me to build it now?** 🚀























