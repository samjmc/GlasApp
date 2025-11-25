# Testing Daily Session Fixes

## What Was Fixed

### Issue 1: Impact Score Always Zero
- **Before:** All votes recorded `impact_score = 0.000`, causing "dimensions stable" message
- **After:** Multiple-choice options now map to ratings (option_a=5, option_b=4, option_c=2, option_d=1), producing impact scores of ±0.05 to ±0.10

### Issue 2: No Question Type Diversity
- **Before:** All questions were multiple-choice (100%)
- **After:** Sessions now target 50/50 mix of multiple-choice and slider questions

## How to Test

### Test 1: Verify Question Type Diversity

1. **Delete your existing session** (if you have one for today):
   ```sql
   DELETE FROM daily_session_votes WHERE session_item_id IN (
     SELECT id FROM daily_session_items WHERE session_id IN (
       SELECT id FROM daily_sessions WHERE session_date = CURRENT_DATE AND user_id = 'YOUR_USER_ID'
     )
   );
   DELETE FROM daily_session_items WHERE session_id IN (
     SELECT id FROM daily_sessions WHERE session_date = CURRENT_DATE AND user_id = 'YOUR_USER_ID'
   );
   DELETE FROM daily_sessions WHERE session_date = CURRENT_DATE AND user_id = 'YOUR_USER_ID';
   ```

2. **Navigate to** `localhost:5000/daily-session` in your browser

3. **Check the browser console** for logs like:
   ```
   Question type distribution: X multiple-choice, Y slider
   Converting multiple-choice to slider: [headline]
   ✓ Converted to N-option multiple choice
   ```

4. **Verify the UI** shows a mix of:
   - Multiple-choice questions (with option buttons)
   - Slider questions (with 1-5 slider)

### Test 2: Verify Impact Scores

1. **Complete a daily session** with varied answers:
   - For multiple-choice: Select different options (a, b, c, d)
   - For sliders: Use different ratings (1, 3, 5)

2. **Check the summary page** - it should show dimension shifts like:
   ```
   Economic Left-Right: +0.05
   Social Progressive-Conservative: -0.10
   ```
   Instead of "Your answers kept every dimension stable today"

3. **Verify in database**:
   ```sql
   SELECT 
     dsi.headline,
     dsv.selected_option,
     dsv.rating,
     dsv.impact_score
   FROM daily_session_votes dsv
   JOIN daily_session_items dsi ON dsv.session_item_id = dsi.id
   WHERE dsi.session_id = (
     SELECT id FROM daily_sessions 
     WHERE session_date = CURRENT_DATE 
     ORDER BY created_at DESC 
     LIMIT 1
   );
   ```
   
   Expected results:
   - `selected_option = 'option_a'` → `rating = 5`, `impact_score ≈ 0.10`
   - `selected_option = 'option_b'` → `rating = 4`, `impact_score ≈ 0.05`
   - `selected_option = 'option_c'` → `rating = 2`, `impact_score ≈ -0.05`
   - `selected_option = 'option_d'` → `rating = 1`, `impact_score ≈ -0.10`
   - Slider questions → `rating = [user input]`, `impact_score = (rating-3)/2 * 0.1`

### Test 3: Verify Persistence

1. **Complete today's session**
2. **Check your ideology profile**:
   ```sql
   SELECT * FROM user_ideology_profiles WHERE user_id = 'YOUR_USER_ID';
   ```
3. **Create tomorrow's session** (or delete today's and recreate)
4. **Verify** the new session builds on the updated ideology profile

## Expected Console Output

When creating a new session, you should see:
```
Question type distribution: 3 multiple-choice, 0 slider
Converting multiple-choice to slider: [headline 1]
Converting multiple-choice to slider: [headline 2]
```

When recording votes:
```
Mapped option_a to rating 5 (no option_vectors available)
💾 Syncing multiple choice vote: user=..., policy_vote_id=..., option=option_a
```

## Success Criteria

- ✅ New sessions show mix of question types (not 100% multiple-choice)
- ✅ Session summary shows dimension shifts (not "stable")
- ✅ Database records show non-zero `impact_score` values
- ✅ Different options produce different impacts
- ✅ Changes persist to next session

## Troubleshooting

### If you still see 100% multiple-choice:
- Check browser console for error messages
- Verify server restarted successfully
- Check that `generateVoteQuestion` is being called

### If impact scores are still zero:
- Verify you're selecting options (not just clicking through)
- Check that `selected_option` is being recorded in database
- Look for console log: "Mapped option_X to rating Y"

### If changes don't persist:
- Verify `syncGlobalVoteArtifacts` is being called
- Check `user_ideology_profiles` table for updates
- Ensure session status is "completed"


