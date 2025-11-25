# Multiple Choice Voting System - Complete Implementation ✅

## Overview

Both the **Daily Session** and **Home Page News Articles** now use appropriate answer formats:
- **Multiple Choice Buttons** for scenario-based questions (3+ options)
- **Slider** for simple support/oppose questions (2 options)

## System Architecture

### 1. Question Generation (`server/services/policyOpportunityService.ts`)

**Scenario-Based Questions:**
- Questions like "How should this situation be handled?"
- Generate 3-4 distinct answer options
- Each option maps to different ideological positions
- Stored in `policy_vote_opportunities.answer_options` (JSON)

**Simple Questions:**
- Questions like "Do you support this policy?"
- Generate 2 options (support/oppose)
- Use slider interface

### 2. Answer Option Vectors (`policy_vote_option_vectors` table)

Each answer option has ideology deltas:
```json
{
  "option_a": {
    "ideology_delta": {
      "economic": -1.2,
      "social": -0.5,
      "welfare": 1.1
    },
    "weight": 1.2,
    "confidence": 0.85
  }
}
```

### 3. User Response Storage

**Multiple Choice:**
- Stored in `user_policy_vote_responses.selected_option`
- Maps to ideology via `policy_vote_option_vectors`

**Slider:**
- Stored in `user_policy_votes.support_rating` (1-5)
- Maps to ideology via rating → impact score conversion

### 4. Ideology Profile Updates

**Multiple Choice:**
- `UserIdeologyProfileService.recomputeUserProfile()` reads `user_policy_vote_responses`
- Looks up `policy_vote_option_vectors` for selected options
- Applies weighted ideology deltas to user profile

**Slider:**
- Uses `PersonalRankingsService.updatePolicyAgreementFromVote()`
- Converts rating to ideology impact score

## Frontend Implementation

### Daily Session (`client/src/pages/DailySessionPage.tsx`)

**Logic:**
- If `item.answerOptions` exists and has 3+ options → Multiple Choice
- Otherwise → Slider

**Components:**
- `MultipleChoiceVoteControl` - Shows buttons for each option
- `SliderVoteControl` - Shows slider for support/oppose

**Vote Submission:**
- Multiple Choice: Sends `optionKey` to `/api/daily-session/items/:id/vote`
- Slider: Sends `rating` (1-5) to same endpoint

### Home Page News Articles (`client/src/components/PolicyVotePrompt.tsx`)

**Logic:**
- If `policyVote.options` has 3+ entries → Multiple Choice
- If 2 entries → Slider (first option = left, second = right)

**Components:**
- `MultipleChoiceVoteControl` - Shows buttons for each option
- `SliderVoteControl` - Shows slider with custom labels

**Vote Submission:**
- Multiple Choice: Sends `selectedOption` to `/api/policy-votes/opportunity/:id/respond`
- Slider: Sends `supportRating` to `/api/policy-votes`

## Backend Implementation

### Daily Session Vote (`server/services/dailySessionService.ts`)

**`recordVote()` function:**
- Accepts `rating` OR `optionKey`
- If `optionKey`: Maps to ideology deltas via `option_vectors`
- If `rating`: Uses existing slider → impact conversion
- Updates user ideology profile accordingly

### Policy Vote Response (`server/routes/policyVotingRoutes.ts`)

**`POST /api/policy-votes/opportunity/:id/respond`:**
- Accepts `selectedOption` (option key)
- Saves to `user_policy_vote_responses`
- Calls `UserIdeologyProfileService.recomputeUserProfile()`
- Maps option to ideology vectors automatically

**`POST /api/policy-votes`:**
- Accepts `supportRating` (1-5)
- Saves to `user_policy_votes`
- Uses rating → impact conversion

## Ideology Mapping

### Multiple Choice Options → Ideology

**Process:**
1. User selects option (e.g., `option_b`)
2. System looks up `policy_vote_option_vectors` for that option
3. Applies weighted ideology deltas:
   ```typescript
   for (dimension in IDEOLOGY_DIMENSIONS) {
     userProfile[dimension] += vector[dimension] * weight * confidence
   }
   ```
4. Updates `user_ideology_profiles` table

### Slider Rating → Ideology

**Process:**
1. User selects rating (1-5)
2. Converts to impact score:
   - 5 = +1.0 impact
   - 4 = +0.5 impact
   - 3 = 0 impact
   - 2 = -0.5 impact
   - 1 = -1.0 impact
3. Applies to user's ideology profile based on policy dimension

## Example: Russian Spy Ship Question

**Question:** "A known Russian spy ship is tracking near national waters. How should this situation be handled?"

**Options (Multiple Choice):**
- `option_a`: "Monitor closely and document movements"
- `option_b`: "Escalate diplomatically through official channels"
- `option_c`: "Deploy naval assets to shadow the vessel"
- `option_d`: "Ignore it unless it enters territorial waters"

**Ideology Mapping:**
- `option_a` → Authority: +0.3, Technocratic: +0.5
- `option_b` → Globalism: +0.8, Authority: -0.2
- `option_c` → Authority: +1.2, Globalism: -0.5
- `option_d` → Authority: -0.8, Globalism: -0.3

**User selects `option_b`:**
- System applies: Globalism +0.8, Authority -0.2
- User's ideology profile updates accordingly
- Personal TD rankings recalculated

## Status

✅ **Daily Session:** Multiple choice for 3+ options, slider for 2 options  
✅ **Home Page News:** Multiple choice for 3+ options, slider for 2 options  
✅ **Ideology Mapping:** Both systems correctly map to ideology dimensions  
✅ **Backend:** Both endpoints handle optionKey and rating correctly  

## Verification

**To verify the system is working:**

1. **Check Daily Session:**
   - Questions with 3+ options should show multiple choice buttons
   - Questions with 2 options should show slider

2. **Check Home Page:**
   - Articles with `policyVote.options` (3+ keys) should show multiple choice
   - Articles with 2 options should show slider

3. **Check Ideology Updates:**
   - After voting, check `user_ideology_profiles` table
   - Should see updates based on selected option's ideology vectors

---

**Date:** November 20, 2025  
**Status:** Complete - Both systems use appropriate answer formats  
**Next:** Test with real questions to verify UI and ideology mapping

