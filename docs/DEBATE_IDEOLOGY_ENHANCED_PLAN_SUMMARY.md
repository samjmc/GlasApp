# Debate Ideology Scoring: Enhanced Plan Summary

## Political Science Insights - Critical Improvements

After political science analysis, **critical enhancements are needed** before implementation.

## 🔴 CRITICAL: Must Implement Before Launch

### 1. **Voting Records Integration** (Gold Standard)

**The Problem:** Rhetoric ≠ Ideology. What TDs **say** can be strategic, but what they **vote for** reveals true ideology.

**We Have:** ✅ `td_votes` table with voting records!
- `td_vote`: "Ta", "Nil", "Staon" (aye/nay/abstain)
- `vote_subject`: Topic of vote
- `voted_with_party`: Party discipline indicator
- `debate_uri`: Links votes to debates

**Enhancement:**
- **Voting records = 2-3× weight** vs speeches
- Primary signal source for ideology
- Link votes to debate topics for context

**Impact:** ⭐⭐⭐⭐⭐ Without this, we're only tracking rhetoric, not ideology.

---

### 2. **Party Discipline Detection**

**The Problem:** TDs often say things to toe the party line, not express personal ideology. Fine Gael TD supporting Fine Gael policy ≠ personal ideology.

**Enhancement:**
```typescript
// Government TD defending government policy = lower weight (party discipline)
if (isGovernmentTD && defendingGovernmentPolicy) {
  penalty = 0.6  // 40% reduction - following party line
}

// Opposition TD opposing government = lower weight (strategic)
if (isOppositionTD && opposingGovernmentPolicy) {
  penalty = 0.7  // 30% reduction - expected opposition
}

// TD breaking from party line = HIGHER weight (personal view!)
if (isGovernmentTD && opposingGovernmentPolicy) {
  bonus = 1.5  // 50% increase - REBELLION is significant!
}
```

**Impact:** ⭐⭐⭐⭐⭐ Without this, party loyalty = personal ideology (wrong!).

---

## 🟡 IMPORTANT: Should Implement

### 3. **Rhetorical vs Substantive Classification**

**Enhancement:** Detect party talking points (rhetoric) vs detailed policy positions (substance).

**Impact:** ⭐⭐⭐⭐ Improves signal quality significantly.

### 4. **Issue Salience Weighting**

**Enhancement:** Weight by how ideologically meaningful the topic is.

- High salience (welfare, immigration) = strong signal
- Low salience (procedural) = weak signal

**Impact:** ⭐⭐⭐⭐ Focuses on meaningful topics.

### 5. **Government vs Opposition Context**

**Enhancement:** Account for institutional effects (government moderation, opposition freedom).

**Impact:** ⭐⭐⭐ Accounts for institutional behavior.

### 6. **Debate Topic Classification**

**Enhancement:** Map topics to relevant ideology dimensions accurately.

**Impact:** ⭐⭐⭐ Prevents false signals.

---

## 📊 Enhanced Scoring Formula

### Complete Formula with All Enhancements

```typescript
// Step 1: Determine source type
const sourceType = hasVote ? 'vote' : 'speech'
const baseWeight = sourceType === 'vote' ? 2.0 : 1.0  // Votes = 2× weight

// Step 2: LLM extracts raw signal
llmSignal = -0.4

// Step 3: Source-specific weighting
if (sourceType === 'vote') {
  effectiveWeight = baseWeight × voteConfidence × issueSalience
} else {
  effectiveWeight = speechQuality × rhetoricPenalty × partyDisciplinePenalty
}

// Step 4: Party discipline check (CRITICAL)
if (isGovernmentTD && defendingGovernmentPolicy) {
  effectiveWeight *= 0.6  // Party discipline
} else if (isGovernmentTD && opposingGovernmentPolicy) {
  effectiveWeight *= 1.5  // REBELLION - very significant!
} else if (isOppositionTD && opposingGovernmentPolicy) {
  effectiveWeight *= 0.7  // Expected opposition
} else if (isOppositionTD && supportingGovernmentPolicy) {
  effectiveWeight *= 1.3  // Cross-party support
}

// Step 5: Time decay, adaptive scaling, extremity penalty (existing)
// ... (same as article system)

// Step 6: Consistency & coherence checks
// ... (enhanced with multi-timeframe)

// Step 7: Hard cap
finalAdjustment = clamp(calculated, -0.2, +0.2)
```

## 🎯 Priority Implementation Order

### Phase 1: Core System (Week 1)
- ✅ Basic debate speech analysis
- ✅ LLM ideology delta extraction
- ✅ Speech quality weighting
- ✅ Integration with existing system

### Phase 2: CRITICAL Enhancements (Week 2) 🔴
- ✅ **Voting records integration** (primary signal source)
- ✅ **Party discipline detection** (filter party loyalty)
- ✅ Basic consistency checking

### Phase 3: Important Enhancements (Week 3) 🟡
- ✅ Rhetorical vs substantive classification
- ✅ Issue salience weighting
- ✅ Government/opposition context
- ✅ Debate topic classification

### Phase 4: Polish (Week 4) 🟢
- ✅ Multi-timeframe consistency
- ✅ Cross-dimensional coherence
- ✅ Testing & validation

## 📈 Expected Accuracy Impact

### Without Enhancements
- ⚠️ **Moderate accuracy** (~60-70%)
- ❌ Confuses party loyalty with ideology
- ❌ No voting record integration (weak signal)
- ❌ Can't distinguish rhetoric from substance

### With CRITICAL Enhancements Only
- ✅ **Good accuracy** (~75-85%)
- ✅ Voting records provide strongest signal
- ✅ Party discipline filtering improves accuracy
- ⚠️ Still limited by rhetoric/substance issue

### With ALL Enhancements
- ✅ **High accuracy** (~85-95%)
- ✅ Voting records = gold standard signal
- ✅ Party discipline = accurate personal ideology
- ✅ Rhetoric/substance = higher quality signals
- ✅ Issue salience = focused on meaningful topics
- ✅ Context awareness = accounts for institutional effects

## 🎓 Political Science Validation

### What Political Scientists Care About:

1. ✅ **Voting records** - Most reliable indicator (Poole & Rosenthal 1985)
2. ✅ **Party discipline** - Must distinguish from personal views
3. ✅ **Rhetoric vs substance** - Only substance reveals ideology
4. ✅ **Issue salience** - Some topics matter more
5. ✅ **Institutional context** - Government vs opposition matters

### Without These Enhancements:
- ❌ Scoring party loyalty as ideology (fundamental error)
- ❌ Missing voting records (weakest signal quality)
- ❌ No distinction between rhetoric and substance
- ⚠️ **Not acceptable for political science accuracy**

### With These Enhancements:
- ✅ True ideological positions (voting + filtered statements)
- ✅ Distinguishes party loyalty from personal views
- ✅ Focuses on substantive policy positions
- ✅ Accounts for institutional context
- ✅ **Acceptable for political science research**

## 💡 Key Insights

### 1. Voting Records Are Everything
**Most important enhancement.** Without voting records, we're only tracking rhetoric, which can be strategic rather than ideological.

### 2. Party Discipline Is Critical
**Second most important.** Government TDs defending party policy doesn't reveal personal ideology - it reveals party loyalty. We must filter this.

### 3. Rebellion Is Significant
**When a government TD opposes their own party's policy, that's VERY significant ideologically.** This should have HIGH weight (1.5× bonus).

### 4. Opposition Context Matters
**Opposition TDs opposing government policy is expected and strategic, not necessarily ideological.** Lower weight (0.7×).

### 5. Rhetoric vs Substance
**Party talking points are not ideology signals.** Only substantive policy positions reveal true ideology.

## ✅ Recommendation

**Implement Phase 1 + Phase 2 before full deployment.**

**Critical enhancements (voting records + party discipline) are essential** for accurate ideology tracking. Without them, the system will produce systematically biased results (over-weighting party loyalty).

**With these enhancements, the system will be:**
- ✅ Accurate enough for political science research
- ✅ Distinguishes true ideology from strategic positioning
- ✅ Uses voting records (gold standard) as primary signal
- ✅ Accounts for party discipline and institutional context

---

**Status:** Enhanced plan ready with critical political science improvements  
**Next Step:** Implement Phase 1 (core) + Phase 2 (critical enhancements)  
**Timeline:** 2 weeks for core + critical enhancements  
**Expected Accuracy:** 75-85% with critical enhancements, 85-95% with all enhancements

