# System Architecture Confirmation

## User's Question Summary

The user wants to confirm that:

1. **TD Ideology Profiles** should change with each article (if there's evidence for a score change, policy shift)
2. **User Personal Rankings** should change when users vote on policies (because their dimensions are recalculated against every politician)
3. **TD Objective Rankings** should NOT change when users vote (they're based on objective analysis of news articles, voting records, debates)

## System Architecture Analysis

### ✅ CORRECTLY IMPLEMENTED

#### 1. TD Objective Rankings (ELO Scores)
- **Location:** `td_scores` table (ELO scores)
- **Source:** Article analysis (transparency, effectiveness, integrity, consistency)
- **Updated From:** 
  - ✅ News articles via `ELOScoringService.updateTDScores()`
  - ✅ Process scores (0-100) from AI analysis
  - ✅ Article impact scores (-10 to +10)
- **NOT Updated From:** 
  - ✅ User votes (correctly separated)
  - ✅ User ideology (correctly separated)
- **Status:** ✅ CORRECT - Objective rankings are separate from user votes

#### 2. User Ideology Profiles
- **Location:** `user_ideology_profiles` table
- **Initialized From:**
  - ✅ Enhanced quiz results (8 dimensions)
  - ✅ Legacy quiz results (if exists)
- **Updated From:**
  - ✅ Policy votes via `applyIdeologyDelta()` in `dailySessionService.ts`
  - ✅ Daily session votes affect user's ideology dimensions
- **Formula:** Minimal adaptive adjustments with headroom checks
- **Status:** ✅ CORRECT - User ideology updates when they vote

#### 3. User Personal Rankings
- **Location:** `user_personal_rankings` table
- **Calculated From:**
  - ✅ Ideology Match (50%): `calculateIdeologyMatch()` compares user vs TD ideology profiles
  - ✅ Policy Agreement (delta): Cumulative policy agreements/disagreements
- **Formula:** `overall_compatibility = ideologyBaseline + policyDelta` (bounded 0-100)
- **Recalculated When:**
  - ✅ User votes on policy → Updates `user_td_policy_agreements` → Should recalculate rankings
  - ✅ User ideology changes → Should recalculate rankings
- **NOT Affected By:** TD objective ELO scores (correctly separated)
- **Status:** ⚠️ PARTIALLY CORRECT - Needs verification that recalculation happens after votes

#### 4. TD Ideology Profiles
- **Location:** `td_ideology_profiles` table
- **Initialized From:**
  - ✅ Party baseline (if party member)
  - ✅ Zero (if Independent)
- **Should Update From:**
  - ❌ **MISSING:** Regular article analysis (only updates for policy opportunities)
  - ⚠️ Only updates via `PolicyStanceHarvester` when policy opportunities are generated
  - Should update from ALL articles that mention TDs and their policy stances
- **NOT Updated From:**
  - ✅ User votes (correctly separated)
- **Status:** ❌ **NEEDS FIX** - TD ideology profiles don't update from regular article analysis

### ❌ MISSING IMPLEMENTATION

#### TD Ideology Profile Updates from Articles

**Current Behavior:**
- Articles are analyzed and `td_policy_stance` is extracted (support/oppose/neutral)
- ELO scores are updated correctly
- BUT: TD ideology dimensions are NOT updated unless:
  - A policy opportunity is generated for that article
  - AND `PolicyStanceHarvester.extractFromArticle()` is called
  - This means most articles don't update TD ideology profiles

**Expected Behavior:**
- When article analysis extracts `td_policy_stance`, it should also extract `ideology_delta`
- TD ideology profiles should update for ALL articles with policy stances
- Not just articles that become policy opportunities

**Fix Required:**
1. Update article analysis to extract `ideology_delta` when `td_policy_stance` is detected
2. Call `TDIdeologyProfileService.applyAdjustments()` after article analysis (not just for policy opportunities)
3. Ensure this happens in both `dailyNewsScraper.ts` and `newsToTDScoringService.ts`

## Data Flow Summary

### Article Analysis Flow (Current)
```
Article → AI Analysis → {
  ✅ ELO scores updated (td_scores)
  ✅ td_policy_stance saved
  ❌ TD ideology dimensions NOT updated (missing)
}
```

### Article Analysis Flow (Expected)
```
Article → AI Analysis → {
  ✅ ELO scores updated (td_scores)
  ✅ td_policy_stance saved with ideology_delta
  ✅ TD ideology dimensions updated (td_ideology_profiles)
}
```

### User Vote Flow (Current)
```
User votes on policy → {
  ✅ User ideology updated (user_ideology_profiles)
  ✅ Policy agreement updated (user_td_policy_agreements)
  ⚠️ Personal rankings should recalculate (needs verification)
  ✅ TD objective rankings NOT affected (correct)
  ✅ TD ideology profiles NOT affected (correct)
}
```

## Confirmation

### What the User Described:
> "TD profiles should change with each article if there is enough evidence for a score to change, policy shift etc."

**Answer:** ❌ **NOT FULLY WORKING** - TD ideology profiles only update for policy opportunities, not all articles

> "When the user votes on a policy, their personal TD rankings should change because their dimensions will be recalculated against every politician"

**Answer:** ⚠️ **SHOULD WORK** - User ideology updates → personal rankings recalculate, but needs verification

> "The objective TD rankings shouldn't change because they are based on analysis of the news articles, and in the future, their voting on bills and debates etc."

**Answer:** ✅ **CORRECT** - Objective rankings (ELO) are separate and don't change from user votes

## System Status

| Component | Status | Notes |
|-----------|--------|-------|
| TD Objective Rankings (ELO) | ✅ Working | Based on article analysis, separate from user votes |
| TD Ideology Profile Updates | ❌ **BROKEN** | Only updates for policy opportunities, not all articles |
| User Ideology Updates | ✅ Working | Updates when user votes on policies |
| User Personal Rankings | ⚠️ Should Work | Based on ideology match, but needs verification of recalculation |
| Separation of Concerns | ✅ Working | User votes don't affect TD objective rankings |

## Required Fixes

### Priority 1: TD Ideology Profile Updates
**File:** `server/services/aiNewsAnalysisService.ts`, `server/jobs/dailyNewsScraper.ts`

**Changes:**
1. Add `ideology_delta` to `td_policy_stance` in article analysis
2. Call `TDIdeologyProfileService.applyAdjustments()` after article analysis
3. Apply to ALL articles with policy stances, not just policy opportunities

**Test:**
- Article: "Simon Harris announces €1bn welfare increase"
- Expected: Harris welfare dimension increases (becomes more progressive/left)
- Verify: Check `td_ideology_profiles` table after article analysis

### Priority 2: Verify Personal Rankings Recalculation
**File:** `server/services/dailySessionService.ts`

**Check:**
- Does `syncGlobalVoteArtifacts()` trigger `recalculatePersonalRankings()`?
- Or is it called elsewhere after user votes?

**Expected:**
- After user votes → user ideology updates → personal rankings recalculate automatically

## Conclusion

The architecture the user described **IS the intended design**, but there's one critical missing piece:

1. ✅ TD objective rankings work correctly (based on articles, not user votes)
2. ✅ User ideology updates when users vote
3. ⚠️ User personal rankings should recalculate (needs verification)
4. ❌ **TD ideology profiles don't update from regular article analysis** (MUST FIX)

**Recommendation:** Fix TD ideology profile updates before running the news scraper regularly, so TD ideology profiles accurately reflect their actions in articles.

---

**Status:** Ready for Implementation  
**Last Updated:** 2025-01-27

