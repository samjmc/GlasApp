# Debate Ideology Scoring: Expert Data Science Plan

## Executive Summary

Create a debate scoring system that mirrors the article ideology scoring system, where TDs are scored based on their actual statements in parliamentary debates, incrementally updating their ideology profiles across all 8 dimensions as debates are analyzed.

**Key Principle:** A TD's ideology emerges from their **consistent pattern** of statements in debates over time, just as it does from their actions in news articles.

## System Architecture Overview

### Data Flow
```
Debate Speech → AI Analysis → Ideology Deltas → Multi-Layer Scoring → TD Profile Update
```

### Integration with Existing System
- Uses same `td_ideology_profiles` table (already exists)
- Uses same `TDIdeologyProfileService.applyAdjustments()` function
- Uses same multi-layer scoring framework (time decay, adaptive scaling, etc.)
- Separate from ELO/performance scores (already tracked separately)

## Data Source: Parliamentary Debates

### What We Have
- **Table:** `debate_speeches`
  - `speaker_name`: TD name
  - `paragraphs`: Full speech content (JSONB)
  - `word_count`: Length indicator
  - `recorded_time`: Debate date
  - `speaker_role`: Minister, Opposition, etc.

- **Table:** `debate_sections`
  - Topic/context of debate
  - Links speeches to policy domains

### What We Extract
- **TD statements:** What they actually said (their own words, not reported)
- **Policy positions:** Clear stances on ideological issues
- **Consistency:** Comparing to past statements
- **Rhetoric quality:** How strongly they advocate

## Data Science Principles (Mirroring Article System)

### 1. Signal vs Noise Ratio
- **Single speech** = weak signal with moderate noise
- **Parliamentary speeches** = higher quality than news quotes (primary source)
- **Ideology emerges** from pattern of statements across many debates
- **Need 10-20 speeches** to establish reliable profile (debates more reliable than articles)

### 2. Primary Source Advantage
- **Direct quotes** (parliamentary record) > Reported quotes (news articles)
- **Official record** (Oireachtas) > Secondary sources (news)
- **No interpretation** needed - TD's actual words
- **Higher reliability** = less noise, stronger signal

### 3. Speech Context Matters
- **Length:** Longer speeches = more detailed positions = stronger signal
- **Role:** Minister statements > Opposition questions > Interventions
- **Topic relevance:** Direct policy debates > procedural statements
- **Time in debate:** Opening/closing = more important than mid-debate

### 4. Bayesian Update Framework
- Start with prior (party baseline or current ideology profile)
- Each speech provides evidence
- Update posterior estimate incrementally
- Confidence grows with consistent evidence
- Contradictory evidence (flip-flops) triggers consistency penalties

### 5. Time Decay
- Recent speeches matter more (positions evolve)
- Older debates have less impact
- Same 180-day half-life as articles
- But: Historical consistency still valued

## Proposed Scoring System

### Layer 1: LLM Raw Signal (±0.5 max per dimension)

**Scale Calibration (Same as Articles):**
- **±0.4 to ±0.5:** STRONG ideological statement (clear policy position, major announcement, leading debate)
- **±0.2 to ±0.3:** CLEAR position (explicit stance, vocal defense, direct advocacy)
- **±0.1 to ±0.2:** MODERATE signal (stated preference, implied position, questioning)
- **±0.05 to ±0.1:** WEAK signal (tangential mention, vague statement, procedural)
- **0.0:** No clear ideological information

**Examples for Debates:**
```
Strong: "I fully support increasing welfare payments by €500 per week" → welfare: -0.4
Clear: "We must protect our borders from immigration" → cultural: +0.3
Moderate: "I question whether this policy is the right approach" → policy-specific: +0.1
Weak: "I acknowledge the minister's response" → 0.0
```

**Advantage Over Articles:**
- No interpretation needed (TD's own words)
- Full context available (entire speech)
- Higher confidence in signal extraction

### Layer 2: Speech Quality Weighting

**Components:**

1. **Speech Length** (word_count):
   ```typescript
   lengthWeight = Math.min(1.0, word_count / 500)  // 500 words = full weight
   ```
   - <100 words: 0.2x (brief intervention)
   - 100-300 words: 0.4-0.6x (moderate statement)
   - 300-500 words: 0.6-1.0x (detailed position)
   - 500+ words: 1.0x (full speech)

2. **Speaker Role**:
   - Minister/Government: 1.0x (authoritative)
   - Opposition Leader: 0.9x (significant)
   - Opposition TD: 0.7x (standard)
   - Backbencher: 0.6x (less weight)
   - Technical role (Ceann Comhairle): 0.0x (no ideology)

3. **Statement Strength** (from LLM):
   - Strength 5 (leading charge): 1.0x
   - Strength 4 (clear position): 0.8x
   - Strength 3 (moderate): 0.6x
   - Strength 2 (weak): 0.4x
   - Strength 1 (implied): 0.2x

4. **Speech Type** (from debate context):
   - Opening statement: 1.0x (prepared, significant)
   - Response to question: 0.8x (direct engagement)
   - Intervention/clarification: 0.6x (reactive)
   - Procedural statement: 0.2x (minimal ideology)

**Formula:**
```typescript
effectiveWeight = lengthWeight × roleWeight × statementStrength × speechTypeWeight
weightedSignal = llmSignal × effectiveWeight
```

**Example:**
```
Long speech (600 words) by Minister on welfare:
  lengthWeight = 1.0 (600/500 capped)
  roleWeight = 1.0 (Minister)
  statementStrength = 0.8 (clear position, strength 4)
  speechTypeWeight = 1.0 (opening statement)
  effectiveWeight = 1.0 × 1.0 × 0.8 × 1.0 = 0.8
  weightedSignal = -0.4 × 0.8 = -0.32
```

### Layer 3: Time Decay (Same as Articles)

**Formula:**
```typescript
daysSince = (now - debateDate) / (24 * 60 * 60 * 1000)
decayFactor = Math.pow(0.5, daysSince / 180) // 180-day half-life
timedSignal = weightedSignal × decayFactor
```

**Rationale:**
- Recent positions matter more than old ones
- Political views can evolve over time
- But historical pattern still valuable (consistency check)

### Layer 4: Adaptive Scaling (Same as Articles)

**Formula:**
```typescript
scalingFactor = 1 / (1 + Math.log10(1 + totalWeight))
```

**Rationale:**
- First few speeches establish profile (more impact)
- After 20-30 speeches, profile stabilized (less impact per speech)
- Prevents any single speech from dominating

**Expected Behavior:**
- First speech (weight=0): 1.0x (full impact)
- After 10 speeches (weight=8): 0.56x
- After 30 speeches (weight=24): 0.42x
- After 60 speeches (weight=48): 0.37x

### Layer 5: Extremity Penalty (Same as Articles)

**Formula:**
```typescript
extremityPenalty = 1 - (Math.abs(currentValue) / 10) × 0.5
```

**Rationale:**
- Harder to move TDs to extremes (±8+) without strong evidence
- Requires sustained, consistent statements in same direction
- Prevents outlier speeches from pushing to unrealistic positions

### Layer 6: Consistency Check (NEW for Debates)

**Purpose:** Detect and penalize flip-flops or contradictions

**Process:**
1. Compare current speech position to TD's previous statements on same topic
2. If contradiction detected:
   - Flag for review
   - Apply consistency penalty
   - Consider if position genuinely evolved (time-gated exception)

**Formula:**
```typescript
if (contradictsPreviousStatement && daysSinceLastStatement < 180) {
  consistencyPenalty = 0.5  // Halve the impact
  flagForReview = true
} else if (contradictsPreviousStatement && daysSinceLastStatement >= 180) {
  consistencyPenalty = 0.8  // Allow evolution over time
  flagForReview = true
} else {
  consistencyPenalty = 1.0  // No contradiction
}
```

**Example:**
```
TD says "I support welfare increase" (welfare: -0.3)
2 months later says "Welfare is too high" (welfare: +0.3)
→ Consistency penalty: 0.5× (contradictory within short time)
→ Both statements still count, but with reduced impact
```

### Layer 7: Hard Cap (Same as Articles)

**Formula:**
```typescript
finalAdjustment = clamp(calculatedAdjustment, -0.2, +0.2)
```

**Rationale:**
- No single speech can shift ideology by more than ±0.2
- Even strongest, longest speech from Minister = capped impact
- Prevents outlier speeches from dominating profile

## Complete Formula

```typescript
// Step 1: LLM extracts calibrated signal from speech
llmSignal = -0.4 // (±0.5 max per dimension)

// Step 2: Speech quality weighting
lengthWeight = Math.min(1.0, word_count / 500)
roleWeight = getRoleWeight(speakerRole)  // Minister=1.0, Opposition=0.7, etc.
statementStrength = strength / 5  // 1-5 scale
speechTypeWeight = getSpeechTypeWeight(type)  // Opening=1.0, Intervention=0.6, etc.

effectiveWeight = lengthWeight × roleWeight × statementStrength × speechTypeWeight
weightedSignal = llmSignal × effectiveWeight

// Step 3: Time decay
daysSince = (now - debateDate) / (24 * 60 * 60 * 1000)
decayFactor = Math.pow(0.5, daysSince / 180)
timedSignal = weightedSignal × decayFactor

// Step 4: Adaptive scaling
scalingFactor = 1 / (1 + Math.log10(1 + totalWeight))

// Step 5: Extremity penalty
extremityPenalty = 1 - (Math.abs(currentValue) / 10) × 0.5

// Step 6: Consistency check
consistencyPenalty = checkConsistency(currentSpeech, previousStatements)

// Step 7: Combine all factors
adjustedSignal = timedSignal × scalingFactor × extremityPenalty × consistencyPenalty

// Step 8: Hard cap
finalAdjustment = clamp(adjustedSignal, -0.2, +0.2)

// Step 9: Apply
newValue = clamp(currentValue + finalAdjustment, -10, +10)
```

## Real-World Examples

### Example 1: Strong Minister Speech (First Debate)

```
Speech: Minister announces €1bn welfare increase (600 words, opening statement)

Step 1: LLM Signal
  welfare: -0.4 (strong leftward action)

Step 2: Speech Quality
  lengthWeight = 1.0 (600 words)
  roleWeight = 1.0 (Minister)
  statementStrength = 0.8 (strength 4)
  speechTypeWeight = 1.0 (opening)
  effectiveWeight = 1.0 × 1.0 × 0.8 × 1.0 = 0.8
  weighted = -0.4 × 0.8 = -0.32

Step 3: Time Decay
  today → decay = 1.0
  timed = -0.32

Step 4: Adaptive Scaling
  totalWeight = 0 (first speech)
  scaling = 1.0
  scaled = -0.32

Step 5: Extremity Penalty
  currentValue = 2.0 (Fine Gael baseline)
  penalty = 1 - (2.0/10) × 0.5 = 0.9
  adjusted = -0.32 × 0.9 = -0.29

Step 6: Consistency Check
  no previous statement → penalty = 1.0
  final = -0.29

Step 7: Hard Cap
  -0.29 > -0.2 cap
  capped = -0.2

Result: welfare: 2.0 → 1.8 (moderate leftward shift)
```

### Example 2: Opposition Question (After 30 Speeches)

```
Speech: Opposition TD questions welfare policy (200 words, intervention)

LLM Signal: welfare: -0.2 (moderate leftward position)
lengthWeight = 0.4 (200 words)
roleWeight = 0.7 (Opposition TD)
statementStrength = 0.6 (strength 3)
speechTypeWeight = 0.6 (intervention)

effectiveWeight = 0.4 × 0.7 × 0.6 × 0.6 = 0.10
weighted = -0.2 × 0.10 = -0.02

After all factors: ~-0.01

Result: welfare: -2.0 → -2.01 (minimal impact, profile stabilized)
```

### Example 3: Contradiction (Flip-Flop)

```
Previous: TD said "welfare too high" 3 months ago (welfare: +0.2)
Current: TD says "welfare needs increase" (welfare: -0.3)

Consistency Check:
  contradictsPrevious = true
  daysSince = 90 (3 months)
  consistencyPenalty = 0.5 (recent contradiction)

Result: 
  Normal adjustment: -0.12
  With penalty: -0.06
  Flagged for review
```

## Expected Convergence Timeline

### New TD Profile Development

```
Speech 1-5:   Establishment (shifts: 0.1-0.2 per speech)
Speech 5-15:  Refinement (shifts: 0.05-0.1 per speech)
Speech 15-30: Stabilization (shifts: 0.03-0.06 per speech)
Speech 30+:   Maintenance (shifts: 0.01-0.04 per speech)
```

**Faster convergence than articles** because:
- Primary source (more reliable)
- Longer format (more information per speech)
- Context available (debate topic)
- Official record (no interpretation needed)

## Integration with Article System

### Shared Components
- ✅ Same `td_ideology_profiles` table
- ✅ Same `TDIdeologyProfileService.applyAdjustments()` function
- ✅ Same multi-layer scoring (adaptive scaling, time decay, extremity penalty)
- ✅ Same hard cap (±0.2 per update)

### Separate Tracking
- **Articles:** Tracked in `td_ideology_events` with `sourceType: 'article'`
- **Debates:** Tracked in `td_ideology_events` with `sourceType: 'debate'`
- Both contribute to same profile, but tracked separately for analysis

### Combined Weight
- Total weight = sum of article weights + debate weights
- Both systems use same `total_weight` for adaptive scaling
- Consistent convergence behavior across both data sources

## Database Schema Requirements

### Existing Tables (No Changes Needed)
- ✅ `td_ideology_profiles` - Already exists
- ✅ `td_ideology_events` - Already exists (has `sourceType`)
- ✅ `debate_speeches` - Already exists

### New Table: `debate_ideology_analysis`

```sql
CREATE TABLE debate_ideology_analysis (
  id BIGSERIAL PRIMARY KEY,
  speech_id UUID REFERENCES debate_speeches(id),
  politician_name TEXT NOT NULL,
  
  -- LLM Analysis Results
  ideology_delta JSONB NOT NULL,  -- {economic: -0.3, welfare: -0.4, ...}
  statement_strength INTEGER,     -- 1-5 scale
  policy_topic TEXT,
  stance TEXT,                    -- support|oppose|neutral|unclear
  
  -- Scoring Metadata
  speech_length_weight NUMERIC,   -- 0-1
  role_weight NUMERIC,            -- 0-1
  statement_strength_weight NUMERIC, -- 0-1
  speech_type_weight NUMERIC,     -- 0-1
  effective_weight NUMERIC,       -- Combined weight
  time_decay_factor NUMERIC,      -- 0-1
  scaling_factor NUMERIC,         -- 0-1
  extremity_penalty NUMERIC,      -- 0-1
  consistency_penalty NUMERIC,    -- 0-1
  
  -- Final Results
  adjustments_applied JSONB,      -- Final adjustments per dimension
  total_weight_before NUMERIC,
  total_weight_after NUMERIC,
  
  -- Flags
  contradiction_detected BOOLEAN DEFAULT FALSE,
  needs_review BOOLEAN DEFAULT FALSE,
  review_reason TEXT,
  
  -- Metadata
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  analyzed_by TEXT,               -- 'gpt4o-mini' or model name
  confidence NUMERIC              -- 0-1
);

CREATE INDEX idx_debate_ideology_speech ON debate_ideology_analysis(speech_id);
CREATE INDEX idx_debate_ideology_politician ON debate_ideology_analysis(politician_name);
CREATE INDEX idx_debate_ideology_contradiction ON debate_ideology_analysis(contradiction_detected) WHERE contradiction_detected = TRUE;
```

## Implementation Plan

### Phase 1: Core Service Creation ✓

**File:** `server/services/debateIdeologyAnalysisService.ts`

**Functions:**
1. `analyzeSpeech(speechId: string)` - Main analysis function
2. `extractIdeologyDeltas(speech: DebateSpeech)` - LLM extraction
3. `calculateSpeechQuality(speech: DebateSpeech)` - Multi-layer scoring
4. `checkConsistency(politicianName, currentDelta, topic)` - Contradiction detection
5. `applyIdeologyAdjustments(politicianName, deltas, metadata)` - Integration

### Phase 2: LLM Prompt Design ✓

**Based on article system, adapted for debates:**

```typescript
const DEBATE_ANALYSIS_PROMPT = `
You are analyzing a parliamentary debate speech to extract ideological positions.

SPEECH CONTEXT:
- Speaker: ${speakerName} (${role}, ${party})
- Topic: ${debateTopic}
- Type: ${speechType}
- Length: ${wordCount} words

SPEECH TEXT:
${speechText}

EXTRACT IDEOLOGY DELTAS:
Map this speech to ideology dimensions (scale ±0.5 max per dimension):
- economic (market vs collective)
- social (traditional vs progressive)
- cultural (nationalism vs multiculturalism)
- authority (authoritarian vs libertarian)
- environmental (pro-business vs pro-climate)
- welfare (decrease vs increase)
- globalism (national vs global)
- technocratic (populist vs expert)

CALIBRATION:
- ±0.4-0.5: STRONG position (clear policy stance, major announcement)
- ±0.2-0.3: CLEAR position (explicit advocacy, vocal defense)
- ±0.1-0.2: MODERATE signal (stated preference, implied stance)
- ±0.05-0.1: WEAK signal (tangential, vague)
- 0.0: No clear ideological information

RETURN:
{
  "ideology_delta": {
    "economic": 0.0,
    "social": 0.0,
    ...
  },
  "statement_strength": 4,  // 1-5
  "stance": "support|oppose|neutral|unclear",
  "policy_topic": "welfare expansion",
  "confidence": 0.85
}
`
```

### Phase 3: Consistency Tracking ✓

**Store previous positions for comparison:**

```sql
CREATE TABLE debate_ideology_history (
  id BIGSERIAL PRIMARY KEY,
  politician_name TEXT NOT NULL,
  policy_topic TEXT NOT NULL,
  ideology_dimension TEXT NOT NULL,
  previous_value NUMERIC,        -- TD's ideology value before statement
  statement_delta NUMERIC,       -- Delta from this statement
  statement_date TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(politician_name, policy_topic, ideology_dimension, statement_date)
);

CREATE INDEX idx_debate_history_lookup 
ON debate_ideology_history(politician_name, policy_topic, ideology_dimension);
```

**Logic:**
- Before applying adjustment, check recent history (180 days)
- Compare current delta to previous statements on same topic
- If contradictory, apply consistency penalty

### Phase 4: Batch Processing ✓

**Process debates incrementally:**

```typescript
async function processUnprocessedDebates(batchSize: number = 50) {
  // Get speeches without ideology analysis
  const speeches = await getUnprocessedSpeeches(batchSize);
  
  for (const speech of speeches) {
    await analyzeSpeech(speech.id);
    // Rate limiting: 2 seconds between LLM calls
    await sleep(2000);
  }
}
```

### Phase 5: Integration with Existing System ✓

**Use same service:**
```typescript
await TDIdeologyProfileService.applyAdjustments(
  politicianName,
  ideologyDelta,
  {
    sourceType: 'debate',
    sourceId: speech.id,
    policyTopic: analysis.policy_topic,
    weight: effectiveWeight,
    confidence: analysis.confidence,
    sourceDate: speech.recorded_time,
    sourceReliability: 0.95,  // Primary source, very high
  }
);
```

## Expected Behavior Examples

### Scenario 1: Minister Announces Welfare Increase

```
Speech: 600 words, opening statement, Minister role
Content: "I'm pleased to announce a €1bn increase in welfare payments"

LLM Output: {welfare: -0.4, social: -0.1}
Effective Weight: 0.8 (Minister, long, opening, strength 4)
After all factors: -0.15
Result: welfare: 2.0 → 1.85 (moderate shift)
```

### Scenario 2: Opposition Questions Policy (After 30 Speeches)

```
Speech: 200 words, intervention, Opposition TD
Content: "I question whether this welfare policy is sustainable"

LLM Output: {welfare: +0.1}
Effective Weight: 0.10 (short, opposition, intervention, strength 2)
After all factors: -0.01
Result: welfare: -2.0 → -1.99 (minimal impact, stabilized)
```

### Scenario 3: Flip-Flop Detected

```
Previous: 3 months ago, said "welfare too high" (welfare: +0.2)
Current: Says "welfare needs increase" (welfare: -0.3)
Detection: Contradiction within 180 days
Penalty: 0.5×
Result: Normal -0.12 → With penalty -0.06
Flagged for review
```

## Success Metrics

### 1. Convergence Speed
- **Target:** 15-30 speeches to establish reliable profile
- **Comparison:** Articles need 20-50 articles
- **Rationale:** Debates are primary source, more reliable per statement

### 2. Noise Resistance
- **Target:** Single outlier speech < 5% impact on established profile
- **Mechanism:** Adaptive scaling + consistency checks

### 3. Accuracy
- **Target:** Final profiles match expert political analysis
- **Validation:** Compare to known TD positions on major issues

### 4. Stability
- **Target:** Month-to-month changes < 0.5 per dimension (after convergence)
- **Mechanism:** Extremity penalties + consistency checks

### 5. Source Quality
- **Target:** Parliamentary speeches have 1.5-2× impact vs articles (primary source)
- **Implementation:** sourceReliability = 0.95 (vs 0.7-0.9 for articles)

## Monitoring & Alerts

### Weekly Reports
1. **Convergence Status:** TDs with <20 speeches flagged as "developing"
2. **Contradiction Alerts:** Speeches with detected flip-flops
3. **High Variance:** TDs with unstable profiles (needs review)
4. **Processing Status:** Speeches analyzed vs remaining

### Dashboard Metrics
- Speeches analyzed: X / Y (total)
- TDs with ideology profiles: X / 173
- Average speeches per TD: X
- Contradictions detected: X
- Profile stability index: X%

## Comparison: Articles vs Debates

| Aspect | Articles | Debates |
|--------|----------|---------|
| **Source Type** | Secondary (reported) | Primary (official record) |
| **Reliability** | 0.7-0.9 | 0.95 |
| **Content Length** | Short (news quote) | Long (full speech) |
| **Context** | Limited | Full debate context |
| **Signal Strength** | ±0.05-0.15 typical | ±0.08-0.20 typical |
| **Convergence Speed** | 20-50 articles | 15-30 speeches |
| **Interpretation** | Required (reported) | Not needed (direct quote) |

## Future Enhancements

1. **Voting Record Integration:** Track actual votes vs statements
2. **Committee Statements:** Include committee debates
3. **Question Patterns:** Analyze parliamentary questions for ideology
4. **Topic Clustering:** Group related debates for stronger signals
5. **Evolution Tracking:** Visualize how TD ideology changes over time

## Testing Strategy

### Unit Tests
- Speech quality weight calculation
- Consistency check logic
- Multi-layer scoring formula
- Hard cap enforcement

### Integration Tests
- Full speech → profile update flow
- Contradiction detection and penalty
- Time decay application
- Adaptive scaling behavior

### Validation Tests
- Known TDs with public positions
- Compare to expert analysis
- Verify convergence patterns
- Check for outliers

---

**Status:** Expert plan ready for implementation  
**Next Step:** Create `debateIdeologyAnalysisService.ts`  
**Timeline:** 2-3 days for core implementation, 1 week for full integration  
**Expected Impact:** More accurate, faster-converging TD ideology profiles from primary source data

