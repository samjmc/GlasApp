import OpenAI from 'openai';
import { supabaseDb } from '../db';
import {
  POLICY_DOMAINS,
  HIGH_PRIORITY_TOPICS,
  type PolicyDomain,
  normalisePolicyTopic,
} from '../constants/policyTopics';
import { PolicyStanceHarvester } from './policyStanceHarvester';
import { IDEOLOGY_DIMENSIONS, emptyIdeologyVector } from '../constants/ideology';

interface PolicyOpportunityLLMResult {
  should_create: boolean;
  confidence: number;
  policy_domain: PolicyDomain | 'other';
  policy_topic: string;
  question: string;
  answer_options: string[];
  primary_dimension?: string; // NEW: Track which ideology dimension this primarily reveals
  rationale?: string;
  source_hint?: string;
}

interface PolicyOptionVectorLLMResult {
  options: Array<{
    key: string;
    summary?: string;
    ideology_delta?: Record<string, number>;
    confidence?: number;
    weight?: number;
  }>;
}

export interface PolicyOpportunityRecord {
  article_id: number;
  policy_domain: string;
  policy_topic: string;
  question_text: string;
  answer_options: Record<string, string>;
  default_alignment?: Record<string, string[]>;
  primary_dimension?: string; // NEW: Track which ideology dimension this primarily reveals
  confidence?: number;
  rationale?: string;
  source_hint?: string;
}

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OPENAI_API_KEY not set. Skipping policy opportunity generation.');
    return null;
  }
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const CLASSIFICATION_PROMPT = ({
  title,
  content,
  source,
  targetDimension,
}: {
  title: string;
  content: string;
  source: string;
  targetDimension?: string;
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

function mapAnswerOptions(rawOptions: string[]): Record<string, string> {
  const labels = ['option_a', 'option_b', 'option_c', 'option_d'];
  const mapped: Record<string, string> = {};
  rawOptions.slice(0, labels.length).forEach((option, index) => {
    mapped[labels[index]] = option.trim();
  });
  return mapped;
}

function clampVectorValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-2, Math.min(2, value));
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0.1, Math.min(3, value));
}

async function upsertPolicyOptionVectors(
  policyVoteId: number,
  options: { key: string; label: string }[],
  vectorResult: PolicyOptionVectorLLMResult | null,
  baseConfidence?: number,
): Promise<void> {
  if (!supabaseDb) return;

  const vectorMap = new Map<string, PolicyOptionVectorLLMResult['options'][number]>();
  vectorResult?.options?.forEach((option) => {
    if (option?.key) {
      vectorMap.set(option.key, option);
    }
  });

  const defaultConfidence = clampConfidence(baseConfidence ?? 0.6);

  const rows = options.map(({ key }) => {
    const vector = vectorMap.get(key);
    const ideology = emptyIdeologyVector();

    for (const dimension of IDEOLOGY_DIMENSIONS) {
      const raw = Number(vector?.ideology_delta?.[dimension]);
      ideology[dimension] = clampVectorValue(raw);
    }

    return {
      policy_vote_id: policyVoteId,
      option_key: key,
      ...ideology,
      weight: clampWeight(Number(vector?.weight ?? 1)),
      confidence: clampConfidence(Number(vector?.confidence ?? defaultConfidence)),
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabaseDb
    .from('policy_vote_option_vectors')
    .upsert(rows, { onConflict: 'policy_vote_id,option_key' });

  if (error) {
    console.error('⚠️ Failed to upsert policy vote option vectors:', error.message);
  }
}

export interface ArticleForOpportunity {
  id?: number;
  title: string;
  content: string;
  source: string;
  published_date: Date;
}

async function callLLMForOpportunity(
  article: ArticleForOpportunity,
  targetDimension?: string,
): Promise<PolicyOpportunityLLMResult | null> {
  const client = getOpenAIClient();
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an expert at creating unbiased political questions that reveal ideological positions through scenario-based trade-offs. Respond ONLY with valid JSON.',
        },
        {
          role: 'user',
          content: CLASSIFICATION_PROMPT({
            title: article.title,
            content: article.content.slice(0, 2000),
            source: article.source,
            targetDimension,
          }),
        },
      ],
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    const parsed: PolicyOpportunityLLMResult = JSON.parse(content);
    parsed.policy_topic = normalisePolicyTopic(parsed.policy_topic || 'general_policy');
    if (!Object.hasOwn(POLICY_DOMAINS, parsed.policy_domain as PolicyDomain)) {
      parsed.policy_domain = 'other';
    }
    
    // Validate primary_dimension is valid
    if (parsed.primary_dimension && !IDEOLOGY_DIMENSIONS.includes(parsed.primary_dimension as any)) {
      parsed.primary_dimension = undefined;
    }
    
    return parsed;
  } catch (error: any) {
    console.error('❌ Policy opportunity LLM error:', error.message || error);
    return null;
  }
}

async function callLLMForOptionVectors(params: {
  question: string;
  options: { key: string; label: string }[];
  policyDomain: string;
  policyTopic: string;
  primaryDimension?: string;
}): Promise<PolicyOptionVectorLLMResult | null> {
  const client = getOpenAIClient();
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You map policy vote options to ideological axis deltas. These questions are scenario-based, not directive yes/no. Respond ONLY with valid JSON.',
        },
        {
          role: 'user',
          content: OPTION_VECTOR_PROMPT(params),
        },
      ],
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    const parsed: PolicyOptionVectorLLMResult = JSON.parse(content);
    return parsed;
  } catch (error: any) {
    console.error('❌ Policy option vector LLM error:', error.message || error);
    return null;
  }
}

async function upsertPolicyOpportunity(record: PolicyOpportunityRecord): Promise<number | null> {
  if (!supabaseDb) return;

  try {
    const { data, error } = await supabaseDb
      .from('policy_vote_opportunities')
      .upsert(
        {
          article_id: record.article_id,
          policy_domain: record.policy_domain,
          policy_topic: record.policy_topic,
          question_text: record.question_text,
          answer_options: record.answer_options,
          default_alignment: record.default_alignment,
          primary_dimension: record.primary_dimension,
          confidence: record.confidence,
          rationale: record.rationale,
          source_hint: record.source_hint,
        },
        { onConflict: 'article_id' },
      )
      .select('id');

    if (error) throw error;

    if (data && Array.isArray(data) && data.length > 0) {
      return data[0].id as number;
    }

    const { data: existing } = await supabaseDb
      .from('policy_vote_opportunities')
      .select('id')
      .eq('article_id', record.article_id)
      .maybeSingle();

    return existing?.id ?? null;
  } catch (error: any) {
    console.error('❌ Failed to upsert policy opportunity:', error.message);
    return null;
  }
}

function shouldForceCreate(topic: string): boolean {
  return HIGH_PRIORITY_TOPICS.has(topic);
}

/**
 * Question Validation
 * Ensures questions follow scenario-based framing rules
 */
export function validateQuestion(
  question: string,
  options: string[]
): {
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
      const match = question.match(pattern);
      if (match) {
        issues.push(`Question contains directive framing: "${match[0]}"`);
      }
    }
  });

  // Check for scenario-based framing
  const requiredPatterns = [
    /how\s+should/i,
    /what\s+approach/i,
    /which\s+priority/i,
    /when\s+.*\s+which/i,
    /.*\s+requires\s+a\s+choice/i,
    /.*\s+must\s+(fund|choose|prioritize)/i,
    /.*\s+can\s+be\s+(delivered|done|funded|allocated)/i,
  ];

  const hasRequiredFraming = requiredPatterns.some((pattern) => pattern.test(question));
  if (!hasRequiredFraming) {
    issues.push(
      'Question lacks scenario-based framing (should use "How should...", "What approach...", "Which priority...", etc.)'
    );
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

  // Check for option diversity (not just degrees of same thing)
  const optionWords = options.map((opt) =>
    opt
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  const commonWords = new Map<string, number>();
  optionWords.forEach((words) => {
    words.forEach((word) => {
      commonWords.set(word, (commonWords.get(word) || 0) + 1);
    });
  });
  
  // If all options share too many words, they might be too similar
  const allOptionsShareWord = Array.from(commonWords.values()).some((count) => count === options.length);
  if (allOptionsShareWord && options.length >= 3) {
    issues.push('Options may be too similar (all share common words)');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Dimension Distribution Tracking
 * Tracks which ideology dimensions are covered in recent questions
 */

const RECENT_DIMENSION_COUNT = 100; // Last 100 opportunities for distribution tracking

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
  
  // Initialize all dimensions to 0
  IDEOLOGY_DIMENSIONS.forEach((dim) => {
    counts.set(dim, 0);
  });
  counts.set('unknown', 0);

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
  const total = Array.from(distribution.values())
    .filter((count, _index, arr) => {
      // Exclude 'unknown' from average calculation
      return true;
    })
    .reduce((sum, count) => sum + count, 0);
  
  // Calculate average excluding 'unknown'
  const knownDimensions = Array.from(distribution.entries())
    .filter(([dim]) => dim !== 'unknown')
    .map(([, count]) => count);
  const knownTotal = knownDimensions.reduce((sum, count) => sum + count, 0);
  const average = knownTotal > 0 ? knownTotal / IDEOLOGY_DIMENSIONS.length : 0;

  const underrepresented: string[] = [];

  IDEOLOGY_DIMENSIONS.forEach((dim) => {
    const count = distribution.get(dim) || 0;
    if (count < average * 0.8) {
      // 20% below average = underrepresented
      underrepresented.push(dim);
    }
  });

  return underrepresented;
}

async function getTargetDimension(): Promise<string | undefined> {
  try {
    const underrepresented = await getUnderrepresentedDimensions(30);
    if (underrepresented.length > 0) {
      // Return random underrepresented dimension
      return underrepresented[Math.floor(Math.random() * underrepresented.length)];
    }
    return undefined; // Let it distribute naturally
  } catch (error: any) {
    console.error('⚠️ Failed to get target dimension:', error.message);
    return undefined;
  }
}

const DEBATE_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 6; // 6 hours
const lastDebateHarvest = new Map<string, number>();

async function maybeHarvestDebates(policyTopic: string) {
  const now = Date.now();
  const lastRun = lastDebateHarvest.get(policyTopic);
  if (lastRun && now - lastRun < DEBATE_REFRESH_INTERVAL_MS) {
    return;
  }
  lastDebateHarvest.set(policyTopic, now);
  PolicyStanceHarvester.harvestRecentDebates(policyTopic).catch((error: any) => {
    console.error('⚠️ Failed harvesting debates:', error.message || error);
  });
}

interface GenerateOptions {
  force?: boolean;
}

export const PolicyOpportunityService = {
  async generateAndSave(
    articleId: number,
    article: ArticleForOpportunity,
    options: GenerateOptions = {},
  ): Promise<boolean> {
    // Check for underrepresented dimensions to ensure even distribution
    const targetDimension = await getTargetDimension();
    
    if (process.env.NODE_ENV !== 'production' && targetDimension) {
      console.log(`🎯 Targeting underrepresented dimension: ${targetDimension}`);
    }

    const result = await callLLMForOpportunity(article, targetDimension);
    if (!result) return false;

    const policyTopic = result.policy_topic;
    const shouldCreate =
      options.force || result.should_create || shouldForceCreate(policyTopic);
    if (!shouldCreate) {
      return false;
    }

    // Validate question format
    const validation = validateQuestion(result.question, result.answer_options || []);
    if (!validation.isValid) {
      console.warn(`⚠️ Question validation failed: ${validation.issues.join('; ')}`);
      // Still proceed but log the issues
      if (process.env.NODE_ENV !== 'production') {
        console.log('Question:', result.question);
        console.log('Options:', result.answer_options);
      }
    }

    const domainTopics = POLICY_DOMAINS[result.policy_domain as PolicyDomain] || [];
    const topicDefinition =
      domainTopics.find((t) => t.key === policyTopic) ?? domainTopics[0];

    // Use LLM-generated options (should be 3-4 scenario-based options)
    // Remove fallback to yes/no options
    if (!result.answer_options || result.answer_options.length < 3) {
      console.warn(`⚠️ Question has insufficient options (${result.answer_options?.length || 0}), skipping`);
      return false;
    }

    const answerOptions = mapAnswerOptions(result.answer_options);
    const optionEntries = Object.entries(answerOptions).map(([key, label]) => ({
      key,
      label,
    }));

    const opportunityQuestion = result.question;
    
    if (!opportunityQuestion) {
      console.warn('⚠️ Question is empty, skipping');
      return false;
    }

    // Ensure primary_dimension is valid
    const primaryDimension = result.primary_dimension && 
      IDEOLOGY_DIMENSIONS.includes(result.primary_dimension as any)
      ? result.primary_dimension
      : undefined;

    const policyVoteId = await upsertPolicyOpportunity({
      article_id: articleId,
      policy_domain: result.policy_domain,
      policy_topic: policyTopic,
      question_text: opportunityQuestion,
      answer_options: answerOptions,
      default_alignment: topicDefinition?.defaultAlignment,
      primary_dimension: primaryDimension,
      confidence: result.confidence,
      rationale: result.rationale,
      source_hint: result.source_hint,
    });

    if (policyVoteId) {
      const optionVectors = await callLLMForOptionVectors({
        question: opportunityQuestion,
        options: optionEntries,
        policyDomain: result.policy_domain,
        policyTopic,
        primaryDimension,
      });

      await upsertPolicyOptionVectors(policyVoteId, optionEntries, optionVectors, result.confidence);
    }

    await PolicyStanceHarvester.extractFromArticle(articleId, article, policyTopic);
    if (shouldForceCreate(policyTopic)) {
      await maybeHarvestDebates(policyTopic);
    }

    return true;
  },
  
  // Export validation and tracking functions
  validateQuestion,
  getDimensionDistribution,
  getUnderrepresentedDimensions,
};

