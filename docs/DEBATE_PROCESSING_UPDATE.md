# Debate Processing: Updated to Last 2 Weeks Only

## ✅ Change Implemented

**Updated:** Processor now only processes debates from **last 2 weeks** (14 days), not all historical debates.

## What Changed

### Before:
- Processed **all** unprocessed debates (27,492 speeches + 27,088 votes)
- Would take ~30 hours to complete
- Massive historical backfill

### After:
- Processes only **last 14 days** of debates
- **1,845 speeches** from last 2 weeks
- **0 votes** from last 2 weeks (votes are older)
- Much faster: ~1 hour instead of 30 hours

## Implementation

### Updated Function:
```typescript
processUnprocessedDebates(batchSize: number = 50, lookbackDays: number = 14)
```

**Key Changes:**
1. Added `lookbackDays` parameter (default: 14 days)
2. Filters speeches: `WHERE recorded_time >= cutoffDate`
3. Filters votes: `WHERE vote_date >= cutoffDate`
4. Only processes recent, unanalyzed debates

### Updated Processor:
```typescript
const lookbackDays = 14; // Last 2 weeks only
const stats = await processUnprocessedDebates(batchSize, lookbackDays);
```

## Current Status

**Last 14 Days:**
- Speeches: **1,845** (vs 27,492 total)
- Votes: **0** (all votes are older than 2 weeks)
- Non-TDs: Will be skipped (Bernard Gloster, etc.)

**Processing Time:**
- ~1 hour for 1,845 speeches (vs ~30 hours for all)
- Much more manageable!

## Non-TD Filtering

**Also Implemented:** Non-TDs are now skipped from ideology analysis:
- Bernard Gloster (CEO, HSE) - 268 speeches → **Skipped**
- Kate Duggan - 320 speeches → **Skipped** (if not TD)
- Other civil servants/experts → **Skipped**

**Only TDs get ideology scores** - correct behavior!

## Usage

### Run Processor (Last 2 Weeks Only):
```bash
npm run debate-ideology
```

**What it does:**
1. Finds speeches from last 14 days
2. Filters out already analyzed
3. Filters out non-TDs
4. Processes remaining speeches
5. Updates TD ideology profiles

### Process Historical Debates (If Needed):
If you want to process older debates, you can modify `lookbackDays`:
```typescript
const stats = await processUnprocessedDebates(50, 365); // Last year
```

## Benefits

1. ✅ **Faster processing** - 1 hour vs 30 hours
2. ✅ **Incremental updates** - Only recent debates
3. ✅ **Focused on current** - Most relevant to users
4. ✅ **Non-TDs excluded** - Only elected officials scored
5. ✅ **Safe to re-run** - Only processes unanalyzed items

## Summary

**Status:** ✅ **UPDATED** - Now processes last 2 weeks only  
**Non-TDs:** ✅ **EXCLUDED** - Only TDs get ideology scores  
**Ready:** ✅ **YES** - Safe to run now

---

**Date:** November 20, 2025  
**Change:** Incremental processing (last 14 days) + Non-TD filtering  
**Impact:** Much faster, focused on recent debates only

