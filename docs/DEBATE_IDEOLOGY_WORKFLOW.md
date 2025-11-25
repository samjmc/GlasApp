# Debate Ideology System: Complete Workflow

## ✅ Yes, It Will Work Functionally Well!

**Current Status:**
- ✅ **27,492 speeches** in database (up to November 12, 2025)
- ✅ **27,088 votes** in database (up to November 21, 2025)
- ✅ **System is fully implemented** and ready
- ⚠️ **Latest debates in DB:** November 12, 2025 (8 days behind today)

## Complete Workflow (Nov 20, 2025)

### Step 1: Fetch Latest Debates (If Needed)

If you need debates from Nov 12-20, run:

```bash
# Option 1: Incremental update (recommended)
npx tsx scripts/update-debates-incremental.ts

# Option 2: Fetch specific week
npx tsx scripts/fetch-oireachtas-debate-week.ts
```

This will:
- Fetch new debates from Oireachtas API since Nov 12
- Extract speeches and save to `debate_speeches` table
- Extract sections and save to `debate_sections` table

### Step 2: Fetch Latest Votes (If Needed)

```bash
npm run fetch-votes
```

This will:
- Fetch new votes since last update (or last 7 days)
- Extract individual TD votes
- Calculate party loyalty
- Save to `td_votes` table

### Step 3: Process Debates & Votes for Ideology Analysis

```bash
npm run debate-ideology
```

This will:
- Find all unprocessed speeches in `debate_speeches` table
- Find all unprocessed votes in `td_votes` table
- Analyze each with LLM to extract ideology deltas
- Apply all political science enhancements:
  - Voting records = 2.5× weight (gold standard)
  - Party discipline detection
  - Rhetorical vs substantive classification
  - Issue salience weighting
  - Consistency tracking
  - Government vs opposition context
- Update TD ideology profiles in `td_ideology_profiles` table
- Save analysis to `debate_ideology_analysis` table
- Save history to `debate_ideology_history` table

## What Happens When You Fetch Debates Today (Nov 20)

### Scenario 1: Fetch Debates from Nov 12-20

1. **Run debate fetcher:**
   ```bash
   npx tsx scripts/update-debates-incremental.ts
   ```
   
2. **Result:**
   - Fetches debates from Nov 12-20 from Oireachtas API
   - Extracts speeches and saves to `debate_speeches` table
   - New speeches will have `id`, `speaker_name`, `speaker_party`, `paragraphs`, etc.

3. **Run ideology processor:**
   ```bash
   npm run debate-ideology
   ```
   
4. **Result:**
   - Processor queries: `SELECT id FROM debate_speeches WHERE id NOT IN (SELECT speech_id FROM debate_ideology_analysis)`
   - Finds all new speeches (Nov 12-20)
   - Processes each speech:
     - Fetches speech data from `debate_speeches`
     - Analyzes with LLM
     - Applies all enhancements
     - Updates TD ideology profiles
     - Saves to analysis table

### Scenario 2: Already Have Debates in DB

If debates from Nov 12-20 are already in `debate_speeches`:

1. **Just run processor:**
   ```bash
   npm run debate-ideology
   ```
   
2. **It will automatically:**
   - Find all unprocessed speeches (including Nov 12-20)
   - Process them incrementally
   - Update TD ideology profiles

## System Architecture

### Data Flow:

```
Oireachtas API
    ↓
[Debate Fetcher Scripts]
    ↓
debate_speeches table (27,492 speeches)
debate_sections table
td_votes table (27,088 votes)
    ↓
[Debate Ideology Processor]
    ↓
[LLM Analysis + Enhancements]
    ↓
td_ideology_profiles (updated)
debate_ideology_analysis (analysis results)
debate_ideology_history (consistency tracking)
```

### Processing Logic:

```typescript
// 1. Find unprocessed speeches
const unprocessed = await supabase
  .from('debate_speeches')
  .select('id')
  .not('id', 'in', analyzedSpeechIds)
  .limit(50);

// 2. Process each speech
for (const speech of unprocessed) {
  await analyzeDebateSpeech(speech.id);
  // - Fetches speech from debate_speeches
  // - Analyzes with LLM
  // - Applies enhancements
  // - Updates TD ideology profile
  // - Saves to debate_ideology_analysis
}

// 3. Find unprocessed votes
const unprocessedVotes = await supabase
  .from('td_votes')
  .select('id')
  .not('id', 'in', analyzedVoteIds)
  .limit(50);

// 4. Process each vote (gold standard)
for (const vote of unprocessedVotes) {
  await analyzeVoteRecord(vote.id);
  // - Fetches vote from td_votes
  // - Analyzes with LLM
  // - Applies 2.5× weight (voting records)
  // - Updates TD ideology profile
  // - Saves to debate_ideology_analysis
}
```

## Verification Steps

### 1. Check Latest Debates in DB:
```sql
SELECT MAX(recorded_time) as latest_speech 
FROM debate_speeches;
-- Expected: Around Nov 12-20, 2025
```

### 2. Check Unprocessed Speeches:
```sql
SELECT COUNT(*) as unprocessed
FROM debate_speeches
WHERE id NOT IN (SELECT speech_id FROM debate_ideology_analysis WHERE speech_id IS NOT NULL);
-- This shows how many speeches need processing
```

### 3. Check Unprocessed Votes:
```sql
SELECT COUNT(*) as unprocessed
FROM td_votes
WHERE id NOT IN (SELECT vote_id FROM debate_ideology_analysis WHERE vote_id IS NOT NULL);
-- This shows how many votes need processing
```

### 4. Run Processor and Check Results:
```bash
npm run debate-ideology
```

### 5. Verify TD Profiles Updated:
```sql
SELECT politician_name, welfare, economic, social, total_weight
FROM td_ideology_profiles
WHERE total_weight > 0
ORDER BY total_weight DESC
LIMIT 10;
-- Should show updated ideology scores
```

## Expected Behavior on Nov 20, 2025

### If You Fetch Debates from Nov 12-20:

1. **Debate Fetcher** will:
   - Fetch ~5-10 debate days (depending on parliament schedule)
   - Extract ~200-500 speeches
   - Save to `debate_speeches` table

2. **Ideology Processor** will:
   - Process all new speeches (200-500)
   - Process any new votes
   - Update ~100-200 TD ideology profiles
   - Take ~30-60 minutes (with rate limiting: 2 seconds per speech)

3. **Results:**
   - TD ideology profiles updated with latest positions
   - New analysis records in `debate_ideology_analysis`
   - Consistency checks performed
   - Party discipline detected
   - Rhetoric filtered, substance highlighted

## Key Points

✅ **System is fully functional** - All components implemented  
✅ **Database structure matches** - `debate_speeches` has correct schema  
✅ **Incremental processing** - Only processes unanalyzed speeches/votes  
✅ **Automatic deduplication** - Checks `debate_ideology_analysis` before processing  
✅ **Rate limiting** - 2 seconds between LLM calls (prevents API overload)  
✅ **Batch processing** - Processes 50 at a time  
✅ **Error handling** - Continues if individual speech fails  

## Potential Issues & Solutions

### Issue 1: No Debates Fetched Yet
**Solution:** Run `npx tsx scripts/update-debates-incremental.ts`

### Issue 2: Debates Fetched But Not Processed
**Solution:** Run `npm run debate-ideology`

### Issue 3: API Rate Limits
**Solution:** System already has 2-second delays between calls

### Issue 4: Missing Speaker Party Info
**Solution:** System matches with `td_scores` table to get party info

## Summary

**YES, the system will work functionally well if you fetch debates today (Nov 20, 2025)!**

1. ✅ Debates will be fetched and saved to `debate_speeches` table
2. ✅ Processor will automatically find and process new speeches
3. ✅ All enhancements will be applied (party discipline, consistency, etc.)
4. ✅ TD ideology profiles will be updated
5. ✅ Analysis results will be saved for future reference

**Just run:**
```bash
# 1. Fetch latest debates (if needed)
npx tsx scripts/update-debates-incremental.ts

# 2. Fetch latest votes (if needed)
npm run fetch-votes

# 3. Process everything for ideology analysis
npm run debate-ideology
```

The system is **production-ready** and will handle new debates automatically! 🚀

