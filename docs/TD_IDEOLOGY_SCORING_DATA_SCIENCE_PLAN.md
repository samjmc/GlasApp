# TD Ideology Scoring: Expert Data Science Plan

## Problem Statement

Current implementation allows ideology deltas up to ±2 per dimension from a single article, which is excessive on a -10 to +10 scale. This would cause:
- Wild swings from individual articles
- Noise overwhelming signal
- Outlier articles having disproportionate impact
- TD profiles not converging to true ideological positions

## Scale Context

- **Total Range:** -10 to +10 (20 points)
- **Current Article Impact:** ±2 max (10% of total range per article!)
- **Realistic Article Impact:** ±0.05 to ±0.2 max (0.25% to 1% per article)
- **Target Convergence:** 20-50 articles to establish reliable profile

## Data Science Principles

### 1. Signal vs Noise Ratio
- Single article = weak signal with high noise
- Ideology emerges from PATTERN of behavior over time
- Need 20+ consistent signals to establish true position
- Early estimates have high uncertainty, converge with more data

### 2. Bayesian Update Framework
- Start with prior (party baseline)
- Each article provides evidence
- Update posterior estimate
- Confidence grows with consistent evidence
- Contradictory evidence triggers uncertainty flag

### 3. Time Decay
- Recent articles should have more weight
- Political positions evolve over time
- Old evidence should decay (half-life approach)
- But: Don't completely discard historical pattern

### 4. Confidence Weighting
- Source reliability matters (RTÉ > tabloid)
- Direct quotes > reported stances
- Voting records > rhetoric
- Strength of stance affects signal quality

### 5. Regression to Mean
- Outlier positions should revert without confirmation
- Extreme positions require stronger evidence
- One-off statements shouldn't define ideology

## Proposed Scoring System

### Layer 1: LLM Raw Signal (Observation Quality)

**Purpose:** LLM assesses strength of ideological signal in article

**Scale:** 0 to ±0.5 per dimension (NOT ±2!)
- **±0.5:** Unambiguous, strong ideological action (major policy, voting record)
- **±0.3:** Clear ideological position (explicit advocacy, defense)
- **±0.2:** Moderate signal (mentioned position, implied stance)
- **±0.1:** Weak signal (tangential mention, unclear)
- **0.0:** No clear ideological information

**Examples:**
```
Article: "Harris announces €1bn welfare increase"
- Direct action: welfare: -0.4 (strong leftward signal)
- Associated: social: -0.1 (moderate signal)

Article: "Harris questions welfare increase timing"
- Questioning: welfare: +0.1 (weak rightward signal)

Article: "Harris mentioned in welfare debate"
- No clear stance: welfare: 0.0 (no signal)
```

### Layer 2: Confidence Multiplier (Evidence Quality)

**Source Reliability:**
- Primary sources (Oireachtas votes, official statements): 1.0x
- Major news (RTÉ, Irish Times, Irish Independent): 0.9x
- Regional news: 0.7x
- Tabloid/opinion: 0.5x
- Social media: 0.3x

**Evidence Type:**
- Voting record: 1.0x
- Direct quote with action: 0.9x
- Reported policy position: 0.7x
- Implied stance: 0.5x
- Second-hand report: 0.3x

**Stance Strength (from analysis):**
- Strength 5 (leading advocate): 1.0x
- Strength 4 (clear position): 0.8x
- Strength 3 (moderate): 0.6x
- Strength 2 (weak): 0.4x
- Strength 1 (implied): 0.2x

**Combined Confidence:**
```typescript
confidence = source_reliability × evidence_type × (stance_strength / 5)
```

**Example:**
```
Article: RTÉ reports Harris announces welfare increase (direct quote, strength 4)
confidence = 0.9 × 0.9 × 0.8 = 0.65
```

### Layer 3: Adaptive Scaling (Portfolio Theory)

**Purpose:** Prevent single articles from dominating, increase confidence gradually

**Formula:**
```typescript
// Base adjustment
rawAdjustment = llm_signal × confidence

// Adaptive scaling based on existing evidence
totalWeight = sum(all previous adjustments for this TD)
scalingFactor = 1 / (1 + Math.log10(1 + totalWeight))

// Direction-specific adjustment (harder to move away from center)
currentValue = td_ideology_profile[dimension]
extremityPenalty = 1 - (Math.abs(currentValue) / 10) * 0.5

// Final adjustment
finalAdjustment = rawAdjustment × scalingFactor × extremityPenalty
```

**Scaling Factor Examples:**
- First article (weight=0): scaling = 1.0 (full impact)
- After 10 articles (weight=5): scaling = 0.56 (56% impact)
- After 50 articles (weight=25): scaling = 0.42 (42% impact)
- After 100 articles (weight=50): scaling = 0.37 (37% impact)

**Extremity Penalty Examples:**
- At center (value=0): penalty = 1.0 (easy to move)
- At ±5: penalty = 0.75 (harder to move)
- At ±8: penalty = 0.6 (much harder to move)
- At ±10: penalty = 0.5 (very hard to move further)

### Layer 4: Time Decay

**Purpose:** More recent evidence is more relevant

**Formula:**
```typescript
daysSinceArticle = (now - article_published_at) / (1000 * 60 * 60 * 24)
decayHalfLife = 180 // 6 months
decayFactor = Math.pow(0.5, daysSinceArticle / decayHalfLife)
```

**Decay Examples:**
- Today: 1.0x
- 3 months ago: 0.71x
- 6 months ago: 0.5x
- 1 year ago: 0.25x
- 2 years ago: 0.06x

**Application:**
```typescript
finalAdjustmentWithDecay = finalAdjustment × decayFactor
```

### Layer 5: Outlier Detection

**Purpose:** Flag suspicious single-article swings

**Criteria:**
- Adjustment > 3× standard deviation of TD's recent adjustments
- Contradicts 80%+ of previous evidence
- Source reliability < 0.5 AND adjustment > 0.2

**Action:**
- Flag for manual review
- Apply additional 0.5x penalty
- Require confirmation from second article

## Complete Formula

```typescript
// Step 1: LLM extracts raw signal (±0.5 max)
rawSignal = llm_ideology_delta[dimension] // e.g., -0.4

// Step 2: Apply confidence multipliers
confidence = source_reliability × evidence_type × (stance_strength / 5)
weightedSignal = rawSignal × confidence

// Step 3: Adaptive scaling
totalWeight = td_profile.total_weight
scalingFactor = 1 / (1 + Math.log10(1 + totalWeight))

currentValue = td_profile[dimension]
extremityPenalty = 1 - (Math.abs(currentValue) / 10) * 0.5

adaptiveSignal = weightedSignal × scalingFactor × extremityPenalty

// Step 4: Time decay
daysSince = (now - article_date) / (1000 * 60 * 60 * 24)
decayFactor = Math.pow(0.5, daysSince / 180)
timedSignal = adaptiveSignal × decayFactor

// Step 5: Outlier check
if (isOutlier(timedSignal, td_history)) {
  timedSignal *= 0.5
  flagForReview(td, article, timedSignal)
}

// Step 6: Apply adjustment
finalAdjustment = clamp(timedSignal, -0.2, +0.2) // Hard cap per article
newValue = clamp(currentValue + finalAdjustment, -10, +10)
```

## Expected Behavior Examples

### Example 1: Strong Welfare Signal (First Article)

```
Article: "Harris announces €1bn welfare increase" (RTÉ, today)

Step 1: LLM Raw Signal
  welfare: -0.4 (strong leftward action)

Step 2: Confidence
  source: 0.9 (RTÉ)
  evidence: 0.9 (direct action)
  stance: 0.8 (strength 4)
  confidence = 0.65
  weighted = -0.4 × 0.65 = -0.26

Step 3: Adaptive Scaling
  totalWeight = 0 (first article)
  scaling = 1.0
  currentValue = 0.5 (Fine Gael baseline)
  extremity = 0.975
  adaptive = -0.26 × 1.0 × 0.975 = -0.25

Step 4: Time Decay
  today = 1.0
  timed = -0.25

Step 5: Outlier Check
  Not outlier (first article)

Step 6: Final
  capped = -0.2 (hard cap)
  newValue = 0.5 + (-0.2) = 0.3

Result: Harris welfare: 0.5 → 0.3 (modest shift)
```

### Example 2: Same Signal, 50 Articles Later

```
Same article content, but now:

totalWeight = 25 (from 50 articles)
scaling = 0.42 (42% of original impact)
currentValue = -2.0 (shifted left from accumulated evidence)
extremity = 0.9

adaptive = -0.26 × 0.42 × 0.9 = -0.10
timed = -0.10
final = -0.10

Result: Harris welfare: -2.0 → -2.1 (smaller shift, profile stabilized)
```

### Example 3: Weak Signal, Unreliable Source

```
Article: "Twitter rumors Harris supports welfare" (social media)

raw = -0.2 (moderate signal)
confidence = 0.3 (social) × 0.3 (rumor) × 0.4 (weak) = 0.04
weighted = -0.2 × 0.04 = -0.008
adaptive = -0.008 × 0.5 × 0.9 = -0.004

Result: Harris welfare: 0.5 → 0.496 (negligible impact)
```

### Example 4: Old Article

```
Article: "Harris supported welfare in 2020" (4 years ago)

raw = -0.4
confidence = 0.65
weighted = -0.26
adaptive = -0.13 (after 50 articles)
daysSince = 1460 (4 years)
decay = 0.5^(1460/180) = 0.006
timed = -0.13 × 0.006 = -0.0008

Result: Harris welfare: -2.0 → -2.0008 (minimal impact from old data)
```

## Convergence Simulation

**Scenario:** TD with true ideology = -3.0 on welfare, starting at party baseline +0.5

```
Article 1:  +0.5 → +0.3  (shift: -0.20)
Article 5:  +0.1 → -0.1  (shift: -0.15)
Article 10: -0.5 → -0.7  (shift: -0.12)
Article 20: -1.5 → -1.6  (shift: -0.09)
Article 50: -2.5 → -2.6  (shift: -0.06)
Article 100: -2.9 → -2.95 (shift: -0.04)
```

**Result:** Converges toward true value, with diminishing adjustments

## Implementation Plan

### Phase 1: Update LLM Prompt ✓
- Change scale from ±2 to ±0.5
- Provide clearer examples
- Emphasize signal strength calibration

### Phase 2: Add Source Reliability Metadata
- Create source reliability lookup table
- Classify news sources by tier
- Pass to adjustment function

### Phase 3: Implement Time Decay
- Add article_date to adjustment metadata
- Apply decay factor in `applyAdjustments()`
- Store decay_factor in ideology_events

### Phase 4: Enhance Adaptive Scaling
- Keep existing diminishing returns
- Add extremity penalty
- Add hard cap per article (±0.2 max)

### Phase 5: Outlier Detection
- Track adjustment history per TD
- Flag suspicious swings
- Create review queue

### Phase 6: Testing & Calibration
- Run on historical articles
- Compare with known TD positions
- Tune parameters (half-life, scaling factors)

## Success Metrics

1. **Convergence Speed:** 20-50 articles to stabilize profile
2. **Noise Resistance:** Single outlier < 5% impact on established profile
3. **Accuracy:** Final profiles match expert political analysis
4. **Stability:** Month-to-month changes < 0.5 per dimension
5. **Explainability:** Can trace why TD has specific ideology score

## Configuration Parameters

```typescript
// Tunable parameters for calibration
const IDEOLOGY_CONFIG = {
  llm_max_signal: 0.5,        // Max raw signal from LLM
  article_hard_cap: 0.2,       // Max adjustment per article
  decay_half_life_days: 180,   // 6 months
  scaling_log_base: 10,        // Log base for diminishing returns
  extremity_penalty_rate: 0.5, // Penalty at ±10
  outlier_threshold_sd: 3.0,   // Standard deviations for outlier
  source_tiers: {
    primary: 1.0,    // Oireachtas, official
    major: 0.9,      // RTÉ, Irish Times
    regional: 0.7,   // Local news
    tabloid: 0.5,    // Entertainment news
    social: 0.3      // Twitter, rumors
  }
};
```

## Monitoring & Alerts

1. **Weekly Report:** TD ideology shifts > 1.0 in any dimension
2. **Outlier Log:** Articles flagged for manual review
3. **Convergence Dashboard:** TDs with high variance (unstable profiles)
4. **Source Quality:** Articles with low confidence scores

---

**Status:** Expert plan ready for implementation  
**Next Step:** Update LLM prompt to use ±0.5 scale and add scaling layers  
**Expected Impact:** Realistic, stable TD ideology profiles that converge to true positions

