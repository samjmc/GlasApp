import OpenAI from "openai";
import dotenv from "dotenv";
import { IdeologicalDimensions } from "../../shared/quizTypes";

// Make sure environment variables are loaded
dotenv.config();

// Initialize OpenAI client lazily (only when needed)
// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
let openai: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required but not set. AI analysis features are disabled.');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// Original analyzer functions
/**
 * Analyze political sentiment in a text response
 * @param text The text to analyze
 * @param questionContext The context of the question
 * @returns Analysis results with economic and social scores, reasoning, and confidence
 */
export async function analyzePoliticalSentiment(text: string, questionContext: string) {
  try {
    const prompt = `
    You are analyzing a response to a political opinion survey. 
    The question context is: "${questionContext}"
    
    The response is: "${text}"
    
    Please analyze this response to determine:
    1. The economic position (left/right) on a scale from -10 to +10, where:
       * -10 is extremely left-wing/collectivist/socialist economic views
       * 0 is centrist/mixed economic views
       * +10 is extremely right-wing/market-focused/capitalist economic views
       
    2. The social position (progressive/conservative) on a scale from -10 to +10, where:
       * -10 is extremely progressive/liberal social views
       * 0 is moderate/balanced social views
       * +10 is extremely conservative/traditional social views
       
    3. A short explanation of your reasoning (2-3 sentences)
    
    4. Your confidence in this assessment (low, medium, high)
    
    Output your analysis in the following JSON format only:
    {
      "economic": number,
      "social": number,
      "reasoning": "string",
      "confidence": "string"
    }
    `;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    return content ? JSON.parse(content) : null;
  } catch (error) {
    console.error("Error analyzing political sentiment:", error);
    throw error;
  }
}

/**
 * Analyze bulk responses to generate an overall political profile
 * @param responses Array of response objects with text and question properties
 * @returns Combined analysis with scores, key insights, and confidence
 */
export async function analyzeBulkResponses(responses: { text: string; question: string }[]) {
  try {
    // Format responses for the prompt
    const formattedResponses = responses
      .map((r, i) => `Q${i + 1}: ${r.question}\nA${i + 1}: ${r.text}`)
      .join("\n\n");

    const prompt = `
    You are analyzing a set of responses to a political compass quiz. Here are the responses:
    
    ${formattedResponses}
    
    Based on these responses, please:
    
    1. Determine the overall economic position (left/right) on a scale from -10 to +10, where:
       * -10 is extremely left-wing/collectivist/socialist economic views
       * 0 is centrist/mixed economic views
       * +10 is extremely right-wing/market-focused/capitalist economic views
       
    2. Determine the overall social position (progressive/conservative) on a scale from -10 to +10, where:
       * -10 is extremely progressive/liberal social views
       * 0 is moderate/balanced social views
       * +10 is extremely conservative/traditional social views
       
    3. Identify 3-5 key insights about this person's political ideology (bullet points)
    
    4. State your confidence in this assessment (low, medium, high)
    
    5. Generate a detailed analysis (250-350 words) of their political orientation, including how their economic and social views interact, potential tensions in their ideology, and what political movements or traditions their views align with.
    
    6. In the Irish context, identify which political parties might most closely align with this person's views, and explain why.
    
    Output your analysis in the following JSON format only:
    {
      "economic": number,
      "social": number,
      "keyInsights": ["string", "string", "string"],
      "confidence": "string",
      "detailedAnalysis": "string",
      "irishContextInsights": {"party": "string", "reason": "string"}
    }
    `;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    return content ? JSON.parse(content) : null;
  } catch (error) {
    console.error("Error analyzing bulk responses:", error);
    throw error;
  }
}

// Enhanced multidimensional analysis functions
/**
 * Generate a natural language explanation of a user's political profile
 * @param dimensions Multidimensional ideological dimensions from quiz results
 * @returns Detailed analysis with description, historical equivalents, and tensions
 */
export async function generatePoliticalProfileExplanation(dimensions: IdeologicalDimensions) {
  try {
    const { economic, social, cultural, globalism, environmental, authority, welfare, technocratic } = dimensions;
    
    // Create a detailed prompt for the explanation
    const prompt = `
    I need a detailed political ideology analysis based on these multidimensional scores (scale -10 to +10):
    
    - Economic: ${economic} (Left/Collective to Right/Market)
    - Social: ${social} (Progressive to Conservative)
    - Cultural: ${cultural} (Progressive to Traditional)
    - Globalism: ${globalism} (Internationalist to Nationalist)
    - Environmental: ${environmental} (Ecological to Industrial)
    - Authority: ${authority} (Libertarian to Authoritarian)
    - Welfare: ${welfare} (Communitarian to Individualist)
    - Technocratic: ${technocratic} (Expert-led to Populist)
    
    Please provide:
    1. A detailed description of this political orientation in natural language
    2. Common beliefs associated with this profile
    3. Internal ideological tensions or contradictions that might exist
    4. Historical or contemporary political movements that align with this viewpoint
    5. How this profile would approach key political issues in modern Ireland
    
    Format the response as a JSON object with these fields:
    - description: overall description
    - beliefs: array of key beliefs
    - tensions: array of potential tensions
    - historical_equivalents: array of historical or contemporary movements
    - approach_to_issues: object with approaches to housing, healthcare, environment, and EU
    `;
    
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o", 
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });
    
    // Parse and return the JSON response
    const content = response.choices[0].message.content;
    return content ? JSON.parse(content) : null;
  } catch (error) {
    console.error("Error generating political profile explanation:", error);
    throw error;
  }
}

/**
 * Generate matches to real-world political figures and parties
 * @param dimensions Multidimensional ideological dimensions from quiz results
 * @returns Array of matching political figures and parties with explanations
 */
export async function generatePoliticalMatches(dimensions: IdeologicalDimensions) {
  try {
    const { economic, social, cultural, globalism, environmental, authority, welfare, technocratic } = dimensions;
    
    // Create a prompt for matching to real figures and parties
    const prompt = `
    Based on these political ideology scores (scale -10 to +10):
    
    - Economic: ${economic} (Left/Collective to Right/Market)
    - Social: ${social} (Progressive to Conservative)
    - Cultural: ${cultural} (Progressive to Traditional)
    - Globalism: ${globalism} (Internationalist to Nationalist)
    - Environmental: ${environmental} (Ecological to Industrial)
    - Authority: ${authority} (Libertarian to Authoritarian)
    - Welfare: ${welfare} (Communitarian to Individualist)
    - Technocratic: ${technocratic} (Expert-led to Populist)
    
    Please identify:
    1. 3-5 contemporary Irish politicians whose views most closely align with this profile
    2. 2-3 Irish political parties that best match this orientation
    3. 3-5 international political figures (historical or current) who share similar ideological positions
    
    For each match, explain specifically why they align with this profile, citing which dimensions are most similar.
    
    Format the response as a JSON object with these fields:
    - irish_politicians: array of objects with name, party, and explanation
    - irish_parties: array of objects with name and explanation
    - international_figures: array of objects with name, country, era, and explanation
    `;
    
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });
    
    // Parse and return the JSON response
    const content = response.choices[0].message.content;
    return content ? JSON.parse(content) : null;
  } catch (error) {
    console.error("Error generating political matches:", error);
    throw error;
  }
}

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

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

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
 * Generate policy predictions based on ideological profile
 * @param dimensions Multidimensional ideological dimensions from quiz results
 * @returns Policy predictions and reasoning
 */
export async function generatePolicyPredictions(dimensions: IdeologicalDimensions) {
  try {
    const { economic, social, cultural, globalism, environmental, authority, welfare, technocratic } = dimensions;
    
    // Create a prompt for policy predictions
    const prompt = `
    Based on these political ideology scores (scale -10 to +10):
    
    - Economic: ${economic} (Left/Collective to Right/Market)
    - Social: ${social} (Progressive to Conservative)
    - Cultural: ${cultural} (Progressive to Traditional)
    - Globalism: ${globalism} (Internationalist to Nationalist)
    - Environmental: ${environmental} (Ecological to Industrial)
    - Authority: ${authority} (Libertarian to Authoritarian)
    - Welfare: ${welfare} (Communitarian to Individualist)
    - Technocratic: ${technocratic} (Expert-led to Populist)
    
    Please predict this person's likely positions on key policy issues specifically in an Irish context:
    
    1. Housing and property rights
    2. Healthcare system
    3. Environmental regulations and climate change
    4. Immigration
    5. Economic regulation
    6. EU integration
    7. Northern Ireland
    8. Taxation
    
    For each policy area, provide:
    - Their likely stance (with nuance, not just "support" or "oppose")
    - Reasoning based on their ideological dimensions
    - How their position might differ from mainstream Irish political discourse
    
    Format the response as a JSON object with policy areas as keys, each containing stance, reasoning, and comparison fields.
    `;
    
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });
    
    // Parse and return the JSON response
    const content = response.choices[0].message.content;
    return content ? JSON.parse(content) : null;
  } catch (error) {
    console.error("Error generating policy predictions:", error);
    throw error;
  }
}

/**
 * Generate personalized historical context for a user's political orientation
 * @param dimensions Multidimensional ideological dimensions from quiz results
 * @returns Historical context and ideological evolution
 */
export async function generateHistoricalContext(dimensions: IdeologicalDimensions) {
  try {
    const { economic, social, cultural, globalism, environmental, authority, welfare, technocratic } = dimensions;
    
    // Create a prompt for historical context
    const prompt = `
    Based on these political ideology scores (scale -10 to +10):
    
    - Economic: ${economic} (Left/Collective to Right/Market)
    - Social: ${social} (Progressive to Conservative)
    - Cultural: ${cultural} (Progressive to Traditional)
    - Globalism: ${globalism} (Internationalist to Nationalist)
    - Environmental: ${environmental} (Ecological to Industrial)
    - Authority: ${authority} (Libertarian to Authoritarian)
    - Welfare: ${welfare} (Communitarian to Individualist)
    - Technocratic: ${technocratic} (Expert-led to Populist)
    
    Please provide:
    1. A brief history of how this political orientation has evolved in Ireland over the past century
    2. Key historical events or movements in Ireland that shaped or exemplified this ideological approach
    3. How this orientation relates to traditional Irish political divisions and alignments
    4. A prediction of how this political perspective might evolve in Ireland over the next decade
    
    Format the response as a JSON object with historical_evolution, key_events, relation_to_tradition, and future_projection fields.
    `;
    
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });
    
    // Parse and return the JSON response
    const content = response.choices[0].message.content;
    return content ? JSON.parse(content) : null;
  } catch (error) {
    console.error("Error generating historical context:", error);
    throw error;
  }
}

/**
 * Generate an explanation for a quiz answer's ideological classification
 * @param questionId ID of the question
 * @param answerId ID of the answer selected
 * @param questionText Text of the question
 * @param answerText Text of the answer
 * @param customQuestion Optional custom question (if user is asking their own)
 * @param customAnswer Optional custom answer (if user is asking their own)
 * @returns Detailed explanation with dimensions, alternative perspectives, and learning resources
 */
export async function generateAnswerExplanation(
  questionId: number,
  answerId: number | undefined,
  questionText: string,
  answerText: string,
  customQuestion?: string,
  customAnswer?: string
) {
  try {
    // Determine if this is a custom question from the user or from the quiz
    const isCustom = !!customQuestion && !!customAnswer;
    
    // Construct the prompt based on whether it's a custom question or from the quiz
    const prompt = isCustom 
      ? `
        I need an analysis of a custom political position on the following question:
        
        Question: ${customQuestion}
        Position: ${customAnswer}
        
        Please analyze this position to determine:
        
        1. An explanation of how this position relates to different political ideologies (200-300 words)
        
        2. Impact on different ideological dimensions (scale -10 to +10, where negative is left/progressive/globalist and positive is right/conservative/nationalist):
          - Economic dimension (market vs. collective)
          - Social dimension (progressive vs. traditional)
          - Cultural dimension (multicultural vs. traditionalist)
          - Authority dimension (libertarian vs. authoritarian)
          - Other relevant dimensions
        
        3. Alternative perspectives from different ideological positions (3-4 perspectives)
        
        4. Learning resources to understand this issue better (2-3 resources with descriptions)
        
        Format the response as a JSON object with these fields:
        - question: the question
        - answer: the position taken
        - explanation: detailed analysis
        - dimensions: array of objects with dimension name, score, and reasoning
        - alternative_perspectives: array of alternative viewpoints
        - learning_resources: array of objects with title, description, and optional URL
      `
      : `
        I need an analysis of the following political quiz question and answer:
        
        Question: ${questionText}
        Answer: ${answerText}
        
        Please analyze this response to determine:
        
        1. An explanation of why this answer is classified in a certain way ideologically (200-300 words)
        
        2. Impact on different ideological dimensions (scale -10 to +10, where negative is left/progressive/globalist and positive is right/conservative/nationalist):
          - Economic dimension (market vs. collective)
          - Social dimension (progressive vs. traditional)
          - Cultural dimension (multicultural vs. traditionalist)
          - Authority dimension (libertarian vs. authoritarian)
          - Other relevant dimensions
        
        3. Alternative perspectives from different ideological positions (3-4 perspectives)
        
        4. Learning resources to understand this position better (2-3 resources with descriptions)
        
        Format the response as a JSON object with these fields:
        - question: the question text
        - answer: the answer text
        - explanation: detailed analysis
        - dimensions: array of objects with dimension name, score, and reasoning
        - alternative_perspectives: array of alternative viewpoints
        - learning_resources: array of objects with title, description, and optional URL
      `;
    
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });
    
    // Parse and return the JSON response
    const content = response.choices[0].message.content;
    return content ? JSON.parse(content) : null;
  } catch (error) {
    console.error("Error generating answer explanation:", error);
    throw error;
  }
}

/**
 * Generate a complete multidimensional analysis from quiz responses
 * @param responses Array of user responses from the multidimensional quiz
 * @returns Comprehensive analysis of the user's political profile
 */
export async function generateCompleteProfileAnalysis(responses: Array<{
  questionId: number;
  answerId?: number;
  customAnswer?: string;
}>) {
  try {
    // Import the enhanced questions data
    const { enhancedQuestions } = await import("../../shared/enhanced-quiz-data");
    
    // Format the responses for analysis
    const formattedResponses = responses.map(response => {
      const question = enhancedQuestions.find(q => q.id === response.questionId);
      if (!question) return null;
      
      let answer = "No answer";
      if (response.answerId !== undefined && question.answers[response.answerId]) {
        answer = question.answers[response.answerId].text;
      } else if (response.customAnswer) {
        answer = response.customAnswer;
      }
      
      return {
        question: question.text,
        answer: answer,
        category: question.category,
        questionId: response.questionId,
        answerId: response.answerId
      };
    }).filter(r => r !== null);
    
    // Calculate basic dimensions scores based on the questions' predefined impacts
    const dimensions = {
      economic: 0,
      social: 0,
      cultural: 0,
      globalism: 0,
      environmental: 0,
      authority: 0,
      welfare: 0,
      technocratic: 0
    };
    
    let answeredQuestions = 0;
    
    // Process each response to calculate dimension scores
    formattedResponses.forEach(response => {
      if (!response || response.answerId === undefined) return;
      
      const question = enhancedQuestions.find(q => q.id === response.questionId);
      if (!question) return;
      
      const answer = question.answers[response.answerId];
      if (!answer) return;
      
      // Add the dimension impacts from this answer
      if (typeof answer.economic === 'number') dimensions.economic += answer.economic;
      if (typeof answer.social === 'number') dimensions.social += answer.social;
      if (typeof answer.cultural === 'number') dimensions.cultural += answer.cultural;
      if (typeof answer.globalism === 'number') dimensions.globalism += answer.globalism;
      if (typeof answer.environmental === 'number') dimensions.environmental += answer.environmental;
      if (typeof answer.authority === 'number') dimensions.authority += answer.authority;
      if (typeof answer.welfare === 'number') dimensions.welfare += answer.welfare;
      if (typeof answer.technocratic === 'number') dimensions.technocratic += answer.technocratic;
      
      answeredQuestions++;
    });
    
    // Calculate averages if there are answered questions
    if (answeredQuestions > 0) {
      Object.keys(dimensions).forEach(key => {
        dimensions[key as keyof typeof dimensions] = parseFloat((dimensions[key as keyof typeof dimensions] / answeredQuestions).toFixed(1));
      });
    }
    
    // Create the prompt for generating the comprehensive analysis
    const responsesText = formattedResponses
      .map(r => r ? `Question: ${r.question}\nAnswer: ${r.answer}` : "")
      .filter(text => text)
      .join("\n\n");
      
    const prompt = `
    I need a comprehensive analysis of a political orientation based on quiz responses and calculated dimensions.
    
    Calculated dimension scores (scale -10 to +10):
    - Economic: ${dimensions.economic} (Left/Collective to Right/Market)
    - Social: ${dimensions.social} (Progressive to Conservative)
    - Cultural: ${dimensions.cultural} (Progressive to Traditional)
    - Globalism: ${dimensions.globalism} (Internationalist to Nationalist)
    - Environmental: ${dimensions.environmental} (Ecological to Industrial)
    - Authority: ${dimensions.authority} (Libertarian to Authoritarian)
    - Welfare: ${dimensions.welfare} (Communitarian to Individualist)
    - Technocratic: ${dimensions.technocratic} (Expert-led to Populist)
    
    The person provided the following responses:
    
    ${responsesText}
    
    Based on these responses and dimension scores, please provide:
    
    1. A comprehensive political ideology analysis (300-400 words)
    2. A specific ideology label that best describes this political profile
    3. Key characteristics and beliefs associated with this orientation
    4. Internal tensions or contradictions in this political perspective
    5. Irish political parties that align most closely with this orientation
    6. International political figures or movements with similar views
    7. How this profile might approach key current issues in Ireland (housing, healthcare, environment)
    
    Format the response as a JSON object with:
    - profile_analysis: detailed analysis text
    - ideology: label for the ideology
    - beliefs: array of key beliefs
    - tensions: array of internal tensions
    - irish_parties: array of objects with party name and alignment strength
    - international_matches: array of objects with name, country, and alignment strength
    - issue_positions: object with housing, healthcare, and environment positions
    `;
    
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });
    
    // Parse and return the JSON response
    const content = response.choices[0].message.content;
    return content ? JSON.parse(content) : null;
  } catch (error) {
    console.error("Error generating complete profile analysis:", error);
    throw error;
  }
}

/**
 * Generate context-aware analysis of a user's political profile
 * @param dimensions The user's calculated ideological dimensions
 * @param userLocation Optional location information for regional analysis
 * @returns Historical, regional, and issue-based analysis of the profile
 */
export async function generateContextAwareAnalysis(
  dimensions: IdeologicalDimensions,
  userLocation?: string
) {
  try {
    const { economic, social, cultural, globalism, environmental, authority, welfare, technocratic } = dimensions;
    
    // Create the prompt for context-aware analysis
    const prompt = `
    I need a context-aware analysis for a political profile with these dimension scores (scale -10 to +10):
    
    - Economic: ${economic} (Left/Collective to Right/Market)
    - Social: ${social} (Progressive to Conservative)
    - Cultural: ${cultural} (Progressive to Traditional)
    - Globalism: ${globalism} (Internationalist to Nationalist)
    - Environmental: ${environmental} (Ecological to Industrial)
    - Authority: ${authority} (Libertarian to Authoritarian)
    - Welfare: ${welfare} (Communitarian to Individualist)
    - Technocratic: ${technocratic} (Expert-led to Populist)
    ${userLocation ? `\nUser is from: ${userLocation}` : ''}
    
    Please provide a comprehensive context-aware analysis that includes:
    
    1. Historical alignments - how this political orientation relates to different historical periods around the world (2-3 significant eras). For each historical alignment, specifically identify 3-5 concrete key similarities and 3-5 key differences as separate bullet points, not as a paragraph.
    
    2. Regional analysis - identify 3-4 regions/countries from around the world (not just Ireland) that most closely align with this political profile. These should be regions where the majority of voters share similar political values to this profile. Include detailed demographic information and voting patterns for each region.
    
    3. Issue analysis - examine how this profile relates to 3-4 key political dimensions specifically compared to average voters in Ireland. Focus on Irish-specific political issues.
    
    4. Trending issues - predict positions on 3-4 current trending political issues specifically in Ireland, not global issues.
    
    Format the response as a JSON object with these sections:
    - historical_alignments: array of objects with era, period, description, alignment_score (numerical value between 0-100), key_similarities (array of strings), key_differences (array of strings)
    - regional_analysis: array of objects with region (specify country/region name), alignment_score (numerical value between 0-100), description, demographic_note, voting_patterns (array of strings)
    - issue_analysis: array of objects with dimension, score, percentile, status, description, comparison (all Ireland-specific)
    - trending_issues: array of objects with issue, likely_stance, mainstream_stance (all Ireland-specific issues)
    
    Make sure key_similarities and key_differences are always returned as arrays of strings, with each similarity and difference as a separate item in the array.
    `;
    
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });
    
    // Parse and return the JSON response
    const content = response.choices[0].message.content;
    return content ? JSON.parse(content) : null;
  } catch (error) {
    console.error("Error generating context-aware analysis:", error);
    throw error;
  }
}

/**
 * Generate a vote question with options for a policy article
 * @param headline The article headline
 * @param summary The article summary
 * @param numOptions Number of options (3 or 4)
 * @returns Question and options
 */
export async function generateVoteQuestion(
  headline: string,
  summary: string,
  numOptions: 3 | 4 = 3
) {
  try {
    const prompt = `
    Based on the following news article:
    Headline: "${headline}"
    Summary: "${summary}"

    Create a multiple-choice poll question that captures the core policy debate.
    The question should be neutral and engaging.

    Generate ${numOptions} distinct answer options ranging from support to opposition, including a neutral/nuanced option.
    
    Format the response as a JSON object with:
    - question_text: The question string
    - answer_options: An object with keys "option_a", "option_b", "option_c"${numOptions === 4 ? ', "option_d"' : ''} and values as the option text.
    `;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    return content ? JSON.parse(content) : null;
  } catch (error) {
    console.error("Error generating vote question:", error);
    return null;
  }
}

/**
 * Generate vector embedding for text using OpenAI's text-embedding-3-small model
 * @param text The text to embed
 * @returns Array of numbers representing the embedding vector (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await getOpenAIClient().embeddings.create({
      model: "text-embedding-3-small",
      input: text.replace(/\n/g, " "),
      encoding_format: "float",
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}
