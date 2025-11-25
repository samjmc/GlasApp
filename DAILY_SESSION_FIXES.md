# Daily Session Fixes - November 21, 2025

## Issues Identified

### 1. **Impact Score Always Zero**
**Problem:** All `daily_session_votes.impact_score` values were `0.000`, causing the session summary to always show "Your answers kept every dimension stable today."

**Root Cause:** 
- The code expected `policy_vote_opportunities.option_vectors` column to exist, but it doesn't exist in the database
- When `option_vectors` was null, `finalRating` defaulted to `3` (neutral)
- `ratingToImpact(3)` returns `0`, so `baseImpact = 0`, leading to `intendedDelta = 0` and `impact_score = 0`

**Fix Applied:**
Added fallback logic in `recordVote` (lines 2105-2112) to map option keys to ratings when `option_vectors` is unavailable:
```typescript
// No option_vectors - map option key to rating based on position
// option_a = strong support (5), option_b = moderate support (4), 
// option_c = moderate oppose (2), option_d = strong oppose (1)
const optionRatingMap: Record<string, number> = {
  option_a: 5,
  option_b: 4,
  option_c: 2,
  option_d: 1,
};
finalRating = optionRatingMap[optionKey] ?? 3;
```

**Expected Impact:**
- `option_a` → rating 5 → baseImpact = 1.0 → intendedDelta = 0.1
- `option_b` → rating 4 → baseImpact = 0.5 → intendedDelta = 0.05
- `option_c` → rating 2 → baseImpact = -0.5 → intendedDelta = -0.05
- `option_d` → rating 1 → baseImpact = -1.0 → intendedDelta = -0.1

### 2. **No Question Type Diversity**
**Problem:** Recent sessions showed ALL items had `policy_vote_id` (multiple choice), with no slider questions.

**Root Cause:** 
- The diversity check only triggered when there were NO multiple-choice items: `if (!hasMultipleChoice)`
- Once the database accumulated multiple-choice questions, every session became 100% multiple-choice
- No logic existed to ensure a MIX of question types

**Fix Applied:**
Replaced the simple "at least one" check with intelligent balancing logic (lines 1581-1643):
1. Count current distribution of multiple-choice vs slider
2. Target 50% multiple-choice (configurable)
3. If distribution is 0% or 100%, convert items to achieve balance
4. Randomly select items to convert for variety

**Key Logic:**
```typescript
const multipleChoiceCount = selectedItems.filter(
  (item) => item.candidate.policy_vote_id
).length;
const sliderCount = selectedItems.length - multipleChoiceCount;

// If ALL are multiple choice or ALL are slider, convert some for diversity
const targetMultipleChoice = Math.floor(selectedItems.length * 0.5);

if (multipleChoiceCount === 0 || multipleChoiceCount === selectedItems.length) {
  // Convert items to achieve balance...
}
```

**Expected Result:**
- Each daily session will have approximately 50% slider and 50% multiple-choice questions
- Variety in question types (3-option, 4-option multiple choice, and sliders)

## Files Modified

1. **`server/services/dailySessionService.ts`**
   - Lines 2105-2112: Added option-to-rating mapping fallback
   - Lines 1581-1643: Replaced diversity check with balancing logic

2. **`server/services/openaiService.ts`**
   - Added `generateVoteQuestion()` function to create diverse multiple-choice questions

## Testing Recommendations

1. **Create a new daily session** and verify:
   - Mix of slider and multiple-choice questions appears
   - Console logs show: `"Question type distribution: X multiple-choice, Y slider"`
   - Console logs show conversions: `"✓ Converted to N-option multiple choice"`

2. **Complete the session** with varied answers and verify:
   - `impact_score` values are non-zero in database
   - Session summary shows dimension shifts (not "stable")
   - Different options produce different impacts:
     - option_a should show positive shift
     - option_d should show negative shift

3. **Check database** after completion:
   ```sql
   SELECT rating, selected_option, impact_score 
   FROM daily_session_votes 
   WHERE session_item_id IN (
     SELECT id FROM daily_session_items 
     WHERE session_id = [LATEST_SESSION_ID]
   );
   ```
   Expected: `impact_score` values like `0.100`, `0.050`, `-0.050`, `-0.100`

## Additional Notes

- The `option_vectors` column was referenced in code but never existed in the database schema
- This suggests the feature was planned but never fully implemented
- The fallback mapping provides a reasonable approximation of ideological impact
- Future enhancement: Generate actual `option_vectors` using AI to analyze each option's ideological implications

## Verification Checklist

- [x] Code compiles without lint errors
- [x] Server restarts successfully
- [ ] New session shows question type diversity
- [ ] Session completion shows non-zero dimension shifts
- [ ] Database records show non-zero impact_scores
- [ ] User experience matches expectations


