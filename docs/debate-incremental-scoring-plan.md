# Debate Incremental Scoring System - Implementation Plan (Revised)

## Overview
Transform the debate scoring system from period-based aggregation to incremental, debate-level tracking where each debate updates a TD's running totals based on **LLM-evaluated performance quality**. Poor performers receive negative scores; strong performers receive positive scores.

## Current System
- Scores calculated per **period** (weekly/rolling windows)
- Stored in `td_debate_metrics` with `period_start`/`period_end`
- Scores aggregated across all debates in that period
- No per-debate contribution tracking
- Outcome classification only identifies winner/runner-up (binary)

## Target System
- **Running totals** per TD (accumulating scores over time, starting at 50.00 baseline)
- **LLM-based performance evaluation** for all participants in each debate
- **Per-debate deltas** (positive for strong performance, negative for poor performance)
- **Composite “Performance” index** exposed in UI, derived from effectiveness & influence (e.g. `performance = 0.6 * effectiveness + 0.4 * influence`)
- **Display**: Current overall scores (performance + sub-metrics) and debate-specific deltas
- **Flexible outcomes**: 
  - One winner + multiple poor performers (all get scored)
  - No winner, everyone performed poorly (all get negative scores)
  - Multiple strong performers (all get positive scores)
- Example: Gary starts at 50/50 → Debate 1: effectiveness +2.5 / influence +1.8 → performance +2.14 → totals 52.5 / 51.8 / performance 52.1 → Debate 2: -1.2 / -0.8 → performance -1.04 → totals 51.3 / 51.0 / performance 51.1

---

## Phase 1: Database Schema Changes

### 1.1 Create `td_debate_running_scores` Table
**Purpose**: Store current running totals for each TD (single row per TD)

```sql
CREATE TABLE td_debate_running_scores (
  id BIGSERIAL PRIMARY KEY,
  td_id INTEGER NOT NULL UNIQUE REFERENCES td_scores(id) ON DELETE CASCADE,
  effectiveness_score NUMERIC(5,2) DEFAULT 50.00 NOT NULL,
  influence_score NUMERIC(5,2) DEFAULT 50.00 NOT NULL,
  performance_score NUMERIC(5,2) DEFAULT 50.00 NOT NULL,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_debate_date DATE,
  metadata JSONB,
  CONSTRAINT valid_effectiveness CHECK (effectiveness_score >= 0 AND effectiveness_score <= 100),
  CONSTRAINT valid_influence CHECK (influence_score >= 0 AND influence_score <= 100),
  CONSTRAINT valid_performance CHECK (performance_score >= 0 AND performance_score <= 100)
);

CREATE INDEX idx_td_debate_running_scores_td_id ON td_debate_running_scores(td_id);
CREATE INDEX idx_td_debate_running_scores_last_updated ON td_debate_running_scores(last_updated_at);
```

### 1.2 Extend `debate_section_outcomes` Table
**Purpose**: Store LLM performance evaluations for all participants (not just winner/runner-up)

```sql
-- Add new columns to existing table
ALTER TABLE debate_section_outcomes 
ADD COLUMN IF NOT EXISTS participant_evaluations JSONB;

-- participant_evaluations structure:
-- [
--   {
--     "td_id": 123,
--     "performance_rating": "strong" | "moderate" | "weak" | "poor",
--     "argument_quality": 0.0-1.0,
--     "relevance_score": 0.0-1.0,
--     "persuasiveness": 0.0-1.0,
--     "factual_accuracy": 0.0-1.0,
--     "rhetorical_effectiveness": 0.0-1.0,
--     "overall_score": 0.0-1.0,
--     "reasoning": "Brief explanation of evaluation"
--   }
-- ]
```

### 1.3 Create `debate_section_score_contributions` Table
**Purpose**: Track per-debate-section score changes for each TD

```sql
CREATE TABLE debate_section_score_contributions (
  id BIGSERIAL PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES debate_sections(id) ON DELETE CASCADE,
  debate_day_id UUID NOT NULL REFERENCES debate_days(id) ON DELETE CASCADE,
  td_id INTEGER NOT NULL REFERENCES td_scores(id) ON DELETE CASCADE,
  
  -- Score before this debate
  effectiveness_score_before NUMERIC(5,2) NOT NULL,
  influence_score_before NUMERIC(5,2) NOT NULL,
  performance_score_before NUMERIC(5,2) NOT NULL,
  
  -- Delta from this debate (can be negative!)
  effectiveness_delta NUMERIC(5,2) NOT NULL DEFAULT 0,
  influence_delta NUMERIC(5,2) NOT NULL DEFAULT 0,
  performance_delta NUMERIC(5,2) NOT NULL DEFAULT 0,
  
  -- Score after this debate
  effectiveness_score_after NUMERIC(5,2) NOT NULL,
  influence_score_after NUMERIC(5,2) NOT NULL,
  performance_score_after NUMERIC(5,2) NOT NULL,
  
  -- LLM evaluation data
  performance_rating TEXT, -- 'strong', 'moderate', 'weak', 'poor'
  argument_quality NUMERIC(3,2), -- 0.00-1.00
  overall_evaluation_score NUMERIC(3,2), -- 0.00-1.00 (from LLM)
  
  -- Contribution factors
  words_spoken INTEGER DEFAULT 0,
  speeches_count INTEGER DEFAULT 0,
  outcome_role TEXT, -- 'winner', 'participant', 'poor_performer'
  
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,
  
  UNIQUE(section_id, td_id)
);

CREATE INDEX idx_debate_score_contributions_section ON debate_section_score_contributions(section_id);
CREATE INDEX idx_debate_score_contributions_td ON debate_section_score_contributions(td_id);
CREATE INDEX idx_debate_score_contributions_debate_day ON debate_section_score_contributions(debate_day_id);
CREATE INDEX idx_debate_score_contributions_calculated ON debate_section_score_contributions(calculated_at);
CREATE INDEX idx_debate_score_contributions_rating ON debate_section_score_contributions(performance_rating);
```

### 1.4 Initialize Running Scores
**Purpose**: Set initial scores for all TDs (default 50.00/50.00)

```sql
INSERT INTO td_debate_running_scores (td_id, effectiveness_score, influence_score, performance_score)
SELECT id, 50.00, 50.00, 50.00
FROM td_scores
ON CONFLICT (td_id) DO NOTHING;
```

---

## Phase 2: LLM-Based Performance Evaluation

### 2.1 Create `scripts/evaluate-debate-participants.ts`
**Purpose**: Use LLM to evaluate all participants' performance in a debate section

**Key Logic**:
1. For each debate section:
   - Load section summary, all speeches, and participant list
   - Send to LLM with evaluation prompt
   - LLM returns performance ratings for ALL participants (not just winner/runner-up)

**LLM Prompt Structure**:
```
You are evaluating parliamentary debate performance. Analyze each participant's contributions:

Section Summary: [summary]
Participants and their speeches:
- TD Name (Party): [speech excerpts]
- TD Name (Party): [speech excerpts]
...

For EACH participant, evaluate:
1. Argument Quality: Were their points well-reasoned and substantive?
2. Relevance: Did they address the topic directly?
3. Persuasiveness: How convincing were their arguments?
4. Factual Accuracy: Were their claims accurate?
5. Rhetorical Effectiveness: How well did they communicate?

Rate each participant as:
- "strong": Excellent arguments, clear points, persuasive (score 0.8-1.0)
- "moderate": Decent arguments but room for improvement (score 0.5-0.79)
- "weak": Poor arguments, unclear points, unconvincing (score 0.3-0.49)
- "poor": Very poor performance, factually incorrect, irrelevant (score 0.0-0.29)

Return JSON array with evaluation for each participant:
[
  {
    "td_id": 123,
    "td_name": "Name",
    "performance_rating": "strong",
    "argument_quality": 0.85,
    "relevance_score": 0.90,
    "persuasiveness": 0.80,
    "factual_accuracy": 0.95,
    "rhetorical_effectiveness": 0.85,
    "overall_score": 0.87,
    "reasoning": "Made compelling points about X and Y, with clear evidence..."
  }
]
```

**Integration**:
- Run after `processDebateSummaries.ts` (need summaries)
- Run after speeches are loaded
- Store results in `debate_section_outcomes.participant_evaluations`

### 2.2 Update `scripts/generate-debate-outcomes.ts`
**Purpose**: Modify to include participant evaluations in outcome generation

**Changes**:
- Call LLM evaluation function before determining winner
- Use evaluation scores to inform winner selection
- Store `participant_evaluations` JSONB in outcome record
- Winner can be null if everyone performed poorly

---

## Phase 3: Per-Debate Score Calculation Logic

### 3.1 Create `scripts/calc-debate-section-contributions.ts`
**Purpose**: Calculate score deltas for each TD based on LLM performance evaluation

**Key Logic**:
1. For each debate section:
   - Load current running scores for all participating TDs
   - Load LLM performance evaluations from `debate_section_outcomes.participant_evaluations`
   - For each TD:
     - Get their evaluation (or default to "moderate" if missing)
     - Calculate deltas based on performance rating + evaluation scores
     - Update running scores: `new_score = old_score + delta`
     - Store contribution record

**Delta Calculation Formulas**:

```typescript
// Weighting configuration (tunable)
const EFFECTIVENESS_WEIGHT = 0.6;
const INFLUENCE_WEIGHT = 0.4;

// Base delta from LLM overall_score (0.0-1.0)
// Map to -5.0 to +5.0 range
const baseDelta = (overallScore - 0.5) * 10.0; // -5.0 to +5.0

// Performance rating multipliers
const ratingMultiplier = {
  'strong': 1.2,      // Boost strong performers
  'moderate': 0.8,    // Slight reduction for moderate
  'weak': 0.5,        // Reduce weak performers
  'poor': 0.2         // Minimal positive, mostly negative
};

// Influence Delta Calculation
const wordsContribution = Math.min(wordsSpoken / 10000, 1) * 2.0; // Max +2
const speechesContribution = Math.min(speechesCount / 20, 1) * 1.0; // Max +1
const topicsContribution = Math.min(uniqueTopics / 5, 1) * 1.0; // Max +1
const sentimentContribution = (sentimentScore + 1) / 2 * 1.0; // Max +1

// Base influence from activity
const activityInfluence = wordsContribution + speechesContribution + topicsContribution + sentimentContribution;

// Performance-adjusted influence delta
const influenceDelta = baseDelta * ratingMultiplier[performanceRating] * 0.4 + 
                       activityInfluence * (overallScore > 0.5 ? 1 : 0.5);

// Effectiveness Delta Calculation
const outcomeBonus = 
  outcomeRole === 'winner' ? 2.0 :
  outcomeRole === 'participant' ? 0.0 :
  -1.0; // poor_performer

// Base effectiveness from evaluation
const evaluationEffectiveness = baseDelta * ratingMultiplier[performanceRating] * 0.6;

// Final effectiveness delta
const effectivenessDelta = evaluationEffectiveness + outcomeBonus + 
                          (argumentQuality - 0.5) * 1.0; // Quality adjustment

// Clamp deltas to reasonable ranges
const clampedInfluenceDelta = Math.max(-3.0, Math.min(5.0, influenceDelta));
const clampedEffectivenessDelta = Math.max(-3.0, Math.min(5.0, effectivenessDelta));

// Composite performance delta (UI headline)
const performanceDelta =
  clampedEffectivenessDelta * EFFECTIVENESS_WEIGHT +
  clampedInfluenceDelta * INFLUENCE_WEIGHT;

// Updated scores (clamped 0-100)
const newEffectiveness = clamp(effectivenessBefore + clampedEffectivenessDelta, 0, 100);
const newInfluence = clamp(influenceBefore + clampedInfluenceDelta, 0, 100);
const newPerformance = clamp(
  performanceBefore + performanceDelta,
  0,
  100
);
```

**Scoring Scenarios**:

1. **Strong Winner + Poor Performers**:
   - Winner: +3.5 effectiveness, +2.8 influence
   - Poor performers: -1.5 effectiveness, -0.8 influence each

2. **All Poor Performance**:
   - Everyone: -1.0 to -2.0 effectiveness, -0.5 to -1.0 influence
   - No winner assigned

3. **Multiple Strong Performers**:
   - All strong: +2.0 to +3.0 effectiveness, +1.5 to +2.5 influence
   - Winner gets additional +1.0 bonus

4. **Mixed Performance**:
   - Strong: +2.5/+2.0
   - Moderate: +0.5/+0.3
   - Weak: -0.5/-0.3
   - Poor: -1.5/-0.8

**Constraints**:
- Deltas typically range from -3.0 to +5.0 per debate
- Running scores clamped between 0-100
- Negative deltas are common and expected for poor performance

---

## Phase 4: Update Highlights Display

### 4.1 Modify `server/routes/debatesRoutes.ts`
**Purpose**: Fetch running scores + debate deltas for highlights

**Changes**:
- Query `td_debate_running_scores` for current overall scores
- Query `debate_section_score_contributions` for debate-specific deltas
- Include performance ratings in response
- Return both in highlights response:
  ```typescript
  participants: [{
    tdId: number,
    name: string,
    // Current overall scores
    effectivenessScore: number,
    influenceScore: number,
    performanceScore: number,
    // Debate-specific deltas (can be negative!)
    effectivenessDelta: number,
    influenceDelta: number,
    performanceDelta: number,
    // Performance evaluation
    performanceRating: 'strong' | 'moderate' | 'weak' | 'poor',
    overallEvaluationScore: number
  }]
  ```

### 4.2 Update `client/src/pages/DebatesPage.tsx`
**Purpose**: Display current scores + deltas in UI

**Display Format**:
```
Performance: 52.1 (+2.1)   ← Composite score & delta
Effectiveness: 52.5 (+2.5) ← Sub-metric (optional drill-down)
Influence: 51.8 (+1.8)     ← Sub-metric (optional drill-down)
Performance rating: Strong ← LLM label
```

**Visual Indicators**:
- Green for positive deltas (+X.X)
- Red for negative deltas (-X.X)
- Gray for no change (0.00)
- Performance badges: 🟢 Strong, 🟡 Moderate, 🟠 Weak, 🔴 Poor

**Grouping**:
- Show all participants, not just winner/runner-up
- Group by performance rating
- Highlight winners separately

---

## Phase 5: Migration & Backfill

### 5.1 Migration Script: `scripts/migrate-to-incremental-scoring.ts`
**Purpose**: Convert existing period-based data to incremental system

**Steps**:
1. Initialize all TDs with 50.00/50.00 in `td_debate_running_scores`
2. For each debate (chronologically, oldest first):
   - Load debate section
   - **Run LLM evaluation** for all participants (if not already done)
   - Calculate contributions for each TD based on evaluations
   - Update running scores incrementally
   - Store contribution records
3. Verify: Final running scores should approximate latest period scores

**Note**: This will require re-running LLM evaluations for all historical debates, which may be expensive. Consider:
- Running evaluations in batches
- Caching results
- Processing most recent debates first

### 5.2 Validation
- Compare final running scores vs latest `td_debate_metrics` period
- Check that deltas sum correctly
- Verify no score exceeds 0-100 bounds
- Verify negative deltas are applied correctly

---

## Phase 6: Update Calculation Pipeline

### 6.1 New Script Execution Order
```
1. fetch-oireachtas-debate-week.ts (ingest debates)
2. processDebateSummaries.ts (summarize sections)
3. evaluate-debate-participants.ts (NEW - LLM evaluation of all participants)
4. generate-debate-outcomes.ts (determine winner, uses evaluations)
5. calc-debate-section-contributions.ts (NEW - calculate deltas from evaluations)
6. calc-debate-metrics.ts (period aggregation - optional, for historical analysis)
```

### 6.2 Keep Period-Based Metrics
- Keep `td_debate_metrics` for historical trend analysis
- Incremental system runs in parallel
- Both systems can coexist

---

## Phase 7: API & Frontend Updates

### 7.1 Update Highlights Endpoint
**Purpose**: Include all participants with their performance ratings and deltas

```typescript
GET /api/debates/highlights
Response: {
  highlights: [{
    // ... existing fields
    participants: [
      {
        tdId: 123,
        name: "TD Name",
        performanceScore: 52.1,
        effectivenessScore: 52.5,
        influenceScore: 51.8,
        performanceDelta: +2.1,
        effectivenessDelta: +2.5,  // Can be negative!
        influenceDelta: +1.8,      // Can be negative!
        performanceRating: "strong",
        overallEvaluationScore: 0.87,
        outcomeRole: "winner" | "participant" | "poor_performer"
      }
    ]
  }]
}
```

### 7.2 Update TD Profile Page
**Purpose**: Show score history as incremental changes with performance context

- Display composite performance trajectory as the primary sparkline
- Provide optional toggle/drill-down for effectiveness vs influence contributions
- Show "Score progression" with debate-by-debate changes + performance badges
- Color-code by performance rating and highlight negative deltas prominently

---

## Implementation Checklist

### Database
- [ ] Create `td_debate_running_scores` table
- [ ] Add `participant_evaluations` column to `debate_section_outcomes`
- [ ] Create `debate_section_score_contributions` table
- [ ] Initialize running scores for all TDs
- [ ] Add indexes for performance

### Scripts
- [ ] Create `evaluate-debate-participants.ts` (LLM evaluation)
- [ ] Update `generate-debate-outcomes.ts` to use evaluations
- [ ] Create `calc-debate-section-contributions.ts` (delta calculation)
- [ ] Implement negative delta logic
- [ ] Create migration/backfill script
- [ ] Update script execution order

### API
- [ ] Update highlights endpoint to include all participants
- [ ] Include performance ratings and negative deltas
- [ ] Create new `/api/debates/td/:id/scores` endpoint
- [ ] Update leaderboard to use running scores

### Frontend
- [ ] Update highlights display (current score + delta, including negative)
- [ ] Add performance rating badges
- [ ] Show all participants, not just winner/runner-up
- [ ] Update TD profile page with delta timeline
- [ ] Add visual indicators for negative scores

### Testing
- [ ] Test LLM evaluation on sample debates
- [ ] Verify negative deltas are calculated correctly
- [ ] Test scenarios: all poor, mixed, all strong
- [ ] Verify running scores accumulate correctly
- [ ] Test migration script on existing data
- [ ] Validate score bounds (0-100)

---

## Considerations

### LLM Evaluation Quality
- Evaluation prompt must be clear and consistent
- Consider using GPT-4 for better quality (vs GPT-4o-mini for cost)
- May need prompt engineering to ensure consistent ratings
- Consider human review of evaluations for calibration

### Negative Score Handling
- Scores can go below 0? (Currently clamped to 0-100)
- Consider floor (e.g., minimum 10.0) vs allowing 0.0
- Poor performers will accumulate negative deltas
- May need "recovery" mechanism for TDs who improve

### Score Bounds
- Current: 0-100 range enforced
- Consider: Should scores decay over time if inactive?
- Or: Keep scores stable until next debate?

### Delta Scaling
- Current formulas are estimates - will need tuning
- May need to adjust based on:
  - Debate size (large debates = larger deltas?)
  - Debate importance (major bills = larger deltas?)
  - Number of participants (more participants = smaller individual deltas?)

### Cost Considerations
- LLM evaluation for all participants will increase API costs
- Consider batching evaluations
- Cache evaluations to avoid re-running
- May want to evaluate only major debates initially

### Performance
- Running scores table is small (one row per TD)
- Contributions table will grow - add partitioning by date?
- Indexes on `td_id`, `section_id`, `debate_day_id`, `performance_rating`

### Backward Compatibility
- Keep `td_debate_metrics` for historical period analysis
- New system runs in parallel initially
- Can deprecate period system later if desired

---

## Next Steps

1. **Start with Phase 1**: Create database tables
2. **Build Phase 2**: Implement LLM evaluation script
3. **Test evaluation quality**: Verify LLM ratings make sense
4. **Build Phase 3**: Implement delta calculation with negative scoring
5. **Test on sample data**: Verify calculations for all scenarios
6. **Phase 4**: Update highlights display
7. **Phase 5**: Migrate existing data (with LLM re-evaluation)
8. **Phase 6**: Integrate into pipeline
9. **Phase 7**: Update all frontend displays
