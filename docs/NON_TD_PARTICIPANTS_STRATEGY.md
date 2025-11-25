# Non-TD Participants in Debates: Strategy & Implementation

## Problem Statement

**Bernard Gloster** (CEO of HSE) and other non-TD participants appear in parliamentary debates:
- **268 speeches** by Bernard Gloster
- Not a TD (not in `td_scores` table)
- Not elected officials
- Civil servants, CEOs, experts, witnesses

**Question:** How should we handle these non-TD participants?

## Current Situation

### Who Are Non-TD Participants?

1. **Civil Servants/CEOs:**
   - Bernard Gloster (CEO, HSE) - 268 speeches
   - Other agency heads, department officials

2. **Committee Chairs (Non-TD):**
   - An Cathaoirleach Gníomhach (Acting Chair)
   - An Comhchathaoirleach (Deputy Chair)
   - These are often TDs, but some may not be

3. **Experts/Witnesses:**
   - Called to give evidence
   - Not elected officials

### Current System Behavior

**What Happens Now:**
- System tries to match `speaker_name` to `td_scores` table
- If not found → `tdMeta` is null
- Still processes speech for ideology analysis
- Creates ideology profile if not exists
- **Problem:** Non-TDs shouldn't get ideology scores!

## Recommended Strategy

### Option 1: Exclude from Ideology Scoring (RECOMMENDED) ✅

**Approach:**
- **
- **Skip ideology analysis** for non-TDs
- **Still show their speeches** in debate views (for context)
- **Don't create ideology profiles** for them
- **Don't rank them** with TDs

**Implementation:**
```typescript
// Check if speaker is a TD before processing
const { data: tdMeta } = await supabase
  .from('td_scores')
  .select('politician_name, party, constituency')
  .eq('politician_name', speech.speaker_name)
  .maybeSingle();

if (!tdMeta) {
  console.log(`⏭️  Skipping ${speech.speaker_name} - not a TD`);
  return; // Skip ideology analysis
}
```

**Pros:**
- ✅ Clean separation: Only elected officials get ideology scores
- ✅ No confusion: Users won't see CEOs ranked with TDs
- ✅ Accurate: Civil servants don't have "ideology" in same way
- ✅ Still useful: Their speeches appear in debates for context

**Cons:**
- ⚠️ Their speeches won't be analyzed (but that's correct - they shouldn't be!)

### Option 2: Include with Different Classification

**Approach:**
- Create separate category: "Non-TD Participants"
- Show in app but clearly labeled
- Don't rank with TDs
- Maybe track their statements but not ideology scores

**Pros:**
- ✅ More complete coverage
- ✅ Users can see all debate participants

**Cons:**
- ⚠️ More complex UI
- ⚠️ Risk of confusion
- ⚠️ Still need to decide: ideology scores or not?

### Option 3: Include Fully (NOT RECOMMENDED) ❌

**Approach:**
- Treat non-TDs same as TDs
- Give them ideology scores
- Rank them with TDs

**Why NOT:**
- ❌ CEOs/civil servants don't have "ideology" voters care about
- ❌ They serve at government's pleasure, not elected
- ❌ Confusing for users
- ❌ Not the app's purpose (TD accountability)

## Recommended Implementation: Option 1

### Changes Needed

1. **Skip Non-TDs in Ideology Analysis:**
   ```typescript
   // In analyzeDebateSpeech()
   if (!tdMeta) {
     console.log(`⏭️  Skipping ${speech.speaker_name} - not a TD`);
     return; // Don't analyze for ideology
   }
   ```

2. **Still Show in Debates:**
   - Keep speeches in `debate_speeches` table
   - Show in debate views
   - Label clearly: "CEO, HSE" or "Expert Witness"

3. **Frontend Handling:**
   - Show non-TD speeches in debate context
   - Don't show in TD rankings
   - Don't show in ideology profiles
   - Maybe add a filter: "Show only TDs" vs "Show all participants"

### Database Impact

**No Changes Needed:**
- `debate_speeches` table already has all speeches
- `debate_ideology_analysis` will just have fewer records (only TDs)
- `td_ideology_profiles` won't have non-TDs (correct!)

### UI/UX Considerations

**In Debate Views:**
- Show all speeches (TDs + non-TDs)
- Label non-TDs clearly: "Bernard Gloster (CEO, HSE)"
- Maybe different styling/color for non-TDs

**In TD Rankings:**
- Only show TDs
- Filter out non-TDs automatically

**In Ideology Profiles:**
- Only TDs have profiles
- Non-TDs don't appear

## Specific Case: Bernard Gloster

**Current Status:**
- 268 speeches in database
- Not in `td_scores` table
- CEO of HSE (Health Service Executive)

**What Should Happen:**
1. ✅ **Skip ideology analysis** - He's not a TD
2. ✅ **Show speeches in debates** - Important context for health debates
3. ✅ **Label clearly** - "Bernard Gloster (CEO, HSE)"
4. ❌ **Don't rank** - Not an elected official
5. ❌ **Don't score** - Not relevant to voter decisions

## Implementation Plan

### Phase 1: Skip Non-TDs in Ideology Analysis ✅

**File:** `server/services/debateIdeologyAnalysisService.ts`

**Change:**
```typescript
// Get TD metadata
const { data: tdMeta } = await supabase
  .from('td_scores')
  .select('politician_name, party, constituency')
  .eq('politician_name', speech.speaker_name)
  .maybeSingle();

// NEW: Skip if not a TD
if (!tdMeta) {
  console.log(`⏭️  Skipping ${speech.speaker_name} - not a TD (role: ${speech.speaker_role || 'unknown'})`);
  return;
}
```

### Phase 2: Frontend Filtering (Future)

**Add filter options:**
- "Show only TDs" (default)
- "Show all participants" (includes non-TDs)

**Labeling:**
- Non-TDs: "Name (Role)" e.g., "Bernard Gloster (CEO, HSE)"
- TDs: "Name (Party)" e.g., "Simon Harris (Fine Gael)"

## Statistics

**Non-TD Speakers:**
- Bernard Gloster: 268 speeches
- Others: Need to count total

**Impact:**
- ~60-100 non-TD speakers total
- ~500-1000 speeches by non-TDs
- **Should be skipped** from ideology analysis

## Summary

**Recommendation:** **Option 1 - Exclude from Ideology Scoring**

**Rationale:**
1. ✅ Only elected officials should have ideology scores
2. ✅ Civil servants/CEOs serve at government's pleasure
3. ✅ Their "ideology" isn't relevant to voters
4. ✅ Still show speeches for context
5. ✅ Clean separation of concerns

**Implementation:**
- Skip non-TDs in `analyzeDebateSpeech()` and `analyzeVoteRecord()`
- Still show their speeches in debate views
- Label clearly in frontend
- Don't rank or score them

---

**Status:** Strategy defined, ready for implementation  
**Next:** Update `debateIdeologyAnalysisService.ts` to skip non-TDs

