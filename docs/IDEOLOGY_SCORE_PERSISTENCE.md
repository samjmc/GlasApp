# Ideology Score Persistence - Ongoing Incremental Updates ✅

## Confirmation: Scores Build Incrementally

**YES** - The system is designed to build scores incrementally and persist them between runs. Scores **never reset to baseline** once a TD has been analyzed.

## How It Works

### 1. Profile Loading (`ensureTDProfile`)

```typescript
// First: Check if profile exists in database
const { data, error } = await supabase
  .from('td_ideology_profiles')
  .select('*')
  .eq('politician_name', politicianName)
  .maybeSingle();

if (data) {
  return data as TDProfile; // ✅ Returns EXISTING profile
}

// Only creates NEW profile if none exists
// (with party baseline or 0 for Independents)
```

**Key Point:** If a profile exists, it returns the **existing scores**, not baseline.

### 2. Score Updates (`applyAdjustments`)

```typescript
// Load existing profile (or create if first time)
const profile = await ensureTDProfile(politicianName);

// Read CURRENT value from existing profile
const current = Number(profile[dimension]) || 0;

// Calculate adjustment
const minimalDelta = calculateMinimalAdaptiveAdjustment(...);

// ADD adjustment to current value (not replace)
const adjusted = current + minimalDelta; // ✅ Incremental!

// Save updated profile
await upsertTDProfile(profile);
```

**Key Point:** Scores are **added to** existing values, not replaced.

### 3. Database Persistence

- Scores are stored in `td_ideology_profiles` table
- Each update uses `upsert` (update if exists, insert if new)
- `updated_at` timestamp tracks when last modified
- `total_weight` accumulates over time

## Example: Johnny Guirke (Sinn Féin)

### Initial State (First Run):
- Baseline: `welfare: 7.00` (from Sinn Féin party baseline)
- After first speech: `welfare: 6.92` (-0.08 adjustment)

### Second Run:
- **Loads existing:** `welfare: 6.92` ✅ (not 7.00!)
- After second speech: `welfare: 6.88` (-0.04 adjustment)
- **Total change:** -0.12 from baseline

### Third Run:
- **Loads existing:** `welfare: 6.88` ✅ (not 7.00!)
- Continues building incrementally...

## Verification

**Current Database State:**
```sql
SELECT politician_name, welfare, social, economic, total_weight, updated_at
FROM td_ideology_profiles
WHERE politician_name IN ('Johnny Guirke', 'John Cummins', 'Mary Lou McDonald');
```

**Results:**
- **Johnny Guirke:** `welfare: 6.88` (started at 7.00, adjusted down)
- **John Cummins:** `welfare: 1.69` (started at 2.00, adjusted down)
- **Mary Lou McDonald:** `welfare: 6.85` (started at 7.00, adjusted down)

**Proof:** Scores are **NOT** at baseline - they've been adjusted incrementally!

## What Happens on Each Run

### First Time (New TD):
1. ✅ Creates profile with party baseline (or 0 for Independents)
2. ✅ Applies first adjustment
3. ✅ Saves to database

### Subsequent Runs:
1. ✅ **Loads existing profile** from database
2. ✅ **Reads current scores** (not baseline!)
3. ✅ **Adds new adjustments** to existing scores
4. ✅ **Saves updated scores** back to database

## Safety Features

### Profile Persistence:
- Profiles persist in `td_ideology_profiles` table
- Never deleted or reset
- Only updated incrementally

### Incremental Adjustments:
- Each adjustment is small (±0.05 to ±0.15 typically)
- Scores accumulate over time
- `total_weight` tracks how many adjustments have been applied

### Time Decay:
- Older adjustments decay over time (180-day half-life)
- But scores don't reset - they just adjust more slowly

## Summary

✅ **Scores persist** between runs  
✅ **Scores build incrementally** (additive, not replacement)  
✅ **Never reset to baseline** once profile exists  
✅ **Database stores** all scores permanently  
✅ **Each run builds** on previous scores  

**The system is designed for ongoing, incremental updates!**

---

**Date:** November 20, 2025  
**Status:** Verified - Scores persist and build incrementally  
**Next:** Continue running `npm run debate-ideology` to build scores over time

