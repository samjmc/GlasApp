# Victim Scoring Fix - TD as Victim Should Not Be Penalized

## Issue Identified

**Article:** "Woman due in court over online threats against Simon Harris and his family"

**Problem:** Simon Harris received a -58 ELO penalty (1024 → 966) for being the **victim** of threats.

**Why This is Wrong:**
- Harris did nothing wrong - he's the victim
- Article provides NO information about his actions, transparency, effectiveness, or integrity
- He shouldn't be penalized for someone else threatening him
- Classification: "controversy" with -20 impact score
- Reality: Should be "neutral" with 0 impact

## AI Analysis (Before Fix)

```
story_type: "controversy"
sentiment: "negative"  
impact_score: -20
reasoning: "Article primarily reports on the arrest of an individual making 
threats against Simon Harris, without providing any substantive information 
regarding his transparency, effectiveness, integrity, or consistency..."
```

**The AI correctly identified** there was no information about Harris's performance, but still gave a negative score!

## Root Cause

The AI analysis prompt didn't have explicit rules about:
1. TDs as victims (should be neutral or positive)
2. Articles with no information about TD actions (should be neutral/0 impact)
3. Distinction between TD causing controversy vs TD being victim of controversy

## Fix Applied

### 1. Updated AI Analysis Prompt

Added critical rules to `server/services/aiNewsAnalysisService.ts`:

```typescript
**CRITICAL RULE - TD AS VICTIM:**
If the TD is a VICTIM (receiving threats, being attacked, targeted by others), 
this is NOT negative for them:
- ✅ Receiving threats → NEUTRAL (0 impact) or slightly positive (shows significance)
- ✅ Being criticized by opponents → NEUTRAL (normal politics) unless exposes wrongdoing
- ✅ Being mentioned without actions → NEUTRAL (0 impact) - no action = no score change
- ❌ DON'T penalize TDs for being victims of others' actions

**CRITICAL RULE - NO INFORMATION:**
If the article provides NO INFORMATION about the TD's actions, transparency, 
effectiveness, or integrity:
- impact_score MUST be 0 (neutral)
- story_type MUST be "neutral"
- DO NOT give negative scores just because information is absent
```

### 2. Corrected Simon Harris Score

Restored his ELO and corrected the article classification:

```sql
-- Before
story_type: 'controversy'
impact_score: -20
old_elo: 1024, new_elo: 966 (change: -58)

-- After
story_type: 'neutral'
impact_score: 0
old_elo: 1024, new_elo: 1024 (change: 0)
```

## Examples of Correct Scoring

### Victim Scenarios (Should be Neutral)

| Scenario | Correct Score | Reasoning |
|----------|---------------|-----------|
| TD receives death threats | 0 (neutral) | Victim, no action by TD |
| TD family threatened | 0 (neutral) | Victim, not TD's fault |
| TD attacked online | 0 (neutral) | Victim of others |
| Opposition criticizes TD (generic) | 0 (neutral) | Normal politics |
| TD mentioned in passing | 0 (neutral) | No action to score |

### Actual Controversy (Should be Negative)

| Scenario | Correct Score | Reasoning |
|----------|---------------|-----------|
| TD caught lying | -15 to -20 | TD's action, affects trust |
| TD breaks promise | -10 to -15 | TD's action, consistency issue |
| TD scandal with evidence | -15 to -20 | TD's action, integrity issue |
| TD fails to deliver | -5 to -10 | TD's action, effectiveness issue |

### Key Distinction

**Bad for TD:**
- TD **causes** controversy through their actions
- TD **does** something wrong
- TD **fails** to perform their duties

**Neutral for TD:**
- TD **experiences** controversy caused by others
- TD **is victimized** by others
- TD **mentioned** without any action

## Testing Scenarios

### Test 1: Victim of Threats
```
Article: "Man arrested for threatening Minister"
Expected: impact_score = 0, story_type = 'neutral'
Reasoning: Minister is victim, took no action
```

### Test 2: Criticized by Opposition
```
Article: "Sinn Féin criticizes government economic policy"
Expected: impact_score = 0, story_type = 'neutral'
Reasoning: Normal political criticism, no wrongdoing exposed
```

### Test 3: Mentioned Without Action
```
Article: "Budget debate continues, Harris mentioned"
Expected: impact_score = 0, story_type = 'neutral'
Reasoning: No specific action or performance to assess
```

### Test 4: Actual Scandal
```
Article: "TD caught misusing expenses"
Expected: impact_score = -15 to -20, story_type = 'scandal'
Reasoning: TD's action, clear integrity issue
```

## Impact on System

### Positive Changes
1. ✅ TDs no longer penalized for being victims
2. ✅ More accurate ELO scores reflect actual performance
3. ✅ Articles without TD actions don't affect scores
4. ✅ System distinguishes between TD actions vs external events

### Expected Behavior
- **Before Fix:** Any article mentioning a TD could affect their score
- **After Fix:** Only articles about TD's actual actions affect their score

## Files Modified

1. `server/services/aiNewsAnalysisService.ts`
   - Added victim protection rules
   - Added no-information protection rules
   - Clearer distinction between TD actions and external events

## Database Corrections

1. Corrected Simon Harris article_td_scores record
2. Restored Simon Harris ELO from 966 to 1024

## Future Prevention

The enhanced prompt now includes:
- ✅ Explicit victim rules
- ✅ No-information rules  
- ✅ Emphasis on TD's OWN actions
- ✅ Examples of what IS and ISN'T scoreable

## Monitoring

Watch for articles where:
- TDs are mentioned but take no action → should be neutral
- TDs are victims → should be neutral
- TDs are praised/criticized without specifics → should be neutral

Only score when there's evidence of:
- Actual TD actions
- Specific performance indicators
- Clear transparency/integrity/effectiveness/consistency information

---

**Status:** ✅ FIXED  
**Date:** 2025-01-27  
**Impact:** More accurate TD scoring, protects TDs from being penalized as victims

