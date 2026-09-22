/**
 * Turning a news article into a policy question. Pure: prompts, parsing and assembly.
 * The model calls and the database write live in service.ts.
 *
 * Two model calls make a question. The first decides whether the article supports a
 * scenario-based question and writes it. The second places each answer on the eight
 * ideology axes. A question is only saved when every option has a position, because an
 * option with no position would silently record nothing when chosen.
 */
import { z } from 'zod';
import { IDEOLOGY_DIMENSIONS, type IdeologyDimension } from '../constants/ideology';
import {
  HIGH_PRIORITY_TOPICS,
  POLICY_DOMAINS,
  normalisePolicyTopic,
  type PolicyDomain,
} from '../constants/policyTopics';
import { OPTION_KEYS, type OptionKey } from '@shared/voting';
import type { NewPolicyQuestion, NewPolicyQuestionOption } from '@shared/schema/voting';

/** What question generation needs from an article. */
export interface QuestionArticle {
  id: number;
  title: string;
  content: string;
  source: string;
  publishedAt: Date | null;
  url: string | null;
  imageUrl: string | null;
  summary: string | null;
}

export type OptionVector = Record<IdeologyDimension, number>;

export interface ParsedQuestion {
  shouldCreate: boolean;
  confidence: number | null;
  domain: PolicyDomain;
  topic: string;
  question: string;
  options: Array<{ key: OptionKey; label: string }>;
  primaryDimension: IdeologyDimension | null;
  rationale: string | null;
}

export interface ParsedOptionPosition {
  vector: OptionVector;
  weight: number;
  confidence: number | null;
}

/** The model is asked for 3–4 options; content past this is not needed to write one. */
const ARTICLE_CONTENT_LIMIT = 2000;
const VECTOR_LIMIT = 2;
const WEIGHT_MIN = 0.1;
const WEIGHT_MAX = 3;
/** Below this share of the mean, an axis counts as under-asked. */
const UNDERREPRESENTED_RATIO = 0.8;

const isDimension = (value: unknown): value is IdeologyDimension =>
  typeof value === 'string' && (IDEOLOGY_DIMENSIONS as readonly string[]).includes(value);

const isDomain = (value: string): value is PolicyDomain =>
  Object.prototype.hasOwnProperty.call(POLICY_DOMAINS, value);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const finiteOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export function questionPrompt(article: QuestionArticle, targetDimension?: IdeologyDimension): string {
  return `
You are an expert at creating unbiased political questions that reveal ideological positions through scenario-based trade-offs.

CRITICAL: Your questions must NOT be directive. They must present scenarios, constraints, or trade-offs that force users to reveal their methodological preferences.

Article meta:
- Source: ${article.source}
- Title: ${article.title}

Key content:
${article.content.slice(0, ARTICLE_CONTENT_LIMIT)}

${targetDimension ? `Target dimension: ${targetDimension} (prioritize questions that reveal this dimension)` : ''}

Your task:
1. Decide if this article can become a scenario-based ideological question
2. Identify the PRIMARY policy domain, one of: ${Object.keys(POLICY_DOMAINS).join(', ')}
3. Identify the SPECIFIC topic within that domain
4. Create a SCENARIO-BASED question (NOT directive)

QUESTION FRAMING RULES:

FORBIDDEN FRAMINGS: "Should the Government...", "Should Ireland...", "Should we...", "Do you support...", "Do you agree..."

REQUIRED FRAMINGS (choose based on article):
- "How should [constraint/scenario] be handled?"
- "A [constraint] exists. What approach feels right?"
- "When [scenario], which priority should come first?"
- "[Constraint] requires a choice. Which path aligns with your values?"

QUESTION TYPES:
1. TRADE-OFF SCENARIO, for budgets and priorities. Example: "A €3bn surplus can fund infrastructure, social supports, tax relief, or reserves. Which is your priority?"
2. METHOD/APPROACH, for a problem needing a solution; focus on HOW. Example: "Energy prices spike 40%. Should we cap prices, target rebates, reward conservation, or trust markets?"
3. CONSTRAINT-BASED, for delivery mechanisms. Example: "A €10bn rail upgrade can be PPP, state-owned, hybrid, or deferred. Which approach?"
4. VALUES IN CONFLICT, for competing values. Example: "Asylum capacity is strained. Should we expand capacity, tighten criteria, expand community housing, or pause applications?"

OPTION DESIGN RULES. Each question MUST have 3-4 options that:
- Represent different ideological approaches (not degrees of the same approach)
- Are all reasonable choices a thoughtful person could make
- Reveal different dimensions (economic, social, welfare, globalism, etc.)
- Use plain language, no jargon, and no obvious "good" or "bad" option

${targetDimension ? `PRIORITY: Create options that primarily reveal the ${targetDimension} dimension.` : ''}

Return strict JSON:
{
  "should_create": true|false,
  "confidence": 0-1,
  "policy_domain": "one of the domains above",
  "policy_topic": "specific_topic_slug",
  "question": "Your scenario-based question",
  "answer_options": ["Option 1", "Option 2", "Option 3", "Option 4 (optional)"],
  "primary_dimension": "${IDEOLOGY_DIMENSIONS.join('|')}",
  "rationale": "Why this question reveals ideological positions"
}

If the article cannot be turned into a scenario-based ideological question, set should_create=false.
`.trim();
}

export function vectorPrompt(question: {
  question: string;
  options: Array<{ key: string; label: string }>;
  domain: string;
  topic: string;
  primaryDimension: IdeologyDimension | null;
}): string {
  return `
You map answer options for an Irish policy vote question onto eight ideology axes.

These questions are SCENARIO-BASED, not directive yes/no questions. They reveal methodological preferences, not simple policy support.

Policy domain: ${question.domain}
Policy topic: ${question.topic}
Question: ${question.question}
${question.primaryDimension ? `Primary dimension: ${question.primaryDimension}` : ''}

Options:
${question.options.map((option) => `- ${option.key}: ${option.label}`).join('\n')}

For each option, estimate how choosing it reveals the user's position on each axis (scale -2 to +2, 0 = says nothing about that axis):
- economic: Market-based (positive) vs Collective/public ownership (negative)
- social: Traditional/conservative (positive) vs Progressive/liberal (negative)
- cultural: Nationalist/Irish-first (positive) vs Multicultural/open (negative)
- authority: Authoritarian/strong state (positive) vs Libertarian/minimal state (negative)
- environmental: Pro-business/growth (positive) vs Pro-climate/protection (negative)
- welfare: Decrease welfare/self-reliance (positive) vs Increase welfare/state support (negative)
- globalism: National preservation (positive) vs Global integration/openness (negative)
- technocratic: Populist/democratic (positive) vs Expert-led (negative)

MAPPING GUIDELINES:
1. Trade-offs: infrastructure/public works -> economic negative, authority positive; social supports -> welfare negative, social negative; tax relief -> economic positive, welfare positive; reserves -> economic positive, technocratic negative.
2. Methods: universal -> welfare negative, authority positive; targeted -> economic positive, technocratic negative; market-based -> economic positive, authority negative.
3. Delivery: public/state -> economic negative, authority positive; private/market -> economic positive, authority negative; hybrid -> mixed; defer -> economic positive, technocratic positive.
4. Values in conflict: expand/open -> globalism negative, cultural negative; tighten/restrict -> globalism positive, cultural positive, authority positive; community/consultation -> social negative, technocratic negative.

${question.primaryDimension ? `Ensure at least one option strongly maps to the ${question.primaryDimension} dimension.` : ''}

Return strict JSON with an entry for EVERY option key:
{
  "options": [
    {
      "key": "option_a",
      "ideology_delta": { ${IDEOLOGY_DIMENSIONS.map((d) => `"${d}": 0.0`).join(', ')} },
      "confidence": 0.85,
      "weight": 1.2
    }
  ]
}

Rules: values between -2 and +2; spread options across DIFFERENT dimensions; confidence 0-1; weight 0.1-3.0 (how strongly the option expresses its stance).
`.trim();
}

// ---------------------------------------------------------------------------
// Parsing model output. Anything malformed returns null rather than a guess.
// ---------------------------------------------------------------------------

const questionSchema = z.object({
  should_create: z.boolean(),
  confidence: z.unknown().optional(),
  policy_domain: z.string(),
  policy_topic: z.string(),
  question: z.string(),
  answer_options: z.array(z.string()),
  primary_dimension: z.unknown().optional(),
  rationale: z.unknown().optional(),
});

/** Parse the first call. Null when it is malformed or has too few distinct options. */
export function parseQuestion(raw: unknown): ParsedQuestion | null {
  const parsed = questionSchema.safeParse(raw);
  if (!parsed.success) return null;
  const value = parsed.data;

  const question = value.question.trim();
  const labels = value.answer_options.map((label) => label.trim()).filter(Boolean);
  const distinct = new Set(labels.map((label) => label.toLowerCase()));
  if (!question || labels.length < 3 || distinct.size !== labels.length) return null;

  const confidence = finiteOrNull(value.confidence);
  const domain = value.policy_domain.trim().toLowerCase();

  return {
    shouldCreate: value.should_create,
    confidence: confidence === null ? null : clamp(confidence, 0, 1),
    domain: isDomain(domain) ? domain : 'other',
    topic: normalisePolicyTopic(value.policy_topic || 'general_policy'),
    question,
    options: labels.slice(0, OPTION_KEYS.length).map((label, index) => ({ key: OPTION_KEYS[index]!, label })),
    primaryDimension: isDimension(value.primary_dimension) ? value.primary_dimension : null,
    rationale: typeof value.rationale === 'string' && value.rationale.trim() ? value.rationale.trim() : null,
  };
}

const vectorSchema = z.object({
  options: z.array(
    z.object({
      key: z.string(),
      ideology_delta: z.record(z.unknown()).optional(),
      confidence: z.unknown().optional(),
      weight: z.unknown().optional(),
    }),
  ),
});

/**
 * Parse the second call. Null unless EVERY expected option has a position: a missing one
 * would otherwise be stored as all zeros and look like a real, neutral answer.
 */
export function parseOptionPositions(
  raw: unknown,
  expectedKeys: readonly string[],
): Map<string, ParsedOptionPosition> | null {
  const parsed = vectorSchema.safeParse(raw);
  if (!parsed.success) return null;

  const byKey = new Map<string, ParsedOptionPosition>();
  for (const option of parsed.data.options) {
    if (!expectedKeys.includes(option.key) || !option.ideology_delta) continue;
    const vector = {} as OptionVector;
    for (const dimension of IDEOLOGY_DIMENSIONS) {
      const value = finiteOrNull(option.ideology_delta[dimension]);
      vector[dimension] = value === null ? 0 : clamp(value, -VECTOR_LIMIT, VECTOR_LIMIT);
    }
    const weight = finiteOrNull(option.weight);
    const confidence = finiteOrNull(option.confidence);
    byKey.set(option.key, {
      vector,
      weight: weight === null ? 1 : clamp(weight, WEIGHT_MIN, WEIGHT_MAX),
      confidence: confidence === null ? null : clamp(confidence, 0, 1),
    });
  }

  return expectedKeys.every((key) => byKey.has(key)) ? byKey : null;
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

/** Create when the model says so, when forced, or when the topic is always worth asking. */
export function shouldCreateQuestion(question: ParsedQuestion, force = false): boolean {
  return force || question.shouldCreate || HIGH_PRIORITY_TOPICS.has(question.topic);
}

/**
 * The axis to steer the next question toward: a random one among those asked less than
 * 80% as often as the mean over recent questions. Undefined when coverage is even.
 */
export function pickTargetDimension(
  recentCounts: Partial<Record<IdeologyDimension, number>>,
  random: () => number = Math.random,
): IdeologyDimension | undefined {
  const total = IDEOLOGY_DIMENSIONS.reduce((sum, d) => sum + (recentCounts[d] ?? 0), 0);
  if (total === 0) return undefined;
  const mean = total / IDEOLOGY_DIMENSIONS.length;
  const under = IDEOLOGY_DIMENSIONS.filter((d) => (recentCounts[d] ?? 0) < mean * UNDERREPRESENTED_RATIO);
  if (under.length === 0) return undefined;
  return under[Math.min(under.length - 1, Math.floor(random() * under.length))];
}

/** The rows to insert for one question. */
export function assembleQuestion(
  article: QuestionArticle,
  question: ParsedQuestion,
  positions: Map<string, ParsedOptionPosition>,
): { question: NewPolicyQuestion; options: Array<Omit<NewPolicyQuestionOption, 'questionId'>> } {
  return {
    question: {
      articleId: article.id,
      question: question.question,
      policyDomain: question.domain,
      policyTopic: question.topic,
      primaryDimension: question.primaryDimension,
      confidence: question.confidence,
      rationale: question.rationale,
      headline: article.title,
      summary: article.summary,
      articleUrl: article.url,
      imageUrl: article.imageUrl,
      publishedAt: article.publishedAt,
    },
    options: question.options.map((option, index) => {
      const position = positions.get(option.key)!;
      return {
        optionKey: option.key,
        label: option.label,
        position: index,
        ...position.vector,
        weight: position.weight,
        confidence: position.confidence,
      };
    }),
  };
}
