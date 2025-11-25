# Party Baseline Fix - Implementation Summary

## Issue

TD ideology profiles were being initialized with all dimensions at 0 instead of their party's baseline scores. This was caused by incorrect column names in the database query (camelCase vs snake_case).

## Root Cause

**File:** `server/services/tdIdeologyProfileService.ts`

**Problem:** Code was querying for `economicScore`, `socialScore`, etc. (camelCase) but the database columns are `economic_score`, `social_score`, etc. (snake_case).

```typescript
// WRONG (before fix)
.select('economicScore, socialScore, ...')
...
economic: clampIdeologyValue(Number(partyData.economicScore) || 0),

// CORRECT (after fix)
.select('economic_score, social_score, ...')
...
economic: clampIdeologyValue(Number(partyData.economic_score) || 0),
```

## Party Baselines (from database)

| Party | Economic | Social | Cultural | Globalism | Environmental | Authority | Welfare | Technocratic |
|-------|----------|--------|----------|-----------|---------------|-----------|---------|--------------|
| Fine Gael | 2.0 | 2.0 | 3.0 | 6.0 | 1.0 | 4.0 | 2.0 | 5.0 |
| Fianna Fáil | 1.0 | 1.0 | 2.0 | 4.0 | 2.0 | 2.0 | 3.0 | 3.0 |
| Sinn Féin | -6.0 | -6.0 | -3.0 | -3.0 | 4.0 | 1.0 | 7.0 | -5.0 |
| Labour Party | -4.0 | -6.0 | -5.0 | 8.0 | 6.0 | -3.0 | 8.0 | 2.0 |
| Green Party | -2.0 | -5.0 | -6.0 | 7.0 | 10.0 | -2.0 | 6.0 | 7.0 |
| Social Democrats | -5.0 | -8.0 | -7.0 | 9.0 | 7.0 | -4.0 | 9.0 | 6.0 |
| Aontú | -2.0 | 7.0 | 8.0 | -7.0 | -3.0 | 6.0 | 5.0 | -4.0 |
| Independent Ireland | 3.0 | 6.0 | 8.0 | -6.0 | -5.0 | 6.0 | 1.0 | -3.0 |
| People Before Profit | -9.0 | -10.0 | -10.0 | -1.0 | 5.0 | -8.0 | 10.0 | -9.0 |

**Note:** Independents (not "Independent Ireland" party) correctly start at 0 on all dimensions.

## Fix Applied

### 1. Code Fix
Updated `server/services/tdIdeologyProfileService.ts`:
- Changed column names from camelCase to snake_case
- Added better logging to show party baselines being applied
- Improved error handling

### 2. Data Correction
Corrected existing TD profiles that were created with wrong baselines:
- Helen McEntee (Fine Gael): Updated from 0,0,0 to 2,2,2 baseline
- Other TDs checked and corrected as needed

## Verification

### Before Fix
```sql
SELECT politician_name, party, economic, social, welfare
FROM td_ideology_profiles
WHERE politician_name = 'Helen McEntee';

Result:
Helen McEntee | Fine Gael | 0.0 | 0.0 | 0.0  ❌ WRONG
```

### After Fix
```sql
SELECT politician_name, party, economic, social, welfare
FROM td_ideology_profiles
WHERE politician_name = 'Helen McEntee';

Result:
Helen McEntee | Fine Gael | 2.0 | 2.0 | 2.0  ✅ CORRECT
```

## Testing

New TD profiles will now correctly initialize with party baselines:

```typescript
// Fine Gael TD
ensureTDProfile('New TD Name') 
→ Initializes with: economic=2, social=2, cultural=3, globalism=6, etc.

// Sinn Féin TD
ensureTDProfile('SF TD') 
→ Initializes with: economic=-6, social=-6, cultural=-3, welfare=7, etc.

// Independent
ensureTDProfile('Independent TD')
→ Initializes with: all dimensions at 0 (correct for independents)
```

## Console Output

When creating a new TD profile, you'll now see:
```
✅ Initialized [TD Name] profile from [Party] baseline: 
   { economic: 2, social: 2, welfare: 2 }
```

Instead of:
```
⚠️  Could not find party baseline for [Party], starting at 0
```

## Impact on System

### Positive Impact
1. **Accurate Initial Profiles:** New TDs start with realistic party-aligned positions
2. **Better Convergence:** Profiles now adjust FROM party baseline, not from 0
3. **Meaningful Adjustments:** Article-based adjustments are now relative to party position
4. **Realistic Personal Rankings:** User compatibility scores now reflect actual party differences

### Example Scenario

**Before Fix:**
- Fine Gael TD starts at 0,0,0
- Article shifts welfare by -0.1
- Result: -0.1 (looks left-wing, but FG is center-right)
- ❌ Inaccurate profile

**After Fix:**
- Fine Gael TD starts at 2,2,2 (party baseline)
- Article shifts welfare by -0.1
- Result: 1.9 (still center-right, slightly more progressive)
- ✅ Accurate profile

## Files Modified

1. `server/services/tdIdeologyProfileService.ts`
   - Fixed column names (camelCase → snake_case)
   - Improved logging
   - Better error handling

## Documentation Created

1. `docs/PARTY_BASELINE_FIX.md` - This document

## Next Steps

1. ✅ Code fix applied
2. ✅ Existing profiles corrected
3. ✅ Verification completed
4. 🔄 Ready to run news scraper with correct baselines

---

**Status:** ✅ FIXED AND VERIFIED  
**Date:** 2025-01-27  
**Impact:** All new TD profiles will correctly initialize with party baselines

