# Policy Vote Question Redesign - Implementation Plan

## Problem Statement

Current policy vote questions use directive framing ("Should the Government do X?") which creates a "yes bias" - users tend to want government action on everything (policing, money, housing crisis, etc.). This doesn't reveal their true ideological positions and doesn't help build accurate user profiles.

**Current Issues:**
1. ❌ Directive framing: "Should the Government..."
2. ❌ Yes bias: Users say yes to everything
3. ❌ No ideological differentiation: All users want more action
4. ❌ Dimension imbalance: Too focused on welfare and authority dimensions
5. ❌ Doesn't expose trade-offs or priorities

**Goal:**
Replicate the enhanced quiz approach with nuanced questions that expose ideological thinking without biased framing. Questions should cut through bias and reveal true stances while ensuring even distribution across all 8 ideology dimensions.

---

## Solution Overview

Transform policy vote questions from directive "Should..." questions to scenario-based "How should..." questions that:
1. Present real-world constraints and trade-offs
2. Force choices between competing values
3. Expose ideological differences through method preferences
4. Ensure even distribution across 8 ideology dimensions
5. Use unbiased framing that reveals true stances

---

## 8 Ideology Dimensions

We need to ensure questions evenly cover all dimensions:

1. **Economic** - Market vs Collective approaches
2. **Social** - Traditional vs Progressive values
3. **Cultural** - Nationalism vs Multiculturalism
4. **Authority** - Authoritarian vs Libertarian
5. **Environmental** - Pro-business vs Pro-climate
6. **Welfare** - Increase vs Decrease welfare spending
7. **Globalism** - Global integration vs National preservation
8. **Technocratic** - Expert-led vs Populist decision-making

**Current Problem:** Over-indexing on welfare and authority dimensions.

---

## Question Framing Strategies

### Strategy 1: Trade-Off Scenarios
Present constrained choices where users must prioritize:

**Bad (Current):**
> "Should the Government increase spending on housing?"

**Good (Redesigned):**
> "A €3bn budget surplus must fund one priority. Which should it be?"

**Options:**
- Accelerate national infrastructure (transport, housing) even if debt rises short-term
- Expand targeted social supports (healthcare relief, income floors)
- Deliver broad-based tax relief to households and SMEs
- Bank funds in a resilience reserve for future shocks

**Why it works:** Forces prioritization, reveals economic/welfare preferences without directive framing.

---

### Strategy 2: Method/Approach Questions
Focus on HOW rather than WHETHER:

**Bad (Current):**
> "Should the Government reduce asylum seeker accommodation costs?"

**Good (Redesigned):**
> "Wholesale energy prices spike 40% overnight. What intervention feels right?"

**Options:**
- Impose universal price cap funded by borrowing (shield everyone)
- Offer targeted rebates for low-income homes only (protect vulnerable)
- Keep market prices but tier tariffs to reward conservation
- Avoid distortion, allow prices to settle, help via income supports

**Why it works:** Reveals approach preference (universal vs targeted, intervention vs market) without yes/no bias.

---

### Strategy 3: Constraint-Based Questions
Present scenarios with real constraints:

**Bad (Current):**
> "Should the Government do more about the housing crisis?"

**Good (Redesigned):**
> "A €10bn rail upgrade can be delivered via private partnerships or the exchequer. How should it be done?"

**Options:**
- Use regulated PPP so private operators build and run services under state oversight
- Borrow and build entirely through state agency (keep ownership public)
- Run hybrid: state constructs core lines, specialists operate add-ons under contract
- Defer project, focus on smaller upgrades until fiscal space grows

**Why it works:** Reveals public/private preference, economic philosophy, and risk tolerance.

---

### Strategy 4: Values in Conflict
Present competing values directly:

**Bad (Current):**
> "Should the Government increase immigration controls?"

**Good (Redesigned):**
> "Asylum accommodation capacity is at breaking point. How should Ireland respond?"

**Options:**
- Increase capacity via emergency legislation and temporary facilities (accept more arrivals)
- Tighten asylum criteria and accelerate processing (fewer but faster decisions)
- Expand community-based accommodation with local consultation (balance capacity and integration)
- Pause new applications until capacity is built (temporary halt)

**Why it works:** Reveals globalism/cultural dimensions, shows approach to conflict resolution.

---

## Question Design Principles

### 1. Neutral Framing
- ✅ Use: "How should...", "What approach...", "Which priority..."
- ❌ Avoid: "Should the Government...", "Should we..."

### 2. Present Constraints
- ✅ Include: Budget limits, time constraints, trade-offs
- ❌ Avoid: Open-ended "do more" scenarios

### 3. Multiple Valid Options
- ✅ 3-4 options that reasonable people could choose
- ❌ Avoid: Obvious "right" answer

### 4. Reveal Methodology
- ✅ Focus on approach (universal vs targeted, public vs private)
- ❌ Avoid: Simple yes/no on policy existence

### 5. Dimension Coverage
- ✅ Ensure options map to different ideology dimensions
- ❌ Avoid: All options testing the same dimension

### 6. Real-World Context
- ✅ Use specific scenarios with concrete details
- ❌ Avoid: Abstract "should we do more" questions

---

## Implementation Plan

### Phase 1: Update LLM Prompts (Priority 1)

**File:** `server/services/policyOpportunityService.ts`

#### Step 1.1: Redesign CLASSIFICATION_PROMPT

**Current Prompt Issues:**
- Instructs: "Draft a neutral, concise YES/NO style question (e.g. 'Should the Government …?')"
- Creates directive questions

**New Prompt Structure:**

```typescript
const CLASSIFICATION_PROMPT = ({
  title,
  content,
  source,
  targetDimension, // NEW: Ensure dimension diversity
}: {
  title: string;
  content: string;
  source: string;
  targetDimension?: string; // Optional dimension to prioritize
}): string => `
You are an expert at creating unbiased political questions that reveal ideological positions through scenario-based trade-offs.

CRITICAL: Your questions must NOT be directive. They must present scenarios, constraints, or trade-offs that force users to reveal their methodological preferences.

Article meta:
- Source: ${source}
- Title: ${title}

Key content:
${content}

${targetDimension ? `Target dimension: ${targetDimension} (prioritize questions that reveal this dimension)` : ''}

Your task:
1. Decide if this article can become a scenario-based ideological question
2. Identify the PRIMARY policy domain (housing, health, economy, climate, immigration, justice, education, foreign_policy, etc.)
3. Identify the SPECIFIC topic within that domain
4. Create a SCENARIO-BASED question (NOT directive)

QUESTION FRAMING RULES:

❌ FORBIDDEN FRAMINGS:
- "Should the Government..."
- "Should Ireland..."
- "Should we..."
- "Do you support..."
- "Do you agree..."

✅ REQUIRED FRAMINGS (choose based on article):
- "How should [constraint/scenario] be handled?"
- "A [constraint] exists. What approach feels right?"
- "When [scenario], which priority should come first?"
- "[Constraint] requires a choice. Which path aligns with your values?"

QUESTION TYPES (use based on article content):

1. TRADE-OFF SCENARIO: "A €X budget must fund one priority. Which should it be?"
   - Use when article mentions budgets, spending, priorities
   - Force users to choose between competing values
   - Example: "A €3bn surplus can fund infrastructure, social supports, tax relief, or reserves. Which is your priority?"

2. METHOD/APPROACH: "[Problem] exists. What intervention feels right?"
   - Use when article presents a problem needing a solution
   - Focus on HOW (universal vs targeted, public vs private)
   - Example: "Energy prices spike 40%. Should we cap prices, target rebates, reward conservation, or trust markets?"

3. CONSTRAINT-BASED: "[Constraint] requires delivery. How should it be done?"
   - Use when article mentions delivery mechanisms
   - Reveal public/private, expert/populist preferences
   - Example: "A €10bn rail upgrade can be PPP, state-owned, hybrid, or deferred. Which approach?"

4. VALUES IN CONFLICT: "[Conflict] exists. How should Ireland respond?"
   - Use when article presents competing values or goals
   - Reveal globalism, cultural, social preferences
   - Example: "Asylum capacity is strained. Should we expand capacity, tighten criteria, expand community housing, or pause applications?"

OPTION DESIGN RULES:

Each question MUST have 3-4 options that:
- Represent different ideological approaches (not just degrees of the same approach)
- Are all reasonable choices a thoughtful person could make
- Reveal different dimensions (economic, social, welfare, globalism, etc.)
- Use plain language (no jargon)
- Are balanced (no obvious "good" or "bad" option)

OPTION MAPPING TO DIMENSIONS:

Ensure options map to different ideology dimensions:
- Economic dimension: Market vs collective approaches
- Social dimension: Traditional vs progressive values  
- Cultural dimension: Nationalism vs multiculturalism
- Authority dimension: Authoritarian vs libertarian
- Environmental dimension: Pro-business vs pro-climate
- Welfare dimension: Increase vs decrease welfare
- Globalism dimension: Global integration vs national preservation
- Technocratic dimension: Expert-led vs populist

${targetDimension ? `
PRIORITY: Create options that primarily reveal the ${targetDimension} dimension.
` : ''}

Return strict JSON:
{
  "should_create": true|false,
  "confidence": 0-1,
  "policy_domain": "housing|health|economy|climate|immigration|justice|education|foreign_policy|...",
  "policy_topic": "specific_topic_slug",
  "question": "Your scenario-based question (NOT 'Should the Government...')",
  "answer_options": [
    "Option 1 - clear, balanced, reveals one ideological approach",
    "Option 2 - different approach, reveals different dimension",
    "Option 3 - third approach, covers another dimension",
    "Option 4 - optional, if article supports it"
  ],
  "primary_dimension": "economic|social|cultural|authority|environmental|welfare|globalism|technocratic",
  "rationale": "Why this question reveals ideological positions",
  "source_hint": "Context for stance mining"
}

QUALITY CHECKLIST:
- [ ] Question is NOT directive ("Should...")
- [ ] Question presents a scenario, constraint, or trade-off
- [ ] Options represent different ideological approaches
- [ ] At least 2-3 different dimensions are tested across options
- [ ] All options are reasonable choices
- [ ] Language is clear and unbiased

If the article cannot be turned into a scenario-based ideological question, set should_create=false.
`.trim();
```

#### Step 1.2: Add Dimension Tracking

Add dimension tracking to ensure even distribution:

```typescript
interface PolicyOpportunityLLMResult {
  should_create: boolean;
  confidence: number;
  policy_domain: PolicyDomain | 'other';
  policy_topic: string;
  question: string;
  answer_options: string[];
  primary_dimension?: string; // NEW: Track which dimension this reveals
  rationale?: string;
  source_hint?: string;
}
```

#### Step 1.3: Update Dimension Distribution Logic

Add function to track dimension distribution and prioritize underrepresented dimensions:

```typescript
// Track recent dimension distribution
const RECENT_DIMENSION_COUNT = 100; // Last 100 opportunities
const dimensionCounts = new Map<string, number>();

async function getTargetDimension(): Promise<string | undefined> {
  // Query recent policy opportunities to see dimension distribution
  const { data: recent } = await supabaseDb
    .from('policy_vote_opportunities')
    .select('primary_dimension')
    .order('created_at', { ascending: false })
    .limit(RECENT_DIMENSION_COUNT);

  // Count dimensions
  const counts = new Map<string, number>();
  recent?.forEach((opp) => {
    const dim = opp.primary_dimension || 'unknown';
    counts.set(dim, (counts.get(dim) || 0) + 1);
  });

  // Find underrepresented dimensions (below average)
  const average = RECENT_DIMENSION_COUNT / 8; // 8 dimensions
  const underrepresented: string[] = [];

  IDEOLOGY_DIMENSIONS.forEach((dim) => {
    const count = counts.get(dim) || 0;
    if (count < average * 0.8) {
      // 20% below average = underrepresented
      underrepresented.push(dim);
    }
  });

  // Return random underrepresented dimension (or undefined for natural distribution)
  if (underrepresented.length > 0) {
    return underrepresented[Math.floor(Math.random() * underrepresented.length)];
  }

  return undefined; // Let it distribute naturally
}
```

---

### Phase 2: Update Answer Option Generation (Priority 1)

**File:** `server/services/policyOpportunityService.ts`

#### Step 2.1: Improve Option Vector Mapping Prompt

The option vector mapping prompt needs to better understand the new question types:

```typescript
const OPTION_VECTOR_PROMPT = ({
  question,
  options,
  policyDomain,
  policyTopic,
  primaryDimension,
}: {
  question: string;
  options: { key: string; label: string }[];
  policyDomain: string;
  policyTopic: string;
  primaryDimension?: string;
}): string => `
You map answer options for an Irish policy vote question onto eight ideology axes.

CRITICAL: These questions are SCENARIO-BASED, not directive yes/no questions. They reveal methodological preferences, not simple policy support.

Policy domain: ${policyDomain}
Policy topic: ${policyTopic}
Question: ${question}
${primaryDimension ? `Primary dimension: ${primaryDimension}` : ''}

Options:
${options.map((option) => `- ${option.key}: ${option.label}`).join('\n')}

For each option, estimate how choosing it reveals the user's position on these axes (scale -2 to +2, 0 = neutral/no change):

IDEOLOGY DIMENSIONS:
- economic: Market-based (positive) vs Collective/public ownership (negative)
- social: Traditional/conservative (positive) vs Progressive/liberal (negative)
- cultural: Nationalist/Irish-first (positive) vs Multicultural/open (negative)
- authority: Authoritarian/strong state (positive) vs Libertarian/minimal state (negative)
- environmental: Pro-business/growth (positive) vs Pro-climate/protection (negative)
- welfare: Decrease welfare/self-reliance (positive) vs Increase welfare/state support (negative)
- globalism: National preservation/isolation (positive) vs Global integration/openness (negative)
- technocratic: Populist/democratic (positive) vs Expert-led/elite (negative)

MAPPING GUIDELINES:

1. Trade-Off Questions (budgets, priorities):
   - Infrastructure/public works → economic: negative, welfare: positive, authority: positive
   - Social supports → welfare: negative, social: negative
   - Tax relief → economic: positive, welfare: positive
   - Reserve/savings → economic: positive, technocratic: negative

2. Method Questions (universal vs targeted):
   - Universal programs → welfare: negative, authority: positive
   - Targeted programs → economic: positive, technocratic: negative
   - Market-based → economic: positive, authority: negative
   - Income supports → welfare: negative, social: negative

3. Approach Questions (public vs private):
   - Public/state → economic: negative, authority: positive, welfare: negative
   - Private/market → economic: positive, authority: negative, technocratic: positive
   - Hybrid → neutral/mixed across dimensions
   - Defer/status quo → economic: positive, technocratic: positive

4. Values in Conflict:
   - Expand capacity/open → globalism: negative, cultural: negative, welfare: negative
   - Tighten/restrict → globalism: positive, cultural: positive, authority: positive
   - Community/consultation → social: negative, cultural: mixed, technocratic: negative
   - Pause/temporary → authority: positive, technocratic: negative

${primaryDimension ? `
PRIORITY: Ensure at least one option strongly maps to the ${primaryDimension} dimension.
` : ''}

Return strict JSON:
{
  "options": [
    {
      "key": "option_a",
      "summary": "One sentence explaining what this option represents ideologically",
      "ideology_delta": {
        "economic": -1.2,
        "social": -0.5,
        "cultural": -0.3,
        "authority": 0.0,
        "environmental": 1.1,
        "welfare": -0.4,
        "globalism": -0.9,
        "technocratic": 0.2
      },
      "confidence": 0.85,
      "weight": 1.2
    }
  ]
}

Rules:
- Provide entry for EVERY option key (option_a, option_b, option_c, option_d if present)
- Keep ideology_delta values between -2 and +2
- Ensure options map to DIFFERENT dimensions (don't cluster all in one dimension)
- Confidence: 0-1 (how sure are you about this mapping?)
- Weight: 0.1-3.0 (how strongly does this option express the stance?)
`.trim();
```

---

### Phase 3: Dimension Distribution Tracking (Priority 2)

#### Step 3.1: Add Database Field

**Migration:** Add `primary_dimension` field to `policy_vote_opportunities` table:

```sql
ALTER TABLE policy_vote_opportunities
ADD COLUMN primary_dimension text;

-- Index for dimension queries
CREATE INDEX idx_policy_vote_opportunities_dimension 
ON policy_vote_opportunities(primary_dimension);
```

#### Step 3.2: Track Distribution

Add service to track and report dimension distribution:

```typescript
// server/services/policyOpportunityService.ts

export async function getDimensionDistribution(
  lookbackDays: number = 30
): Promise<Map<string, number>> {
  if (!supabaseDb) return new Map();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  const { data } = await supabaseDb
    .from('policy_vote_opportunities')
    .select('primary_dimension')
    .gte('created_at', cutoff.toISOString());

  const counts = new Map<string, number>();
  
  IDEOLOGY_DIMENSIONS.forEach((dim) => {
    counts.set(dim, 0);
  });

  data?.forEach((opp) => {
    const dim = opp.primary_dimension || 'unknown';
    counts.set(dim, (counts.get(dim) || 0) + 1);
  });

  return counts;
}

export async function getUnderrepresentedDimensions(
  lookbackDays: number = 30
): Promise<string[]> {
  const distribution = await getDimensionDistribution(lookbackDays);
  const total = Array.from(distribution.values()).reduce((sum, count) => sum + count, 0);
  const average = total / IDEOLOGY_DIMENSIONS.length;

  const underrepresented: string[] = [];

  IDEOLOGY_DIMENSIONS.forEach((dim) => {
    const count = distribution.get(dim) || 0;
    if (count < average * 0.8) {
      // 20% below average
      underrepresented.push(dim);
    }
  });

  return underrepresented;
}
```

#### Step 3.3: Integrate into Generation

Update `generateAndSave` to prioritize underrepresented dimensions:

```typescript
export const PolicyOpportunityService = {
  async generateAndSave(
    articleId: number,
    article: ArticleForOpportunity,
    options: GenerateOptions = {},
  ): Promise<boolean> {
    // Check for underrepresented dimensions
    const underrepresented = await getUnderrepresentedDimensions(30);
    const targetDimension = underrepresented.length > 0
      ? underrepresented[Math.floor(Math.random() * underrepresented.length)]
      : undefined;

    const result = await callLLMForOpportunity(article, targetDimension);
    // ... rest of implementation
  },
};
```

---

### Phase 4: Question Type Examples Database (Priority 2)

Create a reference database of good question patterns to guide LLM:

```typescript
// server/constants/questionPatterns.ts

export interface QuestionPattern {
  type: 'tradeoff' | 'method' | 'constraint' | 'values';
  domain: PolicyDomain;
  template: string;
  exampleOptions: string[];
  dimensionsTested: IdeologyDimension[];
}

export const QUESTION_PATTERNS: QuestionPattern[] = [
  {
    type: 'tradeoff',
    domain: 'economy',
    template: 'A €{amount} budget {constraint} must fund one priority. Which should it be?',
    exampleOptions: [
      'Accelerate infrastructure even if debt rises short-term',
      'Expand targeted social supports for vulnerable households',
      'Deliver broad-based tax relief to stimulate private investment',
      'Bank funds in reserve for future shocks',
    ],
    dimensionsTested: ['economic', 'welfare', 'technocratic'],
  },
  {
    type: 'method',
    domain: 'economy',
    template: '{Problem} occurs. What intervention feels right?',
    exampleOptions: [
      'Impose universal {solution} funded by borrowing',
      'Offer targeted {solution} for {vulnerable_group} only',
      'Keep market prices but {incentive} to reward {behavior}',
      'Avoid distortion, allow {market_force}, help via {alternative}',
    ],
    dimensionsTested: ['economic', 'welfare', 'authority'],
  },
  // ... more patterns
];
```

---

### Phase 5: Quality Assurance & Testing (Priority 3)

#### Step 5.1: Question Quality Validator

Add function to validate generated questions:

```typescript
function validateQuestion(question: string, options: string[]): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for forbidden framings
  const forbiddenPatterns = [
    /should\s+(the\s+)?government/i,
    /should\s+(ireland|we|they)/i,
    /do\s+you\s+support/i,
    /do\s+you\s+agree/i,
  ];

  forbiddenPatterns.forEach((pattern) => {
    if (pattern.test(question)) {
      issues.push(`Question contains directive framing: "${question.match(pattern)?.[0]}"`);
    }
  });

  // Check for scenario-based framing
  const requiredPatterns = [
    /how\s+should/i,
    /what\s+approach/i,
    /which\s+priority/i,
    /when\s+.*\s+which/i,
    /.*\s+requires\s+a\s+choice/i,
  ];

  const hasRequiredFraming = requiredPatterns.some((pattern) => pattern.test(question));
  if (!hasRequiredFraming) {
    issues.push('Question lacks scenario-based framing (should use "How should...", "What approach...", etc.)');
  }

  // Check option diversity
  if (options.length < 3) {
    issues.push('Question has fewer than 3 options (need more diversity)');
  }

  // Check for yes/no pattern in options
  const yesNoPattern = /^(yes|no|agree|disagree|support|oppose)/i;
  const hasYesNoOptions = options.some((opt) => yesNoPattern.test(opt.trim()));
  if (hasYesNoOptions) {
    issues.push('Options contain yes/no patterns (should be method/approach descriptions)');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
```

#### Step 5.2: Backfill Existing Questions

Create script to regenerate existing questions with new framing:

```typescript
// server/scripts/regeneratePolicyQuestions.ts

export async function regeneratePolicyQuestions(
  batchSize: number = 10
): Promise<void> {
  // Fetch articles with old-style questions
  const { data: articles } = await supabaseDb
    .from('news_articles')
    .select(`
      id,
      title,
      content,
      source,
      published_date,
      policy_vote_opportunities!inner(question_text)
    `)
    .ilike('policy_vote_opportunities.question_text', 'Should%')
    .limit(batchSize);

  for (const article of articles || []) {
    // Regenerate with new approach
    await PolicyOpportunityService.generateAndSave(article.id, {
      id: article.id,
      title: article.title,
      content: article.content,
      source: article.source,
      published_date: new Date(article.published_date),
    }, { force: true });
  }
}
```

---

### Phase 6: Frontend Updates (Priority 3)

#### Step 6.1: Update Display Component

**File:** `client/src/components/PolicyVotePrompt.tsx`

Update to handle new question formats (should work with existing structure, but verify).

#### Step 6.2: Add Question Preview Tool

Create admin tool to preview and validate generated questions before saving:

```typescript
// server/routes/admin/policyQuestionPreview.ts

router.post('/preview', async (req, res) => {
  const { article } = req.body;
  const result = await callLLMForOpportunity(article);
  const validation = validateQuestion(result.question, result.answer_options);
  
  res.json({
    question: result.question,
    options: result.answer_options,
    primary_dimension: result.primary_dimension,
    validation,
  });
});
```

---

## Example Transformations

### Example 1: Housing Crisis

**Old (Bad):**
> Q: "Should the Government increase social housing targets for 2026?"  
> A: Yes / No

**New (Good):**
> Q: "A €5bn housing fund can be allocated to one approach. Which should it prioritize?"  
> Options:
> - Accelerate public housing construction even if it requires state land acquisition
> - Expand cost-rental partnerships with approved housing bodies
> - Target first-time buyer grants and shared equity schemes
> - Focus on vacancy activation and renovation grants

**Dimensions Revealed:** Economic (public vs private), Welfare (targeted vs universal), Authority (state control)

---

### Example 2: Immigration

**Old (Bad):**
> Q: "Should Ireland increase asylum seeker accommodation capacity?"  
> A: Yes / No

**New (Good):**
> Q: "Asylum accommodation capacity is at breaking point with 1,000 people in emergency facilities. How should Ireland respond?"  
> Options:
> - Increase capacity via emergency legislation and temporary facilities (accept more arrivals)
> - Tighten asylum criteria and accelerate processing (fewer but faster decisions)
> - Expand community-based accommodation with local consultation (balance capacity and integration)
> - Pause new applications until permanent capacity is built (temporary halt)

**Dimensions Revealed:** Globalism, Cultural, Authority, Welfare

---

### Example 3: Climate

**Old (Bad):**
> Q: "Should the Government accelerate its climate targets?"  
> A: Yes / No

**New (Good):**
> Q: "Wholesale energy prices spike 40% overnight while climate targets require emissions cuts. What approach balances both priorities?"  
> Options:
> - Impose universal price cap funded by borrowing (protect everyone from price shock)
> - Offer targeted rebates for low-income homes only (protect vulnerable, keep price signals)
> - Keep market prices but tier tariffs to reward conservation and retrofit investment
> - Allow prices to settle naturally, help via income supports instead of price intervention

**Dimensions Revealed:** Economic, Environmental, Welfare, Authority

---

## Testing Strategy

### Unit Tests

1. **Question Validation Tests:**
   - Reject questions with "Should the Government..."
   - Accept questions with "How should...", "What approach..."
   - Validate option diversity (3-4 options)
   - Reject yes/no options

2. **Dimension Mapping Tests:**
   - Verify options map to different dimensions
   - Ensure primary_dimension is correctly identified
   - Test underrepresented dimension detection

3. **Pattern Matching Tests:**
   - Test question pattern recognition
   - Verify template application
   - Check option generation from patterns

### Integration Tests

1. **End-to-End Generation:**
   - Generate question from article
   - Validate question format
   - Verify dimension distribution tracking
   - Test dimension prioritization

2. **Backfill Script:**
   - Regenerate old questions
   - Verify new format is applied
   - Check dimension tracking updates

### Manual Review Process

1. **Sample Review:**
   - Review 20-30 generated questions manually
   - Check for bias, clarity, dimension coverage
   - Refine prompts based on issues

2. **A/B Testing:**
   - Show old vs new questions to test users
   - Measure response diversity (are answers more varied?)
   - Measure ideological profile accuracy

---

## Success Metrics

### Question Quality

1. **Framing Compliance:**
   - ✅ 100% of questions use scenario-based framing
   - ✅ 0% contain "Should the Government..."
   - ✅ 100% present trade-offs or constraints

2. **Dimension Distribution:**
   - ✅ Each dimension appears in 10-15% of questions (balanced)
   - ✅ No dimension > 20% or < 5%
   - ✅ Last 100 questions evenly distributed

3. **Option Diversity:**
   - ✅ Average 3.5 options per question
   - ✅ Options map to 2-3 different dimensions
   - ✅ No yes/no options

### User Behavior

1. **Response Diversity:**
   - ✅ User votes more evenly distributed across options (not 80% "yes")
   - ✅ Different user segments choose different options
   - ✅ Options receive meaningful vote shares (each > 10%)

2. **Ideological Profile Accuracy:**
   - ✅ User profiles show more nuanced positions
   - ✅ Profiles differentiate users better
   - ✅ Profiles align with enhanced quiz results

---

## Implementation Timeline

### Week 1: Core Implementation
- ✅ Update CLASSIFICATION_PROMPT with new framing rules
- ✅ Update OPTION_VECTOR_PROMPT with dimension mapping
- ✅ Add primary_dimension tracking
- ✅ Test with 10-20 articles

### Week 2: Dimension Distribution
- ✅ Add dimension distribution tracking
- ✅ Integrate underrepresented dimension prioritization
- ✅ Test distribution over 100+ questions

### Week 3: Quality Assurance
- ✅ Add question validation function
- ✅ Create backfill script for existing questions
- ✅ Manual review of 50+ generated questions
- ✅ Refine prompts based on issues

### Week 4: Testing & Deployment
- ✅ Unit tests for validation
- ✅ Integration tests for generation
- ✅ A/B test with users
- ✅ Deploy to production
- ✅ Monitor metrics

---

## Files to Modify

1. **`server/services/policyOpportunityService.ts`**
   - Update `CLASSIFICATION_PROMPT`
   - Update `OPTION_VECTOR_PROMPT`
   - Add dimension tracking functions
   - Add question validation

2. **`server/constants/policyTopics.ts`**
   - Update `examplePrompts` to show new formats
   - Add question patterns if needed

3. **`supabase/migrations/YYYYMMDD_add_primary_dimension.sql`**
   - Add `primary_dimension` column
   - Add index

4. **`server/scripts/regeneratePolicyQuestions.ts`** (NEW)
   - Script to backfill old questions

5. **`server/scripts/validateQuestionQuality.ts`** (NEW)
   - Script to validate existing questions

---

## Risk Mitigation

### Risk 1: LLM Doesn't Follow New Format
**Mitigation:**
- Add strict validation in prompt
- Implement validation function
- Reject questions that don't meet criteria
- Fine-tune prompt based on failures

### Risk 2: Question Quality Degrades
**Mitigation:**
- Manual review of samples
- A/B testing before full rollout
- Rollback capability to old prompts
- Gradual rollout (10% → 50% → 100%)

### Risk 3: Dimension Distribution Still Unbalanced
**Mitigation:**
- Active prioritization of underrepresented dimensions
- Weekly monitoring reports
- Manual curation of underrepresented topics
- Fallback to manual question generation for gaps

---

## Next Steps

1. **Immediate (This Week):**
   - Review and approve this plan
   - Update CLASSIFICATION_PROMPT in `policyOpportunityService.ts`
   - Test with 5-10 articles manually

2. **Short Term (Next 2 Weeks):**
   - Implement dimension tracking
   - Add validation function
   - Generate 50+ questions for review

3. **Medium Term (Next Month):**
   - Full implementation
   - Backfill existing questions
   - A/B testing with users
   - Production deployment

---

**Last Updated:** 2025-01-27  
**Status:** Ready for Implementation  
**Priority:** High

