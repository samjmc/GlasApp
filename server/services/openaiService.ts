import dotenv from "dotenv";
import { callChatCompletion, callEmbedding } from "./aiService.js";

// Make sure environment variables are loaded
dotenv.config();

// All outbound AI calls route through aiService (retry/timeout/logging).

export interface QuickExplainerInput {
  headline: string;
  summary?: string;
  issueCategory: string;
  region: string;
  todayIso?: string | null;
  maxChars?: {
    one_sentence?: number;
    bullet?: number;
  };
}

export interface QuickExplainerResult {
  one_sentence: string;
  pros: [string, string];
  cons: [string, string];
}

const POSITIVE_KEYWORDS = [
  "support",
  "boost",
  "benefit",
  "improve",
  "protect",
  "relief",
  "increase",
  "opportunity",
  "progress",
  "help",
  "strengthen",
];

const NEGATIVE_KEYWORDS = [
  "concern",
  "risk",
  "critic",
  "warn",
  "cost",
  "fear",
  "oppose",
  "damage",
  "reduce",
  "undermine",
  "controvers",
  "burden",
  "delay",
];

function truncateText(text: string, max: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}…`;
}

function sentenceSplit(summary?: string | null): string[] {
  if (!summary) return [];
  return summary
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function classifySentence(sentence: string) {
  const lower = sentence.toLowerCase();
  const posScore = POSITIVE_KEYWORDS.reduce(
    (score, keyword) => (lower.includes(keyword) ? score + 1 : score),
    0
  );
  const negScore = NEGATIVE_KEYWORDS.reduce(
    (score, keyword) => (lower.includes(keyword) ? score + 1 : score),
    0
  );

  if (posScore > negScore) return "positive";
  if (negScore > posScore) return "negative";
  return "neutral";
}

function buildFallbackQuickExplainer(
  input: QuickExplainerInput,
  oneSentenceMax: number,
  bulletMax: number
): QuickExplainerResult {
  const region = input.region || "Ireland";
  const issueCategory = input.issueCategory || "the issue";
  const sentences = sentenceSplit(input.summary);

  const positives: string[] = [];
  const negatives: string[] = [];
  const neutrals: string[] = [];

  sentences.forEach((sentence) => {
    const sentiment = classifySentence(sentence);
    if (sentiment === "positive") positives.push(sentence);
    else if (sentiment === "negative") negatives.push(sentence);
    else neutrals.push(sentence);
  });

  const proTexts: string[] = [];
  const conTexts: string[] = [];

  positives.forEach((s) => {
    if (proTexts.length < 2) proTexts.push(truncateText(s, bulletMax));
  });
  negatives.forEach((s) => {
    if (conTexts.length < 2) conTexts.push(truncateText(s, bulletMax));
  });

  neutrals.forEach((s) => {
    if (proTexts.length < 2) proTexts.push(truncateText(s, bulletMax));
    else if (conTexts.length < 2) conTexts.push(truncateText(s, bulletMax));
  });

  const fallbackPros = [
    `Supporters say it tackles ${issueCategory.toLowerCase()} priorities in ${region}.`,
    `Backers argue it shows momentum on ${issueCategory.toLowerCase()} policy this week.`,
  ].map((s) => truncateText(s, bulletMax));

  const fallbackCons = [
    `Critics worry about knock-on costs for ${region} and unintended impacts.`,
    `Opponents say the plan needs stronger safeguards for ${issueCategory.toLowerCase()}.`,
  ].map((s) => truncateText(s, bulletMax));

  while (proTexts.length < 2) {
    proTexts.push(fallbackPros[proTexts.length % fallbackPros.length]);
  }
  while (conTexts.length < 2) {
    conTexts.push(fallbackCons[conTexts.length % fallbackCons.length]);
  }

  const firstSentence =
    sentences[0] ||
    input.summary?.split(".")[0]?.trim() ||
    input.headline ||
    `Snapshot of ${issueCategory.toLowerCase()} debate in ${region}.`;

  return {
    one_sentence: truncateText(firstSentence, oneSentenceMax),
    pros: [proTexts[0], proTexts[1]],
    cons: [conTexts[0], conTexts[1]],
  };
}

export async function generateQuickExplainer(
  input: QuickExplainerInput
): Promise<QuickExplainerResult> {
  try {
    const { headline, summary, issueCategory, region, todayIso, maxChars } =
      input;

    const oneSentenceMax = Math.min(maxChars?.one_sentence ?? 160, 200);
    const bulletMax = Math.min(maxChars?.bullet ?? 120, 140);

    const systemPrompt = `You are a neutral "Quick Explainer" generator for a daily voting flow.
Your job: reduce decision friction in <10 seconds of reading by providing clear, factual context.

Rules:
- Be strictly neutral and non-persuasive. Do NOT recommend actions or positions.
- Output MUST be concise, scannable, and self-contained.
- Use one plain sentence for the overview that summarizes what the issue is about, then exactly two "For" bullets and exactly two "Against" bullets.
- Base your explanation on the provided summary and headline. Extract real arguments from the content, not generic templates.
- No hyperlinks, no citations, no jargon. Keep claims general (avoid precise numbers unless provided in input).
- If facts are unclear, hedge lightly ("some analysts say…", "critics argue…").
- Reading level: accessible (approx. CEFR B2).
- Respect regional context (country/region in input) and today's date if given.
- Never exceed the provided max characters per field.
- The pros and cons must be SPECIFIC to this issue, not generic policy statements.

Return ONLY valid JSON matching the schema.
No preamble, no markdown, no extra keys.
Prefer approximate phrasing unless the number is provided in input.
Ensure the overview sentence is <= ${oneSentenceMax} characters. Each bullet must be <= ${bulletMax} characters.
Exactly two pros, exactly two cons.`;

    const userPrompt = `Headline: ${headline}
Region: ${region}
Issue category: ${issueCategory}
Today: ${todayIso ?? "unspecified"}
Summary: ${summary ?? "N/A"}

Based on the headline and summary above, generate a neutral quick explainer that:
1. Summarizes what this specific issue is about in one sentence
2. Lists two specific reasons someone might support this (extracted from the summary, not generic)
3. Lists two specific reasons someone might oppose this (extracted from the summary, not generic)

Make sure the pros and cons are SPECIFIC to this issue, not generic policy statements like "shows momentum" or "knock-on costs".`;

    const response = await callChatCompletion({
      model: "gpt-4o",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }, { operation: 'generateQuickExplainer' });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const parsed = JSON.parse(content) as QuickExplainerResult;

    if (
      !parsed.one_sentence ||
      !Array.isArray(parsed.pros) ||
      parsed.pros.length !== 2 ||
      !Array.isArray(parsed.cons) ||
      parsed.cons.length !== 2
    ) {
      throw new Error("Invalid quick explainer structure received from OpenAI");
    }

    return parsed;
  } catch (error) {
    console.error("Error generating quick explainer, using fallback:", error);
    const oneSentenceMax = Math.min(input.maxChars?.one_sentence ?? 160, 200);
    const bulletMax = Math.min(input.maxChars?.bullet ?? 120, 140);
    return buildFallbackQuickExplainer(input, oneSentenceMax, bulletMax);
  }
}

/**
 * Generate vector embedding for text using OpenAI's text-embedding-3-small model
 * @param text The text to embed
 * @returns Array of numbers representing the embedding vector (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    return await callEmbedding(text, { operation: 'generateEmbedding' });
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Verify a chatbot response against source context to prevent hallucinations
 * @param question The user's question
 * @param context The context provided to the LLM (debates, voting record, etc.)
 * @param response The LLM's generated response
 * @returns Verification result with score and explanation
 */
export async function verifyFactCheck(
  question: string,
  context: string,
  response: string
): Promise<{
  score: number; // 0-100 confidence score
  is_supported: boolean;
  reasoning: string;
  corrections?: string;
}> {
  try {
    const prompt = `
    You are a rigorous Fact Checker for a political AI.
    
    TASK: Verify if the AI's RESPONSE is fully supported by the provided CONTEXT.
    
    USER QUESTION: "${question}"
    
    SOURCE CONTEXT (Truth):
    ${context.substring(0, 15000)} 
    
    AI RESPONSE (Claim):
    "${response}"
    
    RULES:
    1. Check every specific claim (dates, votes, positions) against the Source Context.
    2. If the response makes claims NOT found in the context, mark as unsupported (hallucination).
    3. If the response says "I don't have records" and the context indeed has no records, that is SUPPORTED.
    4. Inferring broad positions from specific quotes is allowed, but inventing specific votes or bills is NOT.
    5. If the response mentions a specific vote (e.g. "I voted Yes on X"), verify it exists in the "VOTING RECORD" section of the context.
    
    OUTPUT JSON ONLY:
    {
      "score": number, // 0-100 (100 = fully supported, <50 = hallucinated/unsupported)
      "is_supported": boolean, // true if score >= 70
      "reasoning": "Short explanation of what is verified or missing",
      "corrections": "Optional corrected statement if unsupported"
    }
    `;

    const verification = await callChatCompletion({
      model: "gpt-4o-mini", // Fast & cheap
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0, // Deterministic
      response_format: { type: "json_object" }
    }, { operation: 'verifyFactCheck' });

    const content = verification.choices[0].message.content;
    return content ? JSON.parse(content) : { score: 0, is_supported: false, reasoning: "Failed to parse verification" };
    
  } catch (error) {
    console.error("Fact check failed:", error);
    // Fail open (assume supported) to avoid blocking valid responses if checker fails
    return { score: 100, is_supported: true, reasoning: "Fact check service unavailable" };
  }
}
