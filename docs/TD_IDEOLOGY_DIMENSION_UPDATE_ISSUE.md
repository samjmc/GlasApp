# TD Ideology Dimension Update Issue - Analysis & Fix Plan

## Problem Statement

**Current Issue:** TD ideology dimensions are initialized from party baselines correctly, but they are **NOT updated from regular news article analysis**. Only when policy opportunities are generated does the system update ideology dimensions (via PolicyStanceHarvester), which means most articles that mention TDs don't affect their ideology profiles.

**Example Scenario (User's Question):**
- Simon Harris starts with welfare score of 0 (from Fine Gael baseline)
- An article says "Simon Harris is increasing welfare"
- **Currently:** His welfare score does NOT change
- **Expected:** His welfare score should increase based on the article

## Current Architecture

### ✅ What Works

1. **TD Ideology Profile Initialization** (`tdIdeologyProfileService.ts`)
   - ✅ TDs initialize with party baseline dimensions (lines 72-109)
   - ✅ Independents start at 0, party members start from `parties` table baseline
   - ✅ Example: Fine Gael TD gets party's economic, social, welfare, etc. scores

2. **TD Ideology Update Service** (`tdIdeologyProfileService.ts`)
   - ✅ `TDIdeologyProfileService.applyAdjustments()` exists and works correctly
   - ✅ Uses minimal adaptive adjustments (0-0.2 max per article)
   - ✅ Takes ideology_delta and updates TD profile dimensions
   - ✅ Logs events to `td_ideology_events` table

3. **Policy Stance Harvesting** (`policyStanceHarvester.ts`)
   - ✅ Extracts policy stances from articles/debates
   - ✅ Generates ideology_delta for each stance
   - ✅ Calls `TDIdeologyProfileService.applyAdjustments()` to update TD profiles
   - ✅ BUT only runs when policy opportunities are generated

### ❌ What's Missing

1. **Article Analysis to Ideology Update Bridge**
   - ❌ Article analysis (`aiNewsAnalysisService.ts`) extracts `td_policy_stance` but NO `ideology_delta`
   - ❌ Daily news scraper (`dailyNewsScraper.ts`) analyzes articles but doesn't update TD ideology
   - ❌ `newsToTDScoringService.ts` saves `td_policy_stance` to database but doesn't update ideology
   - ❌ PolicyStanceHarvester only runs for policy opportunities, missing most articles

2. **Missing Connection Points**
   - Article analysis creates `td_policy_stance` → but doesn't calculate ideology_delta
   - Daily news scraper processes articles → but doesn't call ideology update service
   - PolicyStanceHarvester updates ideology → but only for policy opportunity articles

## Solution: Add Ideology Updates to Article Analysis Flow

### Option 1: Extract Ideology Delta from Article Analysis (Recommended)

**Location:** `server/services/aiNewsAnalysisService.ts`

**Changes:**
1. Update the AI prompt to ALSO extract ideology_delta when `td_policy_stance` is detected
2. Add `ideology_delta` field to `ArticleAnalysis` interface
3. In daily news scraper, call `TDIdeologyProfileService.applyAdjustments()` after article analysis

**Pros:**
- Uses existing article analysis (no duplicate LLM calls)
- Consistent with policy stance harvester approach
- Single source of truth for article analysis

**Cons:**
- Makes article analysis prompt more complex
- Might increase token usage slightly

### Option 2: Create Ideology Update Service That Uses td_policy_stance

**Location:** New service or add to `newsToTDScoringService.ts`

**Changes:**
1. After saving `td_policy_stance`, map it to ideology_delta based on:
   - Policy topic → ideology dimension mapping
   - Stance (support/oppose) → direction (+/-)
   - Strength → magnitude
2. Call `TDIdeologyProfileService.applyAdjustments()` with calculated delta

**Pros:**
- Separates concerns (analysis vs ideology update)
- Can reuse existing policy topic → dimension mapping

**Cons:**
- Less precise than AI-extracted ideology_delta
- Requires manual mapping rules

### Option 3: Run PolicyStanceHarvester for ALL Articles

**Location:** `server/jobs/dailyNewsScraper.ts`

**Changes:**
1. After article analysis, if `td_policy_stance` exists, call `PolicyStanceHarvester.extractFromArticle()`
2. This will extract ideology_delta and update TD profiles

**Pros:**
- Reuses existing code
- Consistent with policy opportunity flow

**Cons:**
- Extra LLM call for every article (cost)
- PolicyStanceHarvester expects policy topic, but articles might not have one

## Recommended Implementation: Option 1 (Enhanced Article Analysis)

### Step 1: Update ArticleAnalysis Interface

```typescript
// server/services/aiNewsAnalysisService.ts

export interface ArticleAnalysis {
  // ... existing fields ...
  
  // TD POLICY STANCE (For personal rankings)
  td_policy_stance?: {
    stance: 'support' | 'oppose' | 'neutral' | 'unclear';
    strength: number;  // 1-5
    evidence: string;
    policy_topic: string;
    // NEW: Ideology delta based on this stance
    ideology_delta?: Record<string, number>; // economic, social, welfare, etc.
  };
}
```

### Step 2: Update AI Prompt to Extract Ideology Delta

```typescript
// In CLASSIFICATION_PROMPT or ANALYSIS_PROMPT

"td_policy_stance": {
  "stance": "support|oppose|neutral|unclear",
  "strength": 3,
  "evidence": "Specific quote or action showing their stance",
  "policy_topic": "Brief description of the policy",
  "ideology_delta": {
    "economic": -0.5,      // -2 to +2 scale
    "social": -0.3,
    "welfare": -1.2,       // If stance is "support increasing welfare" → negative
    // ... other dimensions
  }
}
```

**Important:** Map stance to ideology delta:
- "support increasing welfare" → welfare: negative (more progressive/left)
- "oppose increasing welfare" → welfare: positive (more conservative/right)
- "support tax cuts" → economic: positive (more market-based)
- etc.

### Step 3: Update Daily News Scraper to Apply Ideology Updates

```typescript
// server/jobs/dailyNewsScraper.ts

// After article analysis:
if (analysis.td_policy_stance?.ideology_delta) {
  await TDIdeologyProfileService.applyAdjustments(
    politician.name,
    analysis.td_policy_stance.ideology_delta,
    {
      sourceType: 'article',
      sourceId: articleId,
      policyTopic: analysis.td_policy_stance.policy_topic,
      weight: analysis.td_policy_stance.strength / 5, // 1-5 → 0.2-1.0 weight
      confidence: analysis.confidence || 0.8,
    }
  );
}
```

### Step 4: Update NewsToTDScoringService (if used)

Same logic - apply ideology adjustments when `td_policy_stance.ideology_delta` exists.

## Testing Strategy

### Test Case 1: Welfare Increase Article
1. Simon Harris has welfare = 0 (Fine Gael baseline)
2. Article: "Simon Harris announces €1bn welfare increase"
3. AI analysis: `td_policy_stance.stance = "support"`, `ideology_delta.welfare = -1.2`
4. **Expected:** Harris welfare score increases (becomes more negative/progressive)
5. **Verify:** Check `td_ideology_profiles` table, welfare should be ~0.12 higher (0 + 1.2 * 0.1 scaling)

### Test Case 2: Tax Cut Article
1. TD with economic = 0
2. Article: "TD advocates for corporate tax cuts"
3. AI analysis: `stance = "support"`, `ideology_delta.economic = +1.5`
4. **Expected:** TD economic score increases (becomes more market-based/right)
5. **Verify:** Check `td_ideology_profiles` table

### Test Case 3: No Policy Stance
1. Article: "TD attends community event"
2. AI analysis: `td_policy_stance = undefined`
3. **Expected:** No ideology update
4. **Verify:** TD profile unchanged

## Files to Modify

1. ✅ `server/services/aiNewsAnalysisService.ts`
   - Add `ideology_delta` to `td_policy_stance` in prompt
   - Add `ideology_delta` to `ArticleAnalysis` interface

2. ✅ `server/jobs/dailyNewsScraper.ts`
   - Import `TDIdeologyProfileService`
   - Apply ideology adjustments after article analysis

3. ✅ `server/services/newsToTDScoringService.ts` (optional, if used)
   - Same ideology update logic

4. ✅ Tests
   - Create test script to verify ideology updates work

## Implementation Priority

**HIGH PRIORITY** - This is a core feature that should work before running the news scraper regularly.

## Success Criteria

✅ After article analysis, TD ideology dimensions update based on their actions
✅ Updates are minimal and adaptive (0-0.2 max per article)
✅ Updates are logged to `td_ideology_events` table
✅ Party profiles recalculate based on member updates
✅ Example: "Simon Harris increases welfare" → his welfare score increases

---

**Status:** Ready for Implementation  
**Last Updated:** 2025-01-27

