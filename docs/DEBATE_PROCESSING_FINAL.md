# Debate Processing: Final Configuration

## ✅ Changes Implemented

### 1. Last 2 Weeks Only ✅
- Processor now only processes debates from **last 14 days**
- Not all historical debates (27,492 speeches)
- Much faster: ~1 hour instead of 30 hours

### 2. Non-TD Filtering ✅
- Skips non-TD participants (CEOs, civil servants, experts)
- Bernard Gloster (CEO, HSE) - **Skipped**
- Only elected TDs get ideology scores

## Current Status

**Last 14 Days (Nov 6-20, 2025):**
- Total speeches: **1,845**
- TD speeches: **~1,200-1,500** (estimated, after filtering non-TDs)
- Non-TD speeches: **~300-600** (will be skipped)
- Votes: **0** (all votes are older than 2 weeks)

**Processing Time:**
- ~1-2 hours for recent speeches
- Much more manageable than 30 hours!

## What Gets Processed

### ✅ Processed (TDs Only):
- TDs speaking in debates (last 14 days)
- TD votes (if any in last 14 days)
- Ideology analysis applied
- Profile updates

### ⏭️ Skipped:
- Non-TD participants (Bernard Gloster, Kate Duggan, etc.)
- Historical debates (older than 14 days)
- Already analyzed speeches/votes

## Implementation Details

### Date Filter:
```typescript
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - 14); // Last 2 weeks
```

### Non-TD Check:
```typescript
if (!tdMeta) {
  console.log(`⏭️  Skipping ${speaker_name} - not a TD`);
  return; // Skip ideology analysis
}
```

## Usage

### Run Processor:
```bash
npm run debate-ideology
```

**What happens:**
1. Finds speeches from last 14 days
2. Filters out non-TDs
3. Filters out already analyzed
4. Processes remaining TD speeches
5. Updates TD ideology profiles

### Expected Output:
```
📅 Processing debates from last 14 days (since 2025-11-06)
📦 Processing batch 1...
   ⏭️  Skipping Bernard Gloster - not a TD (role: unknown)
   📝 Analyzing speech by Simon Harris (Fine Gael)
   ✅ Speeches processed: 45
   ✅ Votes processed: 0
```

## Summary

**Status:** ✅ **CONFIGURED** - Last 2 weeks only + Non-TD filtering  
**Ready:** ✅ **YES** - Safe to run now  
**Impact:** Much faster, focused on recent debates, only TDs scored

---

**Date:** November 20, 2025  
**Configuration:** Incremental (14 days) + TD-only filtering  
**Next:** Run processor to update recent debates

