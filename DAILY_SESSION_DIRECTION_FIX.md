# Daily Session Vote Direction Fix

## Issue
Regardless of vote direction (left/right, libertarian/authoritarian), the daily session was always moving the user's position in one direction (always right economically, always authoritarian). The negative scale values weren't being preserved.

## Root Causes
**FOUR** separate bugs in `server/services/dailySessionService.ts` were causing this issue:

### Bug 1: Math.abs() Stripping Signs (Lines 2122-2125)
The `recordVote` function was using `Math.abs()` when calculating ideology deltas from policy vote option vectors. This stripped the negative sign from left-leaning or libertarian votes.

### Bug 2: Inverted Direction Multiplier (Lines 673-678)
The `directionMultiplier` function had **completely backwards logic**:
- Progressive/left policies returned +1 (moves you RIGHT) ❌  
- Conservative/right policies returned -1 (moves you LEFT) ❌

This was the primary bug causing all movement to be in the wrong direction!

### Bug 3: Negative Delta Filter (Line 2164)
The code only used calculated ideology deltas if they were positive (`ideologyDelta > 0`), ignoring negative values entirely.

### Bug 4: Wrong Table Query (Lines 2100-2104) **THE MAIN BUG!**
The code queried for a non-existent `option_vectors` column from `policy_vote_opportunities` table:

```typescript
// BEFORE (BROKEN):
const { data: opportunity } = await client
  .from("policy_vote_opportunities")
  .select("answer_options, option_vectors")  // ❌ option_vectors doesn't exist!
```

The `option_vectors` column doesn't exist, so it ALWAYS returned NULL, causing the code to fall back to a simple rating system that completely ignored the actual ideology deltas stored in the `policy_vote_option_vectors` table!

This meant ALL votes used only the `policy_direction` field (if set) combined with rating, rather than the detailed multi-dimensional ideology vectors in the database.

```typescript
// BEFORE (BUGGY):
const deltas = selectedOption.ideology_delta || {};
ideologyDelta = Object.values(deltas).reduce(
  (sum: number, val: any) => sum + Math.abs(Number(val) || 0),  // ❌ Math.abs strips sign!
  0
) / Math.max(Object.keys(deltas).length, 1);
```

## Fixes Applied

### Fix 1: Remove Math.abs() (Lines 2122-2125)
Removed `Math.abs()` from the ideology delta calculation to preserve the sign:

```typescript
// BEFORE (BUGGY):
ideologyDelta = Object.values(deltas).reduce(
  (sum: number, val: any) => sum + Math.abs(Number(val) || 0),  // ❌ Strips sign!
  0
)

// AFTER (FIXED):
ideologyDelta = Object.values(deltas).reduce(
  (sum: number, val: any) => sum + (Number(val) || 0),  // ✅ Sign preserved!
  0
)
```

### Fix 2: Invert Direction Multiplier (Lines 673-678)
**This was the critical bug!** Inverted the return values to match the actual scale direction:

```typescript
// BEFORE (COMPLETELY BACKWARDS):
if (normalized && progressiveDirections.has(normalized)) {
  return 1;  // ❌ Made left policies move you RIGHT!
}
if (normalized && conservativeDirections.has(normalized)) {
  return -1;  // ❌ Made right policies move you LEFT!
}

// AFTER (FIXED):
if (normalized && progressiveDirections.has(normalized)) {
  return -1;  // ✅ Left policies now move you LEFT (negative)
}
if (normalized && conservativeDirections.has(normalized)) {
  return 1;  // ✅ Right policies now move you RIGHT (positive)
}
```

**Scale Reference**: -10 (left/libertarian) ← 0 → +10 (right/authoritarian)

### Fix 3: Allow Negative Deltas (Line 2164)
Changed the condition to accept negative ideology deltas:

```typescript
// BEFORE (BUGGY):
const intendedDelta = optionKey && ideologyDelta > 0  // ❌ Only positive!
  ? ideologyDelta * IDEOLOGY_LEARNING_RATE
  : baseImpact * IDEOLOGY_LEARNING_RATE;

// AFTER (FIXED):
const intendedDelta = optionKey && ideologyDelta !== 0  // ✅ Any non-zero value
  ? ideologyDelta * IDEOLOGY_LEARNING_RATE
  : baseImpact * IDEOLOGY_LEARNING_RATE;
```

### Fix 4: Query Correct Table (Lines 2100-2129) **CRITICAL FIX!**
Changed to query the correct `policy_vote_option_vectors` table:

```typescript
// BEFORE (COMPLETELY BROKEN):
const { data: opportunity } = await client
  .from("policy_vote_opportunities")
  .select("answer_options, option_vectors")  // ❌ Column doesn't exist!
  .eq("id", itemRecord.policy_vote_id)
  .maybeSingle();

if (opportunity?.option_vectors) {  // Always NULL!
  // This code NEVER ran!
}

// AFTER (FIXED):
const { data: optionVectors } = await client
  .from("policy_vote_option_vectors")  // ✅ Correct table!
  .select("*")
  .eq("policy_vote_id", itemRecord.policy_vote_id)
  .eq("option_key", optionKey)
  .maybeSingle();

if (optionVectors) {
  // Now actually loads the ideology deltas from database!
  const ideologyDimensions = ['economic', 'social', 'cultural', 'authority', 
                               'environmental', 'welfare', 'globalism', 'technocratic'];
  const dimensionDeltas = ideologyDimensions
    .map(dim => Number(optionVectors[dim]) || 0)
    .filter(val => val !== 0);
  
  ideologyDelta = dimensionDeltas.reduce((sum, val) => sum + val, 0) / dimensionDeltas.length;
}
```

**This was the most critical bug** - without this fix, the system never actually used the multi-dimensional ideology vectors from the database, falling back to a simple left/right calculation based only on `policy_direction`.

## What This Fixes
- **Economic axis**: Voting for left-wing economic policies (e.g., higher taxes, more spending) will now correctly move position LEFT instead of right
- **Authority axis**: Voting for libertarian policies (e.g., less government control) will now correctly move position toward LIBERTARIAN instead of authoritarian
- **All other axes**: Globalism, social, environmental, etc. will now correctly respect vote direction

## Testing
To verify the fix:
1. Restart the server (changes are in server code)
2. Start a new daily session
3. Vote for a clear LEFT-wing economic policy → Position should move LEFT
4. Vote for a clear LIBERTARIAN policy → Position should move toward libertarian
5. Check the session completion screen to verify movements are in the correct direction

## Technical Details
- The fix preserves negative delta values throughout the calculation chain
- The `applyIdeologyDelta` function already correctly handles signed deltas (adds them directly to current value)
- Display values still use `Math.abs()` for showing magnitude to users, with direction tracked separately
- This only affects multiple-choice policy votes that use option_vectors with ideology_delta values

## Example: How It Works Now

**Policy**: "Increase taxes on the wealthy" (marked as `policy_direction: "left"`)

**Scenario 1: You SUPPORT the left policy (rating 5)**
```
ratingToImpact(5) = (5-3)/2 = +1
directionMultiplier("left", 5) = -1  ✅ (was +1 before fix)
baseImpact = +1 × -1 = -1 (NEGATIVE)
Result: Moves you LEFT ✅
```

**Scenario 2: You OPPOSE the left policy (rating 1)**
```
ratingToImpact(1) = (1-3)/2 = -1
directionMultiplier("left", 1) = -1  ✅
baseImpact = -1 × -1 = +1 (POSITIVE)
Result: Moves you RIGHT ✅
```

**Policy**: "Cut government spending" (marked as `policy_direction: "right"`)

**Scenario 3: You SUPPORT the right policy (rating 5)**
```
ratingToImpact(5) = (5-3)/2 = +1
directionMultiplier("right", 5) = +1  ✅ (was -1 before fix)
baseImpact = +1 × +1 = +1 (POSITIVE)
Result: Moves you RIGHT ✅
```

**Scenario 4: You OPPOSE the right policy (rating 1)**
```
ratingToImpact(1) = (1-3)/2 = -1
directionMultiplier("right", 1) = +1  ✅
baseImpact = -1 × +1 = -1 (NEGATIVE)
Result: Moves you LEFT ✅
```

## Files Changed
- `server/services/dailySessionService.ts` (3 locations: lines 673-678, 2122-2125, 2164)

