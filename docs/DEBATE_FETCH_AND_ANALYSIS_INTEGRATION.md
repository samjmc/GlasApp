# Debate Fetch & Analysis Integration

## Current Situation

**Two Separate Processes:**
1. **Debate Fetching** (`scripts/fetch-oireachtas-debate-week.ts` or `scripts/update-debates-incremental.ts`)
   - Fetches debates from Oireachtas API
   - Parses XML
   - Saves to `debate_speeches`, `debate_sections`, `debate_days` tables
   - **Updates debates page**

2. **Ideology Analysis** (`server/jobs/debateIdeologyProcessor.ts`)
   - Analyzes speeches/votes for ideology
   - Updates TD ideology profiles
   - **Updates ideology scores**

**Problem:** These should be the same process! Debates page and ideology should stay in sync.

## Recommended Solution

### Option 1: Combined Job (RECOMMENDED) ✅

Create a single job that:
1. Fetches new debates (last 2 weeks)
2. Saves to database (updates debates page)
3. Analyzes for ideology (updates TD profiles)

**Benefits:**
- ✅ Single command to run
- ✅ Always in sync
- ✅ No confusion about which to run first

### Option 2: Sequential Jobs

Keep separate but run in sequence:
1. Run debate fetcher first
2. Then run ideology processor

**Benefits:**
- ✅ Can run separately if needed
- ⚠️ Need to remember to run both

### Option 3: Auto-Fetch Before Analysis

Ideology processor checks if debates need fetching:
- If no recent debates → Warn user to fetch first
- If recent debates exist → Process them

**Benefits:**
- ✅ Prevents processing stale data
- ⚠️ Still requires manual fetch step

## Implementation: Option 1 (Combined Job)

### New Combined Job Structure:

```typescript
async function runDailyDebateUpdate() {
  // Step 1: Fetch new debates (last 2 weeks)
  await fetchNewDebates(14);
  
  // Step 2: Analyze for ideology
  await processUnprocessedDebates(50, 14);
}
```

### Integration Points:

**Debate Fetching Logic:**
- Use `scripts/fetch-oireachtas-debate-week.ts` logic
- Or call `scripts/update-debates-incremental.ts` as a module
- Save to `debate_speeches`, `debate_sections`, `debate_days`

**Ideology Analysis:**
- Use existing `processUnprocessedDebates()` function
- Already filters by date (last 14 days)
- Already skips non-TDs

## Current Workflow

### Manual (Current):
```bash
# Step 1: Fetch debates
npx tsx scripts/update-debates-incremental.ts

# Step 2: Analyze for ideology
npm run debate-ideology
```

### Automated (Recommended):
```bash
# Single command does both
npm run update-debates-and-ideology
```

## Recommendation

**Implement Option 1:** Create combined job that:
1. ✅ Fetches debates (updates debates page)
2. ✅ Analyzes ideology (updates TD profiles)
3. ✅ Single command
4. ✅ Always in sync

**File:** `server/jobs/dailyDebateUpdate.ts` (already created, needs integration)

---

**Status:** Strategy defined  
**Next:** Integrate debate fetching logic into combined job

