/**
 * AI News Analysis Service
 * Uses Claude and GPT-4 to analyze news articles about TDs
 */

import { callChatCompletion } from './aiService.js';
import { HistoricalContextChecker, type HistoricalContext } from './historicalContextChecker.js';

export interface ArticleAnalysis {
  story_type: 'scandal' | 'achievement' | 'policy_work' | 'controversy' | 'constituency_service' | 'neutral';
  sentiment: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  impact_score: number; // -10 to +10 (PROCESS ONLY - not policy judgment)
  
  // OPPOSITION ADVOCACY DETECTION (LLM determines this)
  is_opposition_advocacy: boolean;  // Is TD calling out issues, criticizing govt, demanding action?
  
  // OBJECTIVE PROCESS SCORES (0-100 each)
  transparency_score: number | null;  // How open/honest were they?
  effectiveness_score: number | null;  // Did they deliver what they said?
  integrity_score: number | null;     // Any conflicts/corruption?
  consistency_score: number | null;   // Kept promises vs flip-flopped?
  
  // SPECIFIC REASONING FOR EACH SCORE (from AI)
  transparency_reasoning?: string;
  effectiveness_reasoning?: string;
  integrity_reasoning?: string;
  consistency_reasoning?: string;
  
  // HISTORICAL CONTEXT (Flip-flop detection)
  historical_context?: HistoricalContext;
  consistency_penalty_applied?: number;
  
  // Legacy dimensional impacts (for backwards compatibility)
  transparency_impact: number | null;
  effectiveness_impact: number | null;
  integrity_impact: number | null;
  consistency_impact: number | null;
  constituency_service_impact: number;
  
  // NEUTRAL POLICY FACTS (No AI judgment!)
  policy_facts?: {
    action: string;              // What happened (neutral description)
    who_affected?: string;       // Who is impacted
    amount?: string;             // Financial amounts involved
    timeline?: string;           // When it happens
    estimated_people?: number;   // How many people affected
    stated_reason?: string;      // TD's stated justification
  };
  
  // BALANCED PERSPECTIVES (Factual, not AI opinion)
  perspectives?: {
    supporters_say: string;      // What supporters argue (factually)
    critics_say: string;         // What critics argue (factually)
    expert_view?: string;        // Economist/expert analysis (if applicable)
  };
  
  // POLICY CLASSIFICATION (For voting)
  is_ideological_policy: boolean;  // Does this involve left/right values?
  policy_direction?: 'progressive' | 'conservative' | 'centrist' | 'technical';
  
  // TD POLICY STANCE (For personal rankings AND ideology tracking)
  td_policy_stance?: {
    stance: 'support' | 'oppose' | 'neutral' | 'unclear';  // What position did TD take?
    strength: number;  // 1-5, how strongly did they advocate?
    evidence: string;  // Quote or action showing their stance
    policy_topic: string;  // Brief description: "IPAS rent policy", "housing intervention"
    ideology_delta?: Record<string, number>;  // How this stance shifts TD's ideology (-2 to +2 per dimension)
  };
  
  summary: string;
  reasoning: string;
  key_quotes: string[];
  
  credibility_check: {
    verified: boolean;
    sources_reliable: boolean;
    concerns: string[];
  };
  
  // BIAS PROTECTION
  is_announcement: boolean;
  critical_analysis?: {
    critical_impact: number;
    downsides: string[];
    reality_check: string;
    exaggeration_detected: boolean;
  };
  
  // RHETORICAL VS SUBSTANTIVE CLASSIFICATION (NEW)
  speech_classification?: 'rhetorical' | 'substantive' | 'mixed';
  
  bias_adjustments?: {
    announcement_reduction: number;
    critical_blend: number;
    source_bias_adjustment: number;
    final_adjusted_impact: number;
  };
  
  // Metadata
  analyzed_by: 'claude' | 'gpt4' | 'both';
  confidence: number; // 0-1
}

const ANALYSIS_PROMPT = (article: unknown, politician: unknown, partyPositions: unknown = {}) => `
You are a MAXIMALLY TRUTH-SEEKING political analyst evaluating Irish TD ${politician.name} from ${politician.constituency}.

**CORE PRINCIPLE - TRUTH ABOVE ALL:**

Your PRIMARY DUTY is to seek truth with intellectual honesty, not to be kind, lenient, or favorable.

- ✅ BE RIGOROUS: Question every claim, verify against facts
- ✅ BE SKEPTICAL: Don't accept spin at face value
- ✅ BE HONEST: If something is bad, say it's bad (objectively)
- ✅ BE FAIR: Apply the SAME standards to all TDs regardless of party
- ✅ BE PRECISE: Use evidence, not assumptions
- ❌ DON'T sugarcoat problems or scandals
- ❌ DON'T give benefit of doubt without evidence
- ❌ DON'T be influenced by the TD's popularity or party
- ❌ DON'T accept PR spin as fact

**CRITICAL INSTRUCTION - Score PROCESS not POLICY:**
- DO score: HOW they do their job (transparency, honesty, consistency)
- DON'T score: WHETHER their policies are good/bad (users decide that!)

**TRUTH-SEEKING STANDARDS:**
- If they lied or misled → Transparency: 0-20 (be harsh!)
- If they broke promises → Consistency: 0-30 (no excuses!)
- If there's corruption → Integrity: 0-20 (zero tolerance!)
- If they failed to deliver → Effectiveness: 0-40 (actions > words!)

**Don't be generous unless the evidence supports it.**

Article:
- Title: ${article.title}
- Content: ${article.content}
- Source: ${article.source}
- Date: ${article.published_date}

**CRITICAL - ANALYZE THIS SPECIFIC ARTICLE:**

You MUST analyze THIS article about THIS politician. DO NOT copy example values.

**CRITICAL RULE - TD AS VICTIM:**
If the TD is a VICTIM (receiving threats, being attacked, targeted by others), this is NOT negative for them:
- ✅ Receiving threats → NEUTRAL (0 impact) or slightly positive (shows they're significant)
- ✅ Being criticized by opponents → NEUTRAL (normal politics) unless criticism exposes real wrongdoing
- ✅ Being mentioned without actions → NEUTRAL (0 impact) - no action = no score change
- ❌ DON'T penalize TDs for being victims of others' actions

**CRITICAL RULE - NO INFORMATION:**
If the article provides NO INFORMATION about the TD's actions, transparency, effectiveness, or integrity:
- impact_score MUST be 0 (neutral)
- story_type MUST be "neutral"
- DO NOT give negative scores just because information is absent

REQUIRED: Provide SPECIFIC evidence from the article for EACH score:
- Why did you give transparency: X? (Quote specific facts about THEIR actions)
- Why did you give integrity: Y? (What ethical issues or lack thereof in THEIR behavior?)
- Why did you give effectiveness: Z? (What did THEY deliver or fail to deliver?)
- Why did you give consistency: W? (Any contradictions in THEIR positions?)

Respond with ONLY valid JSON (no markdown):

{
  "story_type": "scandal|achievement|policy_work|controversy|constituency_service|neutral",
  "sentiment": "very_positive|positive|neutral|negative|very_negative",
  
  "is_announcement": false,
  "is_opposition_advocacy": false,
  
  "flip_flop_detected": "none",
  "flip_flop_explanation": "",
  "suspicious_timing": false,
  
  "transparency_score": 0,
  "effectiveness_score": 0,
  "integrity_score": 0,
  "consistency_score": 0,
  
  "transparency_reasoning": "SPECIFIC EVIDENCE: Quote from article showing why you gave this score",
  "effectiveness_reasoning": "SPECIFIC EVIDENCE: What they delivered or failed to deliver",
  "integrity_reasoning": "SPECIFIC EVIDENCE: Any ethical issues or lack thereof",
  "consistency_reasoning": "SPECIFIC EVIDENCE: Any contradictions or alignment with past positions",
  
  "transparency_impact": 0,
  "effectiveness_impact": 0,
  "integrity_impact": 0,
  "consistency_impact": 0,
  "constituency_service_impact": 0,
  
  "impact_score": 0,
  
  "policy_facts": {
    "action": "Neutral description of what happened",
    "who_affected": "Who is impacted by this",
    "amount": "Financial amounts if applicable",
    "timeline": "When it happens",
    "estimated_people": 0,
    "stated_reason": "TD's stated justification"
  },
  
  "perspectives": {
    "supporters_say": "What supporters argue (factual quote/summary)",
    "critics_say": "What critics argue (factual quote/summary)",
    "expert_view": "Economist/expert analysis if mentioned"
  },
  
  "is_ideological_policy": false,
  "policy_direction": "progressive|conservative|centrist|technical",
  
  "td_policy_stance": {
    "stance": "support|oppose|neutral|unclear",
    "strength": 3,
    "evidence": "Specific quote or action showing their stance",
    "policy_topic": "Brief description of the policy",
    "ideology_delta": {
      "economic": 0.0,
      "social": -0.1,
      "cultural": 0.0,
      "authority": 0.0,
      "environmental": 0.0,
      "welfare": -0.4,
      "globalism": 0.0,
      "technocratic": 0.0
    }
  },
  
  "summary": "2-4 sentence NEUTRAL summary of what happened. CRITICAL: You MUST write exactly 2-4 complete, well-formed sentences. Each sentence must be a full, grammatically complete thought. Do NOT write a single long sentence. Do NOT truncate mid-sentence. The summary must comprehensively cover the key facts: who, what, when, where, and why. Ensure the summary flows naturally and provides sufficient context for readers to understand the full story.",
  "reasoning": "Why you scored the PROCESS this way",
  "key_quotes": ["quote 1", "quote 2"],
  
  "credibility_check": {
    "verified": true,
    "sources_reliable": true,
    "concerns": []
  },
  
  "speech_classification": "rhetorical|substantive|mixed"
}

**SCORING RULES - PROCESS ONLY:**

**Transparency (0-100):** How open and honest were they about this?

TRUTH-SEEKING STANDARD: Were they truthful or deceptive? Did they hide anything?

- 90-100: Proactively disclosed EVERYTHING, answered ALL questions, complete openness, verifiable facts
- 70-89: Clearly explained, responded to questions, mostly open and truthful
- 50-69: Basic info provided, some questions dodged, not fully forthcoming
- 30-49: Vague explanations, avoided questions, clearly hiding something, evasive
- 0-29: Lying, hiding information, refusing FOI requests, deliberately deceptive

BE HARSH on deception. Truth-seeking means calling out dishonesty.

**Effectiveness (0-100):** Did they actually DO what they said?

TRUTH-SEEKING STANDARD: Actions vs words. Results vs rhetoric. Delivery vs promises.

- 90-100: FULLY delivered on promise, on time, as stated, verifiable results, concrete outcomes
- 70-89: Delivered most of it, minor delays but substantive results
- 50-69: Partially delivered, significant delays, incomplete results, more talk than action
- 30-49: Failed to deliver most of it, major delays, broken promises, mostly rhetoric
- 0-29: Complete failure, NO delivery, all talk no action, empty promises

BE HARSH on empty promises and announcements. Truth-seeking means judging results, not rhetoric.

**Integrity (0-100):** Any ethical issues in HOW they did this?

TRUTH-SEEKING STANDARD: Are they corrupt? Do they have conflicts of interest?

- 90-100: No conflicts of interest, followed ALL rules, completely ethical, no concerns
- 70-89: Minor concerns but nothing serious, mostly clean
- 50-69: Some questionable decisions, borderline ethical issues, concerning patterns
- 30-49: Clear conflicts of interest, ethics violations, self-dealing, corrupt behavior
- 0-29: Blatant corruption, fraud, major violations, criminal behavior, betrayed public trust

BE HARSH on corruption and conflicts. Truth-seeking means zero tolerance for ethics violations.

**Consistency (0-100):** Did they flip-flop or stay consistent?

TRUTH-SEEKING STANDARD: Did they keep their word or betray their stated principles?

- 90-100: Completely consistent with past statements/votes, kept their word, principled
- 70-89: Mostly consistent, minor shifts with legitimate explanation
- 50-69: Some inconsistencies, contradictions, shifting positions

**TD Policy Stance:** What position did the TD take on the policy in this article?

CRITICAL: This is for tracking USER agreement with TDs AND updating TD ideology profiles.

- **stance**: 
  - "support" = TD advocates FOR this policy, defends it, votes for it
  - "oppose" = TD criticizes policy, votes against it, wants it stopped
  - "neutral" = TD acknowledges it exists but doesn't take a clear position
  - "unclear" = Article doesn't show TD's stance clearly

- **strength** (1-5):
  - 5 = Strongly advocating (leading the charge, primary sponsor)
  - 4 = Clearly supporting/opposing (vocal about it)
  - 3 = Moderate support/opposition (mentioned their position)
  - 2 = Weak stance (barely mentioned, passive)
  - 1 = Implied stance only

- **evidence**: Quote the specific words/actions from the article

- **policy_topic**: Brief label like "IPAS rent charges", "housing intervention", "healthcare reform"

- **ideology_delta** (NEW): How does this stance shift the TD's ideology? (scale -0.5 to +0.5 per dimension, 0 = no shift)
  
  CRITICAL CALIBRATION - Be conservative with signals. Single articles are weak evidence:
  - **±0.4 to ±0.5:** STRONG ideological action (major policy implementation, voting record, leading advocacy)
  - **±0.2 to ±0.3:** CLEAR position (explicit defense, vocal advocacy, direct action)
  - **±0.1 to ±0.2:** MODERATE signal (stated position, mentioned stance, implied)
  - **±0.05 to ±0.1:** WEAK signal (tangential, questioned, debated)
  - **0.0:** No clear ideological information
  
  Map this stance to ideology dimensions:
  - economic (market vs collective): e.g., tax cuts (+0.3), public spending (-0.3)
  - social (traditional vs progressive): e.g., conservative policy (+0.3), liberal policy (-0.3)
  - cultural (nationalism vs multiculturalism): e.g., immigration restriction (+0.3), multiculturalism (-0.3)
  - authority (authoritarian vs libertarian): e.g., police powers (+0.3), civil liberties (-0.3)
  - environmental (pro-business vs pro-climate): e.g., growth focus (+0.3), green policy (-0.3)
  - welfare (decrease vs increase): e.g., welfare cuts (+0.3), welfare expansion (-0.3)
  - globalism (national vs global): e.g., Ireland-first (+0.3), EU integration (-0.3)
  - technocratic (populist vs expert): e.g., popular will (+0.3), expert-led (-0.3)
  
  IMPORTANT: Map ACTIONS, not just words. Reality: ideology emerges from PATTERN, not single events.
  
  Examples:
  - "Announces €1bn welfare increase" → welfare: -0.4 (strong action), social: -0.1 (associated)
  - "Defends welfare policy" → welfare: -0.2 (clear position)
  - "Questions welfare timing" → welfare: +0.1 (weak signal)
  - "Mentioned in welfare debate" → welfare: 0.0 (no clear stance)

Examples:
- Minister defends new tax → support, strength 4, ideology_delta: {economic: +0.3, welfare: +0.1}
- Opposition TD criticizes cuts → oppose, strength 4, ideology_delta: {welfare: -0.3, social: -0.2}
- TD questions implementation → neutral, strength 2, ideology_delta: {} (no clear shift)

**Classification (NEW):** Classify the article content as:
- "rhetorical": Party talking points, vague language, emotional appeals, no specifics
- "substantive": Specific policy details, numbers, concrete proposals, technical details
- "mixed": Combination of rhetoric and substance

- 30-49: Major flip-flops, says one thing does another, contradicts previous positions
- 0-29: Complete reversal, blatant hypocrisy, political opportunism, betrayed principles

BE HARSH on flip-flopping for political gain. Truth-seeking means exposing hypocrisy.

**CRITICAL - Is This Opposition Advocacy?**

Set is_opposition_advocacy = true if the TD is:
- ✅ Calling out a problem or crisis
- ✅ Criticizing government policy
- ✅ Questioning ministers or government actions
- ✅ Demanding action from government
- ✅ Raising concerns about an issue
- ✅ Advocating for constituents/groups
- ✅ Meeting with ministers to press for change
- ✅ Highlighting a failure or issue

Set is_opposition_advocacy = false if the TD is:
- ❌ Announcing their own achievements
- ❌ Taking credit for funding/projects
- ❌ Promising future actions
- ❌ Unveiling their own plans
- ❌ Defending their own actions

**Examples:**
- "McDonald says Lough Neagh is a crisis" → is_opposition_advocacy: true
- "Harris calls for immigration reform" → is_opposition_advocacy: true (if in opposition)
- "Minister announces €100M funding" → is_opposition_advocacy: false
- "TD unveils housing plan" → is_opposition_advocacy: false

**CRITICAL - Flip-Flop Detection Against Party Position:**

${politician.party ? `
The TD is from ${politician.party}. Their party's ESTABLISHED positions on key dimensions are:
- Cultural/Immigration: ${partyPositions.cultural_score || 'unknown'} (scale: -10 to +10)
  * ${partyPositions.cultural_score > 5 ? '🔴 RESTRICTIVE immigration stance' : partyPositions.cultural_score < -2 ? '🟢 OPEN/PRO-IMMIGRATION stance' : '⚪ MODERATE stance'}
- Economic: ${partyPositions.economic_score || 'unknown'} (-10=left, +10=right)
- Social: ${partyPositions.social_score || 'unknown'} (-10=liberal, +10=conservative)
- Environmental: ${partyPositions.environmental_score || 'unknown'} (-10=growth, +10=green)
- Welfare: ${partyPositions.welfare_score || 'unknown'} (-10=restrictive, +10=generous)

**YOUR CRITICAL TASK**: Determine if ${politician.name} is CONTRADICTING ${politician.party}'s position:

IMPORTANT EXAMPLES:
- If ${politician.party} has cultural_score = +3 (moderate pro-immigration)
  AND the TD is calling for "immigration restrictions" or saying "numbers too high"
  → This is a MAJOR flip-flop (at least 8 points deviation)
  → Set flip_flop_detected = "major"
  
- If the article mentions RIOTS or VIOLENCE in context of immigration
  AND the TD shifts to a more restrictive position
  → This is SUSPICIOUS TIMING (responding to pressure, not principles)
  → Set suspicious_timing = true

Set "flip_flop_detected" based on how far TD deviates from party position:
- "major": 8+ points away (e.g., party=+3 pro-immigration, TD taking anti-immigration stance)
- "moderate": 5-7 points away
- "minor": 3-4 points away  
- "none": within 3 points (normal party variation)

Set "flip_flop_explanation" to explain:
- What dimension they deviated on
- How far they deviated from party position
- Whether this seems like principles or political opportunism

Set "suspicious_timing" to true if:
- Article mentions riots/arson/violence AND TD suddenly changes position
- TD responding to political pressure vs standing by principles
- Timing suggests knee-jerk reaction vs thoughtful policy evolution
` : ''}


**CRITICAL - Is This Ideologically Divisive?**

If the article is about a POLICY where reasonable people disagree:
- ✅ "Asylum seeker rent" → is_ideological_policy: true
- ✅ "Carbon tax increase" → is_ideological_policy: true
- ✅ "Welfare cuts" → is_ideological_policy: true
- ✅ "Immigration controls" → is_ideological_policy: true
- ❌ "Corruption scandal" → is_ideological_policy: false (everyone agrees bad)
- ❌ "Broke campaign promise" → is_ideological_policy: false (objective)

**For ideological policies:**
- Extract FACTS neutrally (amounts, people, timeline)
- Extract what BOTH sides say (supporters + critics)
- Score PROCESS (were they transparent? consistent? honest?)
- DON'T judge if policy is good/bad → Users vote on that!

**For non-ideological (scandals, corruption, lying):**
- Score normally (everyone agrees these are bad)
- Negative impact_score appropriate

**Policy Direction Classification:**
- progressive: Left-wing policy (welfare, immigration, rights)
- conservative: Right-wing policy (fiscal, security, traditional)
- centrist: Middle-ground compromise
- technical: Non-ideological procedural matter

**Examples:**

GOOD (Process scoring):
- "TD promised hospital funding, delivered 90% on time" → effectiveness: 90
- "TD announced policy, explained it clearly in Dáil" → transparency: 85
- "TD flip-flopped on carbon tax after election" → consistency: 25

BAD (Policy judgment - DON'T do this):
- "TD introduced asylum seeker rent" → DON'T score as positive or negative!
- "TD increased welfare" → DON'T score as good!
- "TD cut taxes" → DON'T score as bad!

Extract neutral facts instead, let users decide if they support the policy.
`;

const INSUFFICIENT_REASONING_PATTERNS = [
  'lack of information',
  'lack of detail',
  'lack of details',
  'insufficient information',
  'insufficient detail',
  'insufficient data',
  'not enough information',
  'not enough detail',
  'not enough data',
  'cannot assess',
  'cannot be assessed',
  'cannot evaluate',
  'unable to assess',
  'unable to evaluate',
  'not possible to assess',
  'no specific details',
  'no detail is provided',
  'article does not provide',
  'article does not mention specific',
  'does not include specific details',
  'information is unavailable',
  'information was unavailable',
  'no information is provided'
];

function clampProcessScore(score: unknown): number | null {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function isInsufficientReasoning(reasoning?: string | null): boolean {
  if (!reasoning) return false;
  const normalized = reasoning.toLowerCase();
  return INSUFFICIENT_REASONING_PATTERNS.some(pattern => normalized.includes(pattern));
}

function normalizeProcessScore(score: unknown, reasoning?: string | null): number | null {
  const clamped = clampProcessScore(score);
  if (clamped === null) return null;
  return isInsufficientReasoning(reasoning) ? null : clamped;
}

/**
 * Convert process score (0-100) to impact score (-10 to +10)
 */
function processScoreToImpact(processScore?: number | null): number | null {
  if (processScore === null || processScore === undefined) {
    return null;
  }
  if (processScore >= 90) return Math.round((processScore - 90) / 1 + 8);  // 90-100 → +8 to +10
  if (processScore >= 70) return Math.round((processScore - 70) / 5 + 3);  // 70-89 → +3 to +7
  if (processScore >= 50) return Math.round((processScore - 50) / 10);     // 50-69 → -2 to +2
  if (processScore >= 30) return Math.round((processScore - 50) / 5);      // 30-49 → -7 to -3
  return Math.round((processScore - 30) / 3 - 10);                          // 0-29 → -10 to -8
}

/**
 * Analyze article with OpenAI (primary analysis)
 */
export async function analyzeArticleWithOpenAI(
  article: unknown,
  politician: { name: string; constituency: string; party?: string }
): Promise<ArticleAnalysis> {
  
  // Fetch party positions if TD has a party
  let partyPositions = {};
  if (politician.party) {
    const { supabaseDb } = await import('../db.js');
    const { data } = await supabaseDb
      .from('parties')
      .select('economic_score, social_score, cultural_score, globalism_score, environmental_score, authority_score, welfare_score, technocratic_score')
      .eq('name', politician.party)
      .single();
    
    if (data) {
      partyPositions = data;
    }
  }
  
  try {
    const response = await callChatCompletion({
      model: 'gpt-4o-mini',  // Fast and cheap
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'system',
        content: `You are a MAXIMALLY TRUTH-SEEKING political analyst with ONE GOAL: Discover and report the truth.

Your duty is to intellectual honesty, not to politicians or parties.

BE RIGOROUS. BE SKEPTICAL. BE FAIR. BE HONEST.

Score PROCESS not POLICY. Detect flip-flops. Hold politicians accountable.

Respond ONLY with valid JSON.`
      }, {
        role: 'user',
        content: ANALYSIS_PROMPT(article, politician, partyPositions)
      }]
    }, { operation: 'newsAnalysis' });

    const analysisText = response.choices[0].message.content || '{}';
    const analysis: ArticleAnalysis = JSON.parse(analysisText);
    analysis.analyzed_by = 'gpt4';
    analysis.confidence = 0.85;
    analysis.transparency_score = normalizeProcessScore(analysis.transparency_score, analysis.transparency_reasoning);
    analysis.effectiveness_score = normalizeProcessScore(analysis.effectiveness_score, analysis.effectiveness_reasoning);
    analysis.integrity_score = normalizeProcessScore(analysis.integrity_score, analysis.integrity_reasoning);
    analysis.consistency_score = normalizeProcessScore(analysis.consistency_score, analysis.consistency_reasoning);
    
    // FLIP-FLOP PENALTY: Apply consistency adjustment based on LLM detection
    const flipFlopDetected = (analysis as unknown).flip_flop_detected || 'none';
    const flipFlopExplanation = (analysis as unknown).flip_flop_explanation || '';
    const suspiciousTiming = (analysis as unknown).suspicious_timing || false;
    
    let consistencyPenalty = 0;
    let needsReview = false;
    
    if (flipFlopDetected === 'major') {
      consistencyPenalty = -40;
      needsReview = true;
      console.log(`   🚨 MAJOR FLIP-FLOP DETECTED: ${flipFlopExplanation}`);
    } else if (flipFlopDetected === 'moderate') {
      consistencyPenalty = -20;
      needsReview = true;
      console.log(`   ⚠️  MODERATE FLIP-FLOP DETECTED: ${flipFlopExplanation}`);
    } else if (flipFlopDetected === 'minor') {
      consistencyPenalty = -5;
      console.log(`   ℹ️  Minor deviation: ${flipFlopExplanation}`);
    }
    
    if (suspiciousTiming) {
      console.log(`   ⏰ SUSPICIOUS TIMING DETECTED - Flagged for review`);
      needsReview = true;
    }
    
    // Apply penalty to consistency score
    if (
      consistencyPenalty !== 0 &&
      typeof analysis.consistency_score === 'number' &&
      Number.isFinite(analysis.consistency_score)
    ) {
      const originalConsistency = analysis.consistency_score;
      analysis.consistency_score = Math.min(100, Math.max(0, analysis.consistency_score + consistencyPenalty));
      console.log(`   📉 Consistency adjusted: ${originalConsistency} → ${analysis.consistency_score} (${consistencyPenalty})`);
    }
    
    // Store flip-flop context for display
    analysis.historical_context = {
      hasFlipFlop: flipFlopDetected !== 'none',
      flipFlopSeverity: flipFlopDetected as unknown,
      flipFlopDetails: flipFlopExplanation,
      needsHumanReview: needsReview,
      suspiciousTiming: suspiciousTiming,
      reviewReason: needsReview ? `${flipFlopDetected.toUpperCase()} FLIP-FLOP: ${flipFlopExplanation}` : undefined
    };
    analysis.consistency_penalty_applied = consistencyPenalty;
    
    // AUTO-CALCULATE impact scores from process scores (after penalties applied)
    // This ensures ELO changes reflect the adjusted 0-100 scores
    analysis.transparency_impact = processScoreToImpact(analysis.transparency_score);
    analysis.effectiveness_impact = processScoreToImpact(analysis.effectiveness_score);
    analysis.integrity_impact = processScoreToImpact(analysis.integrity_score);
    analysis.consistency_impact = processScoreToImpact(analysis.consistency_score);
    analysis.constituency_service_impact = 0; // Not tracked in process scores yet
    
    // Overall impact score: average of dimensional impacts (exclude N/A scores)
    const impactComponents = [
      analysis.transparency_impact,
      analysis.effectiveness_impact,
      analysis.integrity_impact,
      analysis.consistency_impact
    ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    
    if (impactComponents.length > 0) {
      const avgImpact = impactComponents.reduce((sum, value) => sum + value, 0) / impactComponents.length;
      analysis.impact_score = Math.round(avgImpact);
    } else {
      analysis.impact_score = 0;
    }
    
    return analysis;
    
  } catch (error) {
    console.error('OpenAI analysis failed:', error);
    throw error;
  }
}

// Removed - using OpenAI for everything now (analyzeArticleWithGPT4 replaced by analyzeArticleWithOpenAI)

/**
 * Analyze article with AI (with optional cross-checking)
 */
export async function analyzeArticle(
  article: unknown,
  politician: { name: string; constituency: string; party?: string },
  options: { crossCheck?: boolean } = {}
): Promise<ArticleAnalysis> {
  
  console.log(`🤖 Analyzing article about ${politician.name}...`);
  console.log(`   Title: ${article.title}`);
  
  // Primary analysis with OpenAI
  const primaryAnalysis = await analyzeArticleWithOpenAI(article, politician);
  
  // For high-impact stories, get second opinion (optional)
  if (options.crossCheck && Math.abs(primaryAnalysis.impact_score) > 6) {
    console.log(`   🔍 High-impact score detected (${primaryAnalysis.impact_score}) - getting second opinion...`);
    
    try {
      const secondAnalysis = await analyzeArticleWithOpenAI(article, politician);
      
      // Compare the two analyses
      const scoreDiff = Math.abs(secondAnalysis.impact_score - primaryAnalysis.impact_score);
      
      if (scoreDiff > 3) {
        console.log(`   ⚠️  Analyses differ: First: ${primaryAnalysis.impact_score}, Second: ${secondAnalysis.impact_score}`);
        primaryAnalysis.credibility_check.concerns.push(
          `Multiple analyses differ (difference: ${scoreDiff.toFixed(1)} points) - flagged for review`
        );
        primaryAnalysis.confidence = 0.6; // Lower confidence when analyses disagree
      } else {
        console.log(`   ✅ Analyses agree (difference: ${scoreDiff.toFixed(1)} points)`);
        // Average the scores when they agree
        primaryAnalysis.impact_score = (primaryAnalysis.impact_score + secondAnalysis.impact_score) / 2;
        primaryAnalysis.confidence = 0.95; // Higher confidence when they agree
      }
      
      primaryAnalysis.analyzed_by = 'both';
      
    } catch (error) {
      console.error('   ❌ Second analysis failed, using primary analysis only');
    }
  }
  
  console.log(`   📊 Initial Result: ${primaryAnalysis.story_type} (${primaryAnalysis.sentiment}) - Impact: ${primaryAnalysis.impact_score}`);
  
  // BIAS PROTECTION: Apply critical analysis for positive articles
  // BUT SKIP for:
  // 1. Opposition advocacy work (LLM determined: TD calling out issues, criticizing govt)
  // 2. Scandals/controversies (already negative)
  // 3. Articles with neutral/low impact (no spin to counter)
  
  const isOppositionAdvocacy = primaryAnalysis.is_opposition_advocacy;  // ← LLM determines this!
  const isAlreadyNegative = primaryAnalysis.story_type === 'controversy' || primaryAnalysis.story_type === 'scandal';
  const needsBiasProtection = !isOppositionAdvocacy && !isAlreadyNegative && (primaryAnalysis.impact_score > 2 || primaryAnalysis.sentiment.includes('positive'));
  
  if (needsBiasProtection) {
    console.log(`   🔍 Applying bias protection (critical analysis)...`);
    
    const biasProtectedAnalysis = await applyBiasProtection(
      article,
      politician,
      primaryAnalysis
    );
    
    console.log(`   📊 Bias-Protected Impact: ${primaryAnalysis.impact_score} → ${biasProtectedAnalysis.bias_adjustments?.final_adjusted_impact}`);
    
    return biasProtectedAnalysis;
  }
  
  if (isOppositionAdvocacy) {
    console.log(`   ✅ Opposition advocacy (LLM detected) - no bias protection needed`);
  }
  
  // Historical context and flip-flop detection already done by LLM in analyzeArticleWithOpenAI
  // No need for separate keyword-based check
  
  return primaryAnalysis;
}

/**
 * BIAS PROTECTION LAYER
 * Applies critical analysis to counter media spin
 * NOTE: Now skipped for opposition advocacy work (determined by LLM)
 */
async function applyBiasProtection(
  article: unknown,
  politician: unknown,
  initialAnalysis: ArticleAnalysis
): Promise<ArticleAnalysis> {
  
  try {
    // Step 1: Detect announcement vs achievement
    const isAnnouncement = detectAnnouncement(article);
    
    // Step 2: Generate critical analysis (devil's advocate)
    const criticalAnalysis = await generateCriticalAnalysis(article, politician, initialAnalysis);
    
    // Step 3: Calculate adjustments
    let adjustedImpact = initialAnalysis.impact_score;
    const adjustments = {
      announcement_reduction: 0,
      critical_blend: initialAnalysis.impact_score,
      source_bias_adjustment: 0,
      final_adjusted_impact: adjustedImpact
    };
    
    // Reduce score for announcements
    if (isAnnouncement) {
      adjustments.announcement_reduction = adjustedImpact * 0.70;  // 70% reduction
      adjustedImpact = Math.round(adjustedImpact * 0.30);  // Keep only 30%
      console.log(`     Announcement detected: Reduced from ${initialAnalysis.impact_score} to ${adjustedImpact}`);
    }
    
    // Blend with critical analysis
    if (criticalAnalysis) {
      const blended = Math.round(
        (adjustedImpact * 0.40) + (criticalAnalysis.critical_impact * 0.60)
      );
      console.log(`     Critical blend: ${adjustedImpact} (optimistic) + ${criticalAnalysis.critical_impact} (critical) = ${blended}`);
      adjustments.critical_blend = blended;
      adjustedImpact = blended;
    }
    
    // Adjust for source bias
    const sourceBias = getSourceBias(article.source);
    if (sourceBias !== 0 && adjustedImpact > 0) {
      const biasAdjustment = Math.round(adjustedImpact * Math.abs(sourceBias));
      adjustedImpact = adjustedImpact - biasAdjustment;
      adjustments.source_bias_adjustment = biasAdjustment;
      console.log(`     Source bias (${sourceBias}): Reduced by ${biasAdjustment}`);
    }
    
    adjustments.final_adjusted_impact = adjustedImpact;
    
    return {
      ...initialAnalysis,
      is_announcement: isAnnouncement,
      critical_analysis: criticalAnalysis,
      bias_adjustments: adjustments,
      impact_score: adjustedImpact  // Use adjusted impact!
    };
    
  } catch (error) {
    console.error('     ⚠️  Bias protection failed, using original analysis');
    return initialAnalysis;
  }
}

/**
 * Detect if article is announcement vs achievement
 */
function detectAnnouncement(article: unknown): boolean {
  const text = (article.title + ' ' + article.content).toLowerCase();
  
  const announcementIndicators = [
    'announces', 'will', 'plans to', 'pledges', 'promises',
    'to launch', 'to introduce', 'to deliver', 'commits to',
    'unveils plan', 'reveals scheme', 'sets out'
  ];
  
  const achievementIndicators = [
    'delivered', 'completed', 'achieved', 'passed',
    'implemented', 'launched', 'opened', 'signed into law',
    'approved and enacted'
  ];
  
  const hasAnnouncement = announcementIndicators.some(word => text.includes(word));
  const hasAchievement = achievementIndicators.some(word => text.includes(word));
  
  // If has announcement words but not achievement words = announcement
  return hasAnnouncement && !hasAchievement;
}

/**
 * Generate critical analysis (devil's advocate)
 */
async function generateCriticalAnalysis(
  article: unknown,
  politician: unknown,
  initialAnalysis: ArticleAnalysis
): Promise<{
  critical_impact: number;
  downsides: string[];
  reality_check: string;
  exaggeration_detected: boolean;
} | null> {
  
  try {
    const criticalPrompt = `
You are a CRITICAL analyst reviewing this article about ${politician.name}.

The article presents this positively:
Title: ${article.title}
Initial AI Assessment: ${initialAnalysis.sentiment}, impact +${initialAnalysis.impact_score}

NOW PLAY DEVIL'S ADVOCATE:

Critical Questions:
1. What are the DOWNSIDES not mentioned in the article?
2. What would CRITICS and OPPOSITION TDs say about this?
3. Is the IMPACT actually as big as claimed, or is it modest/minimal?
4. Who BENEFITS and who is LEFT OUT?
5. Is this SPIN or SUBSTANCE?
6. Does this actually SOLVE the problem or just sound good?

Be skeptical and critical. Look for:
- Exaggerated claims
- Missing context
- People/issues not helped
- Real scale of impact vs claimed impact
- Whether this is announcement vs delivery

Respond with ONLY JSON:
{
  "critical_impact": -5 to +5,
  "downsides": ["downside 1", "downside 2"],
  "reality_check": "What's really happening beyond the spin",
  "exaggeration_detected": true/false,
  "who_benefits": "Who actually benefits",
  "who_left_out": "Who is ignored or harmed"
}
`;

    const response = await callChatCompletion({
      model: 'gpt-4o-mini',
      temperature: 0.5, // Slightly higher for more critical thinking
      response_format: { type: 'json_object' },
      messages: [{
        role: 'system',
        content: 'You are a critical political analyst who plays devil\'s advocate. Be skeptical. Respond ONLY with JSON.'
      }, {
        role: 'user',
        content: criticalPrompt
      }]
    }, { operation: 'criticalAnalysis' });
    
    const analysisText = response.choices[0].message.content || '{}';
    const critical = JSON.parse(analysisText);
    console.log(`     Critical analysis: Impact ${critical.critical_impact} (vs optimistic ${initialAnalysis.impact_score})`);
    return critical;
    
  } catch (error) {
    console.error('     Critical analysis failed:', error);
    return null;
  }
}

/**
 * Get source bias adjustment
 */
function getSourceBias(sourceName: string): number {
  const biasMap: Record<string, number> = {
    // ESTABLISHMENT (Pro-government bias)
    'RTE News': 0.15,
    'The Irish Times': 0.10,
    'Irish Independent': 0.08,
    
    // BALANCED (Minimal bias)
    'The Journal': 0.0,
    'Irish Examiner': 0.0,
    'Breaking News': 0.0,
    'Noteworthy': 0.0,
    'Irish Legal News': 0.0,
    
    // CRITICAL (Anti-establishment bias)
    'Business Post': -0.05,
    'Gript Media': -0.20,
    'The Ditch': -0.18
  };
  
  return biasMap[sourceName] || 0;
}

/**
 * Batch analyze multiple articles
 */
export async function batchAnalyzeArticles(
  articlesWithPoliticians: Array<{ article: unknown; politician: unknown }>,
  options: { crossCheck?: boolean; rateLimit?: number } = {}
): Promise<Array<{ article: unknown; politician: unknown; analysis: ArticleAnalysis }>> {
  
  const results = [];
  const rateLimit = options.rateLimit || 2000; // 2 seconds between requests
  
  console.log(`🤖 Batch analyzing ${articlesWithPoliticians.length} articles...`);
  
  for (let i = 0; i < articlesWithPoliticians.length; i++) {
    const { article, politician } = articlesWithPoliticians[i];
    
    console.log(`\n[${i + 1}/${articlesWithPoliticians.length}] Processing...`);
    
    try {
      const analysis = await analyzeArticle(article, politician, options);
      results.push({ article, politician, analysis });
      
    } catch (error) {
      console.error(`❌ Analysis failed for ${politician.name}:`, error);
      // Continue with next article
    }
    
    // Rate limiting to avoid hitting API limits
    if (i < articlesWithPoliticians.length - 1) {
      await sleep(rateLimit);
    }
  }
  
  console.log(`\n✅ Batch analysis complete: ${results.length}/${articlesWithPoliticians.length} successful`);
  
  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * NEW: Use AI to extract relevant TDs from article
 * This replaces keyword matching - AI is much smarter!
 * 
 * AI can detect:
 * - Title-only references ("Tánaiste says...")
 * - Indirect references ("The government announced...")
 * - Policy impacts on multiple TDs
 * - Opposition criticism without naming specific TDs
 */
export async function extractRelevantTDsFromArticle(
  article: unknown,
  options: { useKeywordFallback?: boolean } = {}
): Promise<Array<{ name: string; constituency: string; party: string; confidence: number }>> {
  
  try {
    const prompt = `
You are analyzing an Irish political news article to identify which TDs (Teachtaí Dála - members of parliament) are SUBSTANTIALLY relevant.

Article:
Title: ${article.title}
Content: ${article.content?.substring(0, 2000) || article.description || ''}

Your task: Identify ALL TDs who are:
1. Directly mentioned by name (e.g., "Simon Harris said...")
2. Referenced by title only (e.g., "The Tánaiste defended..." = Simon Harris)
3. Part of a group mentioned (e.g., "Opposition TDs criticized..." = identify specific TDs if named)
4. Affected by policy discussed (e.g., "Government housing plan..." = Housing Minister)
5. Making or defending decisions

Current Government (for title mapping):
- Taoiseach: Micheál Martin (Fianna Fáil)
- Tánaiste: Simon Harris (Fine Gael)
- Minister for Housing: Darragh O'Brien (Fianna Fáil)
- Minister for Health: Stephen Donnelly (Fianna Fáil)
- Minister for Finance: Michael McGrath (Fianna Fáil)
- Minister for Justice: Helen McEntee (Fine Gael)

IMPORTANT RULES:
- Only include TDs if they are SUBSTANTIALLY involved in the story
- For generic "opposition TDs" without specific names, return empty array
- For titles like "Tánaiste", map to the correct person (Simon Harris)
- Be conservative - only include TDs who are clearly relevant
- Return empty array if article is just general news without specific TD involvement

Respond with ONLY JSON:
{
  "tds": [
    {
      "name": "Simon Harris",
      "confidence": 0.95,
      "reasoning": "Referenced as Tánaiste making statement"
    }
  ]
}

If NO specific TDs are relevant, return: {"tds": []}
`;

    const response = await callChatCompletion({
      model: 'gpt-4o-mini',
      temperature: 0.2, // Low temperature for factual extraction
      response_format: { type: 'json_object' },
      messages: [{
        role: 'system',
        content: 'You are an AI that extracts TD names from Irish political articles. Respond ONLY with JSON.'
      }, {
        role: 'user',
        content: prompt
      }]
    }, { operation: 'tdExtraction' });
    
    const resultText = response.choices[0].message.content || '{"tds":[]}';
    const result = JSON.parse(resultText);
    const extractedTDs = result.tds || [];
    
    console.log(`   🤖 AI extracted ${extractedTDs.length} TDs`);
    
    // Now match AI-extracted names to actual TDs in database
    const { TDExtractionService } = await import('./tdExtractionService.js');
    await TDExtractionService.reloadTDs(); // Ensure TDs are loaded
    
    const matchedTDs = [];
    for (const aiTD of extractedTDs) {
      // Try to find this TD in our database by name matching
      const tdMentions = await TDExtractionService.extractTDMentions(aiTD.name);
      if (tdMentions.length > 0) {
        console.log(`      ✅ Matched: ${aiTD.name} → ${tdMentions[0].name}`);
        matchedTDs.push({
          name: tdMentions[0].name,
          constituency: tdMentions[0].constituency,
          party: tdMentions[0].party,
          confidence: aiTD.confidence || 0.85
        });
      } else {
        console.log(`      ⚠️ Could not match: ${aiTD.name} (not in database)`);
      }
    }
    
    return matchedTDs;
    
  } catch (error) {
    console.error('   ⚠️ AI TD extraction failed:', error);
    
    // Fallback to keyword extraction if requested
    if (options.useKeywordFallback) {
      console.log('   🔄 Falling back to keyword extraction');
      const { TDExtractionService } = await import('./tdExtractionService.js');
      const mentions = await TDExtractionService.extractTDMentions(
        article.title + ' ' + (article.content || article.description || '')
      );
      return mentions.map(m => ({
        name: m.name,
        constituency: m.constituency,
        party: m.party,
        confidence: m.confidence
      }));
    }
    
    return [];
  }
}

/** AI-powered news analysis service methods. */
export const AINewsAnalysisService = {
  analyzeArticle,
  analyzeArticleWithOpenAI,
  batchAnalyzeArticles,
  extractRelevantTDsFromArticle  // NEW FUNCTION
};



