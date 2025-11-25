# Debate Update Workflow: Fetch + Analysis

## Current Situation

**Two Separate Processes:**
1. **Debate Fetching** - Updates debates page (`debate_speeches`, `debate_sections`, `debate_days`)
2. **Ideology Analysis** - Updates TD ideology profiles

**User Question:** Should these be the same process?

**Answer:** **YES** - They should run together to keep debates page and ideology in sync!

## Recommended Workflow

### Option 1: Combined Command (RECOMMENDED) ✅

**Single command does both:**
```bash
npm run update-debates-and-ideology
```

**What it does:**
1. Fetches new debates from Oireachtas API (last 2 weeks)
2. Saves to database (updates debates page)
3. Analyzes speeches/votes for ideology (updates TD profiles)

**Benefits:**
- ✅ Single command
- ✅ Always in sync
- ✅ No confusion

### Option 2: Sequential (Current)

**Run separately:**
```bash
# Step 1: Fetch debates (updates debates page)
npx tsx scripts/update-debates-incremental.ts

# Step 2: Analyze for ideology (updates TD profiles)
npm run debate-ideology
```

**When to use:**
- If you only want to fetch debates (no ideology analysis)
- If you only want to analyze existing debates (no new fetch)

## What Each Process Does

### Debate Fetching (`scripts/update-debates-incremental.ts`):
- Fetches debates from Oireachtas API
- Parses XML transcripts
- Saves to:
  - `debate_days` (debate sessions)
  - `debate_sections` (debate topics/sections)
  - `debate_speeches` (individual speeches)
- **Updates debates page** ✅

### Ideology Analysis (`server/jobs/debateIdeologyProcessor.ts`):
- Reads from `debate_speeches` and `td_votes` tables
- Analyzes with LLM to extract ideology deltas
- Applies political science enhancements
- Updates `td_ideology_profiles` table
- **Updates TD ideology scores** ✅

## Integration Points

**They're Already Connected:**
- Ideology processor reads from `debate_speeches` (created by fetcher)
- Both use same database tables
- Both process last 2 weeks of data

**What's Missing:**
- Single command to run both
- Automatic check if debates need fetching

## Current Implementation

### Combined Command Created:
```json
"update-debates-and-ideology": "tsx scripts/update-debates-incremental.ts && npm run debate-ideology"
```

**Usage:**
```bash
npm run update-debates-and-ideology
```

**What happens:**
1. Fetches debates (updates debates page)
2. Then analyzes for ideology (updates TD profiles)

### Smart Check Added:
- Ideology processor now checks if recent debates exist
- Warns if debates need fetching first

## Recommended Daily Workflow

### Daily Update:
```bash
npm run update-debates-and-ideology
```

**This will:**
1. ✅ Fetch new debates (last 2 weeks)
2. ✅ Update debates page
3. ✅ Analyze for ideology
4. ✅ Update TD profiles

**Time:** ~1-2 hours (depending on debate volume)

## Summary

**Status:** ✅ **COMBINED WORKFLOW CREATED**

**Command:** `npm run update-debates-and-ideology`

**What it does:**
- Fetches debates → Updates debates page
- Analyzes ideology → Updates TD profiles
- Single command, always in sync

**Answer to user:** Yes, they should be the same process! Now they are. ✅

---

**Date:** November 20, 2025  
**Status:** Combined workflow implemented  
**Next:** Run `npm run update-debates-and-ideology` to update both

