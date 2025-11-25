# Ideology Profile System - How It Works

## Overview
Your ideology profile is managed through **three separate but interconnected systems**:

1. **Quiz Baseline** - Establishes your starting position
2. **Incremental Updates** - Daily sessions and policy votes adjust your profile
3. **Historical Tracking** - All changes are logged for time-based analysis

---

## 1. Quiz Baseline System

### How It Works
When you take the enhanced quiz:

**Storage:**
```
political_evolution (quiz records)
  ↓ INSERT (new record created, NOT overwrite)
  ↓
user_ideology_profiles (current active profile)
  ↓ UPSERT (synced from latest quiz)
```

**Location:** `server/storage.ts` line 85
- Uses `INSERT` into `political_evolution` table
- **Creates a NEW record** each time you retake the quiz
- Does NOT overwrite your previous quiz attempts
- Each record timestamped with `created_at`

**Syncing to Active Profile:** `server/services/personalRankingsService.ts` line 736-764
- Queries for LATEST quiz (`order by created_at DESC, limit 1`)
- Syncs to `user_ideology_profiles` table
- This becomes your "baseline" for incremental updates
- Weight: `total_weight = 16` (8 dimensions × 2)

### Retaking the Quiz
✅ **YES** - Taking the quiz again WILL reset your baseline:
- New quiz record created in `political_evolution`
- `user_ideology_profiles` updated to new baseline
- Previous quiz results are preserved in history
- Your incremental changes from daily sessions will be **recalculated from the new baseline**

---

## 2. Incremental Update System

### How Daily Sessions & Policy Votes Work

**Flow:**
```
Daily Session Vote → user_policy_vote_responses (permanent record)
                  ↓
          Triggers recomputeUserProfile()
                  ↓
          Aggregates ALL your votes + baseline
                  ↓
          Updates user_ideology_profiles (current position)
```

**Location:** `server/services/userIdeologyProfileService.ts` line 22-141

**Key Features:**
- **Cumulative:** Each vote is saved permanently in `user_policy_vote_responses`
- **Recalculated:** Your profile is recomputed from ALL votes + baseline after each new vote
- **Weighted:** Each vote has a weight and confidence score
- **Multi-dimensional:** Uses `policy_vote_option_vectors` for 8-dimension ideology impacts

**Persistence:**
✅ **YES** - Daily session votes persist:
- Saved in `user_policy_vote_responses` table
- **Never deleted** unless you delete your account
- Recomputed fresh after every vote
- Combines with your quiz baseline

**Calculation:**
```typescript
// For each dimension:
weighted_sum = Σ(vote_value × weight × confidence)
total_weight = Σ(weight × confidence)
current_position = weighted_sum / total_weight
```

---

## 3. Historical Tracking System

### What's Being Tracked

**Quiz History:**
- ✅ **Table:** `political_evolution`
- ✅ **Tracks:** Every quiz you've ever taken
- ✅ **Fields:** All 8 dimension scores, timestamp, quiz version
- ✅ **Purpose:** See how your baseline has evolved over time

**Quiz Comparison History:**
- ✅ **Table:** `quiz_history` (separate from political_evolution)
- ✅ **Fields:** `user_id`, all 8 scores, `created_at`, `is_current` flag
- ❓ **Status:** Empty for you currently - may need migration to populate

**Daily Session History:**
- ✅ **Table:** `daily_sessions`
- ✅ **Tracks:** Each daily session you complete
- ✅ **Fields:** `ideology_axis`, `ideology_delta`, `ideology_direction`, `completed_at`
- ✅ **Purpose:** See which dimension changed and by how much each day

**Vote Response History:**
- ✅ **Table:** `user_policy_vote_responses`
- ✅ **Tracks:** Every policy vote you've ever made
- ✅ **Fields:** `policy_vote_id`, `selected_option`, `updated_at`
- ✅ **Purpose:** Source of truth for recomputing your profile

**TD Ideology Events:**
- ✅ **Table:** `td_ideology_events` (for politicians, not you)
- 🔄 **Equivalent for users:** Not currently implemented

---

## 4. Current State of Your Profile

### What's Working ✅
1. **Quiz Baseline:** Saved in `political_evolution` and synced to `user_ideology_profiles`
2. **Daily Sessions:** 7 completed sessions logged with deltas
3. **Vote Responses:** Being saved to `user_policy_vote_responses`
4. **Profile Recalculation:** Triggered after each vote
5. **Historical Quiz Tracking:** Each quiz retake creates new historical record

### What Was Broken (Now Fixed) 🐛→✅
1. ❌ **Bug:** Code was reading `economicScore` but database has `economic_score`
   - ✅ **Fixed:** Column names corrected (this morning's fix)
2. ❌ **Bug:** Profile showing all zeros despite having quiz data
   - ✅ **Fixed:** Database manually synced, code updated

### What's Not Yet Implemented ⚠️
1. **User Ideology Events Table:** Like `td_ideology_events` but for tracking specific moments when your ideology shifted
2. **Quiz History Population:** `quiz_history` table exists but isn't being populated from `political_evolution`
3. **Time-Series Dashboard:** No UI yet to visualize your ideology evolution over time

---

## 5. Future Time-Based Analysis

### What's Possible Now
With the current data structure, you can query:

```sql
-- All your quiz attempts over time
SELECT 
  economic_score, social_score, cultural_score, 
  created_at
FROM political_evolution
WHERE user_id = 'YOUR_ID'
ORDER BY created_at;

-- Your daily session ideology shifts
SELECT 
  session_date, ideology_axis, 
  ideology_delta, ideology_direction,
  completed_at
FROM daily_sessions
WHERE user_id = 'YOUR_ID'
ORDER BY completed_at;

-- Your current profile vs baseline
SELECT 
  pe.economic_score as quiz_baseline,
  uip.economic as current_position,
  (uip.economic - pe.economic_score) as shift_since_quiz
FROM user_ideology_profiles uip
JOIN political_evolution pe ON pe.user_id = uip.user_id
WHERE uip.user_id = 'YOUR_ID'
  AND pe.quiz_version = 'enhanced'
ORDER BY pe.created_at DESC
LIMIT 1;
```

### What Could Be Added
1. **Snapshot System:** Daily snapshots of your profile for more granular time-series
2. **Event Log:** Specific events that caused shifts (e.g., "Voted on housing crisis article")
3. **Comparison Tool:** Compare any two points in time
4. **Trend Analysis:** "You've moved 2.3 points left on economics over the past month"

---

## 6. Summary: Your Questions Answered

### Q: If I take the quiz again, will my baseline be reset?
**A:** ✅ **YES**
- New quiz creates a new record in `political_evolution`
- Your `user_ideology_profiles` will be updated to the new baseline
- Previous quiz results are preserved in history
- Daily session votes remain in `user_policy_vote_responses` and will continue to influence your profile from the new baseline

### Q: Will my profile change incrementally from daily sessions?
**A:** ✅ **YES**
- Every daily session vote is saved permanently
- Your profile is **recomputed** after each vote
- The calculation combines: (quiz baseline) + (all your votes weighted by importance)
- Changes persist until you retake the quiz

### Q: Are my past dimensions over time being saved?
**A:** ✅ **PARTIALLY**
- **Quiz history:** ✅ Fully saved in `political_evolution`
- **Daily session shifts:** ✅ Saved in `daily_sessions` (shows axis + delta per session)
- **Vote history:** ✅ Saved in `user_policy_vote_responses`
- **Continuous time-series:** ⚠️ Not yet - would need snapshot system
- **Your current position:** ✅ Always available in `user_ideology_profiles`

### Visualization Ready?
**Current Status:** 
- ✅ All data is being saved
- ⚠️ No time-series visualization UI yet
- ✅ Data queryable via SQL for custom analysis
- 🔮 Future feature: Dashboard showing ideology evolution over time

---

## 7. Next Steps (If Desired)

### To Enable Full Time-Based Analysis:
1. Create `user_ideology_snapshots` table (daily snapshots)
2. Create `user_ideology_events` table (annotated shift moments)
3. Build visualization dashboard for time-series
4. Migrate `political_evolution` → `quiz_history` population
5. Add "Compare to baseline" feature in UI

Let me know if you'd like any of these implemented!


