# Ideology Scoring Systems Comparison: Articles vs Debates

## Overview

Both systems use the same multi-layer scoring framework but have key differences in signal quality and processing.

## Shared Framework

### Core Principles
- ✅ Multi-layer scoring (7 layers)
- ✅ Same ideology dimensions (8 axes)
- ✅ Same adaptive scaling (diminishing returns)
- ✅ Same time decay (180-day half-life)
- ✅ Same extremity penalty
- ✅ Same hard cap (±0.2 per update)
- ✅ Same convergence behavior

### Shared Components
- `td_ideology_profiles` table (same storage)
- `TDIdeologyProfileService.applyAdjustments()` (same function)
- `td_ideology_events` table (same tracking, different `sourceType`)

## Key Differences

| Aspect | Articles | Debates |
|--------|----------|---------|
| **Source Type** | Secondary (reported) | Primary (official record) |
| **Source Reliability** | 0.7-0.9 (news source quality) | 0.95 (official record) |
| **Content Format** | Short quotes/reports | Full speeches |
| **Content Length** | 50-200 words typical | 200-1000 words typical |
| **Context Available** | Limited (article context) | Full (debate topic, role, timing) |
| **Interpretation Needed** | Yes (reported vs direct) | No (TD's own words) |
| **Signal Quality** | Lower (secondary source) | Higher (primary source) |
| **LLM Signal Range** | ±0.5 max (same) | ±0.5 max (same) |
| **Typical Signal** | ±0.05 to ±0.15 | ±0.08 to ±0.20 |
| **Convergence Speed** | 20-50 articles | 15-30 speeches |
| **Processing Frequency** | Daily (news scraper) | Incremental (debate analysis) |
| **Victim Protection** | ✅ Yes (threats, etc.) | N/A (always TD's own words) |
| **Consistency Check** | Basic (via policy topics) | Advanced (same-topic comparison) |

## Scoring Formula Comparison

### Articles Formula
```typescript
effectiveWeight = (stance_strength/5) × confidence × sourceReliability
weightedSignal = llmSignal × effectiveWeight × timeDecay × adaptiveScaling × extremityPenalty
finalAdjustment = clamp(weightedSignal × directionPenalty, -0.2, +0.2)
```

### Debates Formula
```typescript
effectiveWeight = lengthWeight × roleWeight × statementStrength × speechTypeWeight
weightedSignal = llmSignal × effectiveWeight × timeDecay × adaptiveScaling × extremityPenalty
finalAdjustment = clamp(weightedSignal × consistencyPenalty, -0.2, +0.2)
```

**Key Difference:** Debates have `consistencyPenalty` (check for contradictions) while articles have `directionPenalty` (harder toward extremes).

## Quality Weighting Differences

### Articles
- **Stance Strength** (1-5): Based on how strongly TD advocated (reported)
- **Confidence** (0.6-1.0): AI analysis quality
- **Source Reliability** (0.3-0.9): News source quality

### Debates
- **Speech Length** (0-1): Based on word count (more words = more detailed)
- **Speaker Role** (0.6-1.0): Minister vs Opposition vs Backbencher
- **Statement Strength** (1-5): Same as articles
- **Speech Type** (0.2-1.0): Opening vs Intervention vs Procedural

**Advantage of Debates:** More granular weighting based on actual speech characteristics (length, role, type), not just reported interpretation.

## Expected Impact Comparison

### Single Update Impact

| Type | Typical Range | Maximum | Rationale |
|------|--------------|---------|-----------|
| **Articles** | ±0.05 to ±0.15 | ±0.2 | Secondary source, limited context |
| **Debates** | ±0.08 to ±0.20 | ±0.2 | Primary source, full context |

**Debates have higher typical impact** because:
- Primary source (more reliable)
- Longer content (more information)
- Full context (better understanding)

### Convergence Timeline

**Articles:**
- 0-10 articles: Rapid establishment (±0.1-0.2 per article)
- 10-30 articles: Refinement (±0.05-0.1 per article)
- 30-60 articles: Stabilization (±0.03-0.06 per article)
- 60+ articles: Maintenance (±0.01-0.04 per article)

**Debates:**
- 0-5 speeches: Rapid establishment (±0.1-0.2 per speech)
- 5-15 speeches: Refinement (±0.05-0.1 per speech)
- 15-30 speeches: Stabilization (±0.03-0.06 per speech)
- 30+ speeches: Maintenance (±0.01-0.04 per speech)

**Debates converge faster** because each speech contains more reliable information.

## Combined System Behavior

### Total Weight Accumulation
```typescript
totalWeight = articleWeights + debateWeights
```

**Both systems contribute to same total_weight:**
- Adaptive scaling uses combined weight
- Both slow down as profile stabilizes
- Faster convergence with both sources

### Example: TD with Both Sources

```
Article 1: welfare -0.12 (weight: 0.5)
Speech 1:  welfare -0.18 (weight: 0.8)
Total weight: 1.3

Article 2: welfare -0.10 (weight: 0.5, scaling: 0.75)
Speech 2:  welfare -0.15 (weight: 0.8, scaling: 0.75)
Total weight: 2.6

After 20 combined updates (10 articles + 10 speeches):
- Total weight: ~13
- Adaptive scaling: 0.5x
- Profile stabilizing: ±0.05 adjustments typical
```

**Combined system converges faster** than either alone.

## Consistency Tracking (Debates Advantage)

### Articles
- Basic consistency check via policy topics
- Limited ability to detect contradictions
- Relies on policy stance extraction

### Debates
- **Advanced consistency tracking:**
  - Compare to previous statements on same topic
  - Detect contradictions within 180 days
  - Apply consistency penalty (0.5×)
  - Flag for manual review
  - Allow evolution over time (>180 days)

**Example:**
```
Month 1: TD says "welfare too high" (welfare: +0.2)
Month 2: TD says "welfare needs increase" (welfare: -0.3)
→ Contradiction detected
→ Consistency penalty: 0.5×
→ Both statements count, but reduced impact
→ Flagged for review
```

## Victim Protection (Articles Only)

### Articles
- ✅ Protected: TDs as victims (threats, attacks)
- ✅ Protected: No information about TD actions
- ✅ Must be neutral (0 impact) when TD takes no action

### Debates
- N/A: TDs always express their own views
- Always actionable: TD's own words
- No victim scenarios: TD is always the actor

**Articles need victim protection**, debates don't.

## Processing Strategy

### Articles
- **Batch processing:** Daily scraper runs
- **High volume:** 50-100 articles per day
- **Filtering:** Political articles only
- **Priority:** Recent articles first

### Debates
- **Incremental processing:** As debates become available
- **Lower volume:** 10-30 speeches per day (depends on parliament activity)
- **No filtering needed:** All speeches are ideological statements
- **Priority:** Recent debates, important topics first

## Database Schema

### Shared Tables
- `td_ideology_profiles` - Same storage
- `td_ideology_events` - Same tracking (different `sourceType`)

### Articles-Specific
- `article_td_scores` - Article analysis results
- `td_policy_stances` - Policy positions extracted from articles

### Debates-Specific (To Be Created)
- `debate_ideology_analysis` - Speech analysis results
- `debate_ideology_history` - Previous positions for consistency checking

## Example: Same TD, Different Sources

**Scenario:** Simon Harris on welfare expansion

### Article Analysis
```
Article: "Harris announces €1bn welfare increase" (RTÉ, today)
LLM Signal: welfare: -0.4
Effective Weight: 0.58 (stance 4 × confidence 0.8 × source 0.9)
After all factors: -0.13
Result: welfare: 2.0 → 1.87 (Δ -0.13)
```

### Debate Analysis
```
Speech: Minister announces welfare increase (600 words, opening statement, today)
LLM Signal: welfare: -0.4
Effective Weight: 0.80 (length 1.0 × role 1.0 × strength 0.8 × type 1.0)
After all factors: -0.18
Result: welfare: 2.0 → 1.82 (Δ -0.18)
```

**Same signal, higher impact** from debate because:
- Primary source (0.95 vs 0.9 reliability)
- Longer content (full speech vs reported quote)
- Better context (debate topic vs article context)

## Success Metrics (Both Systems)

| Metric | Articles Target | Debates Target |
|--------|----------------|----------------|
| **Convergence Speed** | 20-50 articles | 15-30 speeches |
| **Noise Resistance** | Single outlier < 5% impact | Single outlier < 5% impact |
| **Accuracy** | Match expert analysis | Match expert analysis |
| **Stability** | <0.5 change/month (after convergence) | <0.5 change/month (after convergence) |
| **Source Quality** | High-quality sources 2-3× impact | Primary source 1.5-2× vs articles |

## Combined System Advantages

### 1. Faster Convergence
- Both sources contribute evidence
- Reaches stable profile sooner
- More accurate early estimates

### 2. Better Coverage
- Articles: Public actions, policy announcements
- Debates: Parliamentary positions, detailed stances
- Together: Complete picture of TD ideology

### 3. Cross-Validation
- Compare article positions vs debate positions
- Detect discrepancies (flag for review)
- Validate consistency across sources

### 4. Robustness
- Reduces reliance on single source
- Balances short articles with long speeches
- Accounts for different contexts

## Implementation Priority

### Phase 1: Article System ✅
- ✅ Complete and operational
- ✅ Party baselines working
- ✅ Multi-layer scoring implemented
- ✅ Victim protection active

### Phase 2: Debate System 🔄
- 🔄 Data science plan complete
- ⏳ Service implementation needed
- ⏳ LLM prompt design needed
- ⏳ Consistency tracking needed
- ⏳ Database schema needed

### Phase 3: Integration 🔄
- ⏳ Combined weight accumulation
- ⏳ Cross-validation checks
- ⏳ Unified reporting dashboard

---

**Status:** Article system operational, Debate system planned  
**Next Steps:** Implement debate ideology analysis service  
**Timeline:** 1-2 weeks for full debate system implementation  
**Expected Impact:** 30-50% faster convergence, better accuracy, complete TD ideology tracking

