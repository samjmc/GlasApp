# Unified Debate Process - Fully Integrated ✅

## Overview

The debate fetching and ideology analysis processes are now **fully integrated** into a single unified workflow. Running the ideology processor automatically fetches new debates first if needed, ensuring the debates page and TD ideology profiles stay perfectly in sync.

## What Changed

### Before (Separate Processes):
```bash
# Step 1: Fetch debates (updates debates page)
npx tsx scripts/update-debates-incremental.ts

# Step 2: Analyze for ideology (updates TD profiles)
npm run debate-ideology
```

### After (Unified Process):
```bash
# Single command does both automatically
npm run debate-ideology
```

## How It Works

### 1. Automatic Debate Fetching

The ideology processor now:
- ✅ Checks if recent debates exist in database
- ✅ Automatically fetches new debates if needed (last 2 weeks)
- ✅ Saves to `debate_days`, `debate_sections`, `debate_speeches` tables
- ✅ Updates debates page automatically

### 2. Ideology Analysis

After fetching (or if debates already exist):
- ✅ Analyzes speeches from `debate_speeches` table
- ✅ Analyzes votes from `td_votes` table
- ✅ Extracts ideological positions using LLM
- ✅ Updates TD ideology profiles

## Implementation Details

### Files Modified:

1. **`server/jobs/debateIdeologyProcessor.ts`**
   - Added `checkIfDebatesNeedFetching()` function
   - Added `fetchNewDebates()` function
   - Integrated debate fetching into main workflow
   - Unified output and statistics

2. **`scripts/fetch-oireachtas-debate-week.ts`**
   - Exported `fetchDebatesForDateRange()` function
   - Made debate fetching logic reusable
   - Can be called programmatically

3. **`package.json`**
   - Updated `update-debates-and-ideology` to use unified process
   - Single command now handles everything

## Usage

### Standard Workflow:
```bash
npm run debate-ideology
```

**What happens:**
1. Checks if debates need fetching
2. Fetches new debates if needed (last 2 weeks)
3. Analyzes speeches/votes for ideology
4. Updates TD profiles

### Output Example:
```
🎯 Starting Unified Debate Update & Ideology Processor

═══════════════════════════════════════════════════════════════
This unified process will:
  1. Fetch new debates from Oireachtas API (updates debates page)
  2. Analyze speeches/votes for TD ideology (updates TD profiles)
📅 Processing last 2 weeks of data

═══════════════════════════════════════════════════════════════

📥 Step 1: Fetching new debates...

   Date range: 2025-11-06 to 2025-11-20
   ✅ Parsed 12 section(s), 45 speech(es), 12500 words...

✅ Debate fetching complete:
   Debates processed: 5
   Sections saved: 45
   Speeches saved: 120

📊 Step 2: Analyzing debates for ideology scoring...

📦 Processing batch 1...
   ✅ Speeches processed: 50
   ✅ Votes processed: 12

═══════════════════════════════════════════════════════════════
✅ Unified Debate Update & Ideology Processing Complete!
═══════════════════════════════════════════════════════════════

📊 Final Statistics:

📥 Debate Fetching:
   Debates processed: 5
   Sections saved: 45
   Speeches saved: 120

📊 Ideology Analysis:
   Speeches analyzed: 50
   Votes analyzed: 12
   Total ideology updates: 62

═══════════════════════════════════════════════════════════════
```

## Benefits

### ✅ Always in Sync
- Debates page and ideology profiles update together
- No risk of analyzing stale data
- No confusion about which process to run

### ✅ Automatic
- No manual steps required
- Smart detection of when fetching is needed
- Continues with existing data if fetch fails

### ✅ Efficient
- Only fetches if needed (checks database first)
- Processes last 2 weeks only (incremental)
- Batch processing for performance

## Technical Details

### Debate Fetching Logic:
- Uses `fetchDebatesForDateRange()` from `fetch-oireachtas-debate-week.ts`
- Fetches from Oireachtas API
- Parses XML transcripts
- Saves to database tables

### Ideology Analysis Logic:
- Uses `processUnprocessedDebates()` from `debateIdeologyAnalysisService.ts`
- Filters to last 14 days
- Skips non-TD speakers
- Applies political science enhancements

### Date Range:
- Both processes use **last 14 days** (2 weeks)
- Ensures consistency
- Incremental updates only

## Migration Notes

### Old Workflow (Still Works):
```bash
# These still work but are now redundant
npx tsx scripts/update-debates-incremental.ts
npx tsx scripts/fetch-oireachtas-debate-week.ts
```

### New Workflow (Recommended):
```bash
# Single unified command
npm run debate-ideology
```

## Status

✅ **FULLY INTEGRATED**

- Debate fetching integrated ✅
- Ideology analysis integrated ✅
- Unified workflow ✅
- Automatic detection ✅
- Single command ✅

---

**Date:** November 20, 2025  
**Status:** Complete - Ready for use  
**Command:** `npm run debate-ideology`

