# Debate Ideology Scoring: Political Science Enhancements

## Critical Improvements Before Implementation

Thinking like a political scientist reveals several **fundamental issues** with the current plan that must be addressed:

## 1. 🎯 VOTING RECORDS - The Gold Standard

### The Problem
**Rhetoric ≠ Ideology.** What TDs **say** in debates is often strategic positioning, but what they **vote for** reveals true ideology.

### Political Science Principle
- **Voting records** are the most reliable indicator of ideology (Poole & Rosenthal 1985)
- **Statements** can be strategic (especially for opposition)
- **Actions speak louder than words**

### Enhancement Needed
✅ **Integrate voting records** as the primary signal source, not just speeches

**Implementation:**
```typescript
// Voting records should have 2-3× weight vs speeches
voteWeight = speechWeight × 2.5

// Example:
Speech on welfare: -0.12 (weight: 0.8)
Vote for welfare bill: -0.30 (weight: 2.0)  // Much stronger signal
```

**Data Source:**
- Check if we have `td_votes` table or Oireachtas voting API
- Link votes to debate topics
- Extract ideology deltas from vote direction (aye/nay/abstain)

**Priority:** 🔴 **CRITICAL** - Without voting records, we're only tracking rhetoric, not ideology.

---

## 2. 🏛️ PARTY DISCIPLINE vs PERSONAL VIEWS

### The Problem
TDs often say things to **toe the party line**, not express personal ideology. A Fine Gael TD supporting Fine Gael policy might not reflect their personal views.

### Political Science Principle
- **Party discipline** is strong in parliamentary systems
- **Government TDs** defend party policy regardless of personal views
- **Opposition TDs** oppose government policy strategically, not ideologically

### Enhancement Needed
✅ **Weight speeches based on party alignment**

**Implementation:**
```typescript
// Government TD defending government policy = lower weight (party discipline)
if (isGovernmentTD && defendingGovernmentPolicy) {
  partyDisciplinePenalty = 0.6  // 40% reduction
}

// Opposition TD opposing government policy = lower weight (strategic)
if (isOppositionTD && opposingGovernmentPolicy) {
  strategicPenalty = 0.7  // 30% reduction
}

// TD breaking from party line = HIGHER weight (personal view)
if (isGovernmentTD && opposingGovernmentPolicy) {
  rebellionBonus = 1.5  // 50% increase (very significant!)
}

if (isOppositionTD && supportingGovernmentPolicy) {
  crossPartyBonus = 1.3  // 30% increase (notable)
}
```

**Examples:**
```
Government TD defends own policy: 0.6× weight (following party line)
Government TD criticizes own policy: 1.5× weight (REBELLION - personal view!)
Opposition TD opposes government: 0.7× weight (expected, strategic)
Opposition TD supports government: 1.3× weight (cross-party, notable)
```

**Priority:** 🔴 **CRITICAL** - Without this, we'll incorrectly score party loyalty as personal ideology.

---

## 3. 🎭 RHETORICAL vs SUBSTANTIVE STATEMENTS

### The Problem
Some speeches are pure **rhetoric** (party talking points), others contain **substantive policy positions**. We need to distinguish them.

### Political Science Principle
- **Rhetoric** = vague, emotional, party lines ("standing up for families")
- **Substance** = specific, detailed, policy-focused ("increasing child benefit by €50/week")
- **Substance** reveals ideology; **rhetoric** reveals strategy

### Enhancement Needed
✅ **Detect rhetorical vs substantive content**

**Implementation:**
```typescript
// LLM should classify speech type
speechClassification = {
  type: 'rhetorical' | 'substantive' | 'mixed',
  substantiveRatio: 0.0-1.0  // How much is substantive policy content
}

// Weight adjustment
if (speechClassification.type === 'rhetorical') {
  rhetoricPenalty = 0.3  // 70% reduction (minimal ideology signal)
} else if (speechClassification.type === 'substantive') {
  substanceBonus = 1.2  // 20% increase (strong ideology signal)
}
```

**Detection Criteria:**
- **Rhetorical:** Vague language, emotional appeals, party slogans, no specifics
- **Substantive:** Specific policy details, numbers, concrete proposals, technical details

**Priority:** 🟡 **IMPORTANT** - Improves signal quality significantly.

---

## 4. 📊 ISSUE SALIENCE - Some Topics Matter More

### The Problem
Not all policy topics are equally **ideologically meaningful**. A statement on welfare is more ideologically revealing than a statement on road maintenance.

### Political Science Principle
- **High-salience issues** (welfare, immigration, taxes) = strong ideology signals
- **Low-salience issues** (procedural, technical) = weak ideology signals
- **Issue salience** varies by dimension

### Enhancement Needed
✅ **Weight by issue salience per dimension**

**Implementation:**
```typescript
const ISSUE_SALIENCE = {
  // Welfare policy
  welfare: {
    welfare_dimension: 1.0,  // Directly relevant
    social_dimension: 0.8,   // Highly relevant
    economic_dimension: 0.6,  // Moderately relevant
    cultural_dimension: 0.2,  // Minimally relevant
  },
  
  // Immigration policy
  immigration: {
    cultural_dimension: 1.0,
    globalism_dimension: 0.9,
    welfare_dimension: 0.5,
    social_dimension: 0.4,
  },
  
  // Tax policy
  taxation: {
    economic_dimension: 1.0,
    welfare_dimension: 0.7,
    social_dimension: 0.3,
  },
};

// Apply salience weighting
salienceWeight = ISSUE_SALIENCE[topic][dimension] || 0.5
finalAdjustment = baseAdjustment × salienceWeight
```

**Priority:** 🟡 **IMPORTANT** - Improves accuracy by focusing on ideologically meaningful topics.

---

## 5. 🏛️ GOVERNMENT vs OPPOSITION CONTEXT

### The Problem
**Being in government changes behavior.** Government TDs must defend policies, opposition TDs must oppose them. This is **institutional**, not ideological.

### Political Science Principle
- **Government TDs** moderate positions for coalition stability
- **Opposition TDs** take extreme positions to differentiate
- **Role context** matters more than ideology for many statements

### Enhancement Needed
✅ **Adjust signals based on institutional role**

**Implementation:**
```typescript
// Government role penalty (moderating effect)
if (isGovernmentTD && timeInGovernment < 6 months) {
  coalitionModerationPenalty = 0.8  // 20% reduction (still finding feet)
} else if (isGovernmentTD) {
  coalitionModerationPenalty = 0.9  // 10% reduction (institutional moderation)
}

// Opposition role bonus (more freedom to express ideology)
if (isOppositionTD && notJustCriticizing) {
  oppositionFreedomBonus = 1.1  // 10% increase (more ideological freedom)
}
```

**Priority:** 🟡 **IMPORTANT** - Accounts for institutional effects on behavior.

---

## 6. 📈 LONG-TERM PATTERNS vs SHORT-TERM CONTRADICTIONS

### The Problem
Current system checks contradictions within 180 days. But **genuine evolution** should be allowed, and **long-term consistency patterns** matter more than single contradictions.

### Political Science Principle
- **Ideological evolution** is real (TDs can genuinely change)
- **Long-term patterns** (years) are more reliable than short-term
- **Single contradictions** might be strategic, not ideological

### Enhancement Needed
✅ **Multi-timeframe consistency analysis**

**Implementation:**
```typescript
// Check consistency at multiple timeframes
consistencyCheck = {
  shortTerm: checkConsistency(last180Days),    // Tactical consistency
  mediumTerm: checkConsistency(last2Years),    // Strategic consistency  
  longTerm: checkConsistency(allTime),         // Ideological consistency
}

// Weight by timeframe
if (contradiction.shortTerm && !contradiction.longTerm) {
  // Tactical contradiction, not ideological
  penalty = 0.7  // Moderate penalty
} else if (contradiction.longTerm) {
  // Genuine flip-flop
  penalty = 0.5  // Strong penalty
} else if (consistent.longTerm) {
  // Strong ideological pattern
  bonus = 1.1  // Slight bonus for consistency
}
```

**Priority:** 🟢 **NICE TO HAVE** - Improves nuanced handling of evolution vs opportunism.

---

## 7. 🔗 CROSS-DIMENSIONAL COHERENCE

### The Problem
Ideological positions should be **coherent across dimensions**. A TD who is very left-wing on welfare but very right-wing on immigration is unusual and might indicate noise.

### Political Science Principle
- **Ideology is coherent** - positions cluster (left-wing across dimensions, or right-wing)
- **Outlier positions** might be strategic, not ideological
- **Coherence patterns** validate signal quality

### Enhancement Needed
✅ **Check coherence with existing profile**

**Implementation:**
```typescript
// Calculate coherence score
function checkCoherence(currentDelta: IdeologyDelta, existingProfile: TDProfile): number {
  // Check if new position aligns with existing pattern
  const dimensionScores = Object.keys(currentDelta).map(dim => {
    const newValue = existingProfile[dim] + currentDelta[dim]
    const profileCenter = calculateProfileCenter(existingProfile)  // Average of all dimensions
    return Math.abs(newValue - profileCenter)
  })
  
  const averageDeviation = average(dimensionScores)
  
  // Low deviation = coherent, high deviation = outlier
  if (averageDeviation < 2) {
    return 1.1  // Bonus for coherence
  } else if (averageDeviation > 5) {
    return 0.8  // Penalty for outlier (might be strategic, not ideological)
  }
  return 1.0  // Neutral
}
```

**Priority:** 🟢 **NICE TO HAVE** - Adds quality control layer.

---

## 8. 📊 DEBATE TOPIC CLASSIFICATION

### The Problem
Current plan assumes we know the debate topic. But we should **classify debate topics** to match them with relevant ideology dimensions accurately.

### Enhancement Needed
✅ **Topic → Dimension mapping with confidence scores**

**Implementation:**
```typescript
// LLM should classify debate topic and map to dimensions
topicClassification = {
  primaryTopic: 'welfare_expansion',
  secondaryTopics: ['social_policy', 'budget'],
  relevantDimensions: {
    welfare: 1.0,      // Directly relevant
    social: 0.8,       // Highly relevant
    economic: 0.6,     // Moderately relevant
    cultural: 0.1,     // Minimally relevant
  },
  confidence: 0.9
}

// Only extract deltas for relevant dimensions
for (const dimension of relevantDimensions) {
  if (relevantDimensions[dimension] > 0.3) {
    extractDelta[dimension]  // Only extract if relevant
  }
}
```

**Priority:** 🟡 **IMPORTANT** - Prevents false signals from irrelevant dimensions.

---

## Enhanced Multi-Layer Scoring Formula

### Complete Formula with All Enhancements

```typescript
// Step 1: LLM extracts raw signal
llmSignal = -0.4  // (±0.5 max per dimension)

// Step 2: Speech quality weighting (existing)
speechQuality = lengthWeight × roleWeight × statementStrength × speechTypeWeight

// Step 3: NEW - Rhetoric vs Substance
rhetoricPenalty = (isRhetorical ? 0.3 : (isSubstantive ? 1.2 : 1.0))

// Step 4: NEW - Party discipline check
partyDisciplinePenalty = calculatePartyDisciplinePenalty(td, speech, party, government)

// Step 5: NEW - Issue salience
salienceWeight = ISSUE_SALIENCE[topic][dimension] || 0.5

// Step 6: NEW - Government/Opposition context
institutionalContext = calculateInstitutionalContext(td, role, government)

// Step 7: Evidence quality (combined)
effectiveWeight = speechQuality × rhetoricPenalty × partyDisciplinePenalty × 
                  salienceWeight × institutionalContext

// Step 8: Time decay (existing)
timeDecay = Math.pow(0.5, daysSince / 180)

// Step 9: Adaptive scaling (existing)
scalingFactor = 1 / (1 + Math.log10(1 + totalWeight))

// Step 10: Extremity penalty (existing)
extremityPenalty = 1 - (Math.abs(currentValue) / 10) × 0.5

// Step 11: NEW - Multi-timeframe consistency
consistencyPenalty = checkMultiTimeframeConsistency(td, topic, currentDelta)

// Step 12: NEW - Cross-dimensional coherence
coherenceBonus = checkCoherence(currentDelta, existingProfile)

// Step 13: Combine all factors
adjustedSignal = llmSignal × effectiveWeight × timeDecay × scalingFactor ×
                 extremityPenalty × consistencyPenalty × coherenceBonus

// Step 14: Hard cap (existing)
finalAdjustment = clamp(adjustedSignal, -0.2, +0.2)
```

## Priority Ranking

### 🔴 CRITICAL (Must implement)
1. **Voting records integration** - Without this, we're only tracking rhetoric
2. **Party discipline detection** - Without this, party loyalty = personal ideology (wrong!)

### 🟡 IMPORTANT (Should implement)
3. **Rhetorical vs substantive classification** - Improves signal quality significantly
4. **Issue salience weighting** - Focuses on ideologically meaningful topics
5. **Government vs opposition context** - Accounts for institutional effects
6. **Debate topic classification** - Prevents false signals

### 🟢 NICE TO HAVE (Can add later)
7. **Multi-timeframe consistency** - Improves nuanced evolution tracking
8. **Cross-dimensional coherence** - Quality control layer

## Recommended Implementation Order

### Phase 1: Core System (Week 1)
- Basic debate speech analysis
- LLM ideology delta extraction
- Speech quality weighting
- Integration with existing system

### Phase 2: Critical Enhancements (Week 2)
- **Voting records integration** 🔴
- **Party discipline detection** 🔴
- Basic consistency checking

### Phase 3: Important Enhancements (Week 3)
- Rhetorical vs substantive classification
- Issue salience weighting
- Government/opposition context
- Debate topic classification

### Phase 4: Polish (Week 4)
- Multi-timeframe consistency
- Cross-dimensional coherence
- Testing & validation
- Documentation

## Expected Impact of Enhancements

### Without Enhancements
- ✅ Basic ideology tracking from debates
- ❌ Confuses party loyalty with personal ideology
- ❌ No voting record integration (weak signal)
- ❌ Can't distinguish rhetoric from substance
- ⚠️ Moderate accuracy

### With Critical Enhancements Only
- ✅ Voting records provide strongest signal
- ✅ Party discipline filtering improves accuracy
- ✅ Still limited by rhetoric/substance issue
- ✅ Good accuracy for government TDs, moderate for opposition

### With All Enhancements
- ✅ **Voting records** = gold standard signal
- ✅ **Party discipline** = accurate personal ideology
- ✅ **Rhetoric/substance** = higher quality signals
- ✅ **Issue salience** = focused on meaningful topics
- ✅ **Context awareness** = accounts for institutional effects
- ✅ **High accuracy** for all TDs

## Conclusion

**Current plan is a good start, but missing critical political science insights:**

1. 🔴 **Must add voting records** - Otherwise we're only tracking rhetoric
2. 🔴 **Must add party discipline detection** - Otherwise party loyalty = personal ideology
3. 🟡 **Should add rhetoric/substance classification** - Improves signal quality
4. 🟡 **Should add issue salience** - Focus on meaningful topics

**Without these enhancements, the system will:**
- Over-weight government TD statements (party discipline)
- Miss true ideology signals (not using voting records)
- Confuse rhetoric with substance
- Score opposition TDs incorrectly (strategic opposition vs ideology)

**With these enhancements, the system will:**
- Track true ideological positions (voting records + filtered statements)
- Distinguish party loyalty from personal views
- Focus on substantive policy positions
- Account for institutional context (government vs opposition)

---

**Recommendation:** Implement Phase 1 + Phase 2 before full deployment. Critical enhancements are essential for accurate ideology tracking.

