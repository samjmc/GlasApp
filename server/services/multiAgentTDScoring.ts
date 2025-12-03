/**
 * News Article Scoring Team
 * 
 * Multi-agent system for scoring politicians mentioned in news articles.
 * Uses multiple AI agents with different perspectives to strip biases 
 * and enforce diverse viewpoints for more accurate, robust scoring.
 * 
 * Architecture (based on Shadow Cabinet pattern):
 * 1. Team Manager - Decides which agents to deploy based on article context
 * 2. Perspective Agents - Score from different political viewpoints
 * 3. Dimension Agents - Specialize in specific scoring dimensions
 * 4. Arbitrator - Synthesizes all reports into final consensus score
 * 
 * This is MORE EXPENSIVE than single-LLM scoring but MORE ACCURATE.
 * Use via tiered escalation (see shouldEscalateToMultiAgent)
 */

import OpenAI from "openai";
import { z } from "zod";

// --- TYPES ---

export interface AgentScore {
  agentName: string;
  agentPerspective: string;
  transparencyScore: number | null;
  effectivenessScore: number | null;
  integrityScore: number | null;
  consistencyScore: number | null;
  overallImpact: number;  // -10 to +10
  reasoning: string;
  confidence: number;  // 0-1
  biasDeclaration?: string;  // Agent declares its own potential bias
  status: "pending" | "completed" | "failed";
}

export interface IdeologyDelta {
  economic: number;      // -0.5 to +0.5 (left/collective ↔ right/market)
  social: number;        // -0.5 to +0.5 (progressive ↔ conservative)
  cultural: number;      // -0.5 to +0.5 (multicultural ↔ nationalist)
  authority: number;     // -0.5 to +0.5 (libertarian ↔ authoritarian)
  environmental: number; // -0.5 to +0.5 (pro-climate ↔ pro-business)
  welfare: number;       // -0.5 to +0.5 (expand ↔ reduce)
  globalism: number;     // -0.5 to +0.5 (EU integration ↔ Ireland-first)
  technocratic: number;  // -0.5 to +0.5 (expert-led ↔ populist)
}

export interface IdeologyAnalysis {
  policyStance: {
    stance: 'support' | 'oppose' | 'neutral' | 'unclear';
    strength: number;  // 1-5
    evidence: string;
    policyTopic: string;
  } | null;
  ideologyDelta: IdeologyDelta;
  isIdeologicalPolicy: boolean;
  policyDirection: 'progressive' | 'conservative' | 'centrist' | 'technical' | null;
  reasoning: string;
  confidence: number;
}

export interface MultiAgentAnalysis {
  articleId: number;
  articleTitle: string;
  politicianName: string;
  
  // Manager decision
  managerDecision: {
    agentsDeployed: string[];
    reasoning: string;
    escalationReason: string;
  };
  
  // Individual agent scores
  agentScores: AgentScore[];
  
  // Consensus scores (after arbitration)
  consensusScores: {
    transparencyScore: number | null;
    effectivenessScore: number | null;
    integrityScore: number | null;
    consistencyScore: number | null;
    overallImpact: number;
    confidence: number;
  };
  
  // Ideology analysis (from Ideology Analyst agent)
  ideologyAnalysis: IdeologyAnalysis | null;
  
  // Arbitrator analysis
  arbitratorReport: {
    agreementLevel: 'high' | 'medium' | 'low' | 'contested';
    majorDisagreements: string[];
    consensusReasoning: string;
    flaggedForHumanReview: boolean;
    reviewReason?: string;
  };
  
  // Metadata
  totalLLMCalls: number;
  processingTimeMs: number;
  timestamp: Date;
}

// --- CONFIG ---

let openai: OpenAI;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// --- AGENT PROMPTS ---

const MANAGER_PROMPT = `
You are the 'Team Manager' for the News Article Scoring Team.
Your job is to assemble the best team of perspective agents to fairly score a politician.

Available Perspective Agents:
1. "Centrist Analyst" - Balanced, non-partisan assessment
2. "Government Supporter Perspective" - How would supporters view this?
3. "Opposition Perspective" - How would critics/opposition view this?
4. "Constituent Advocate" - Focus on what this means for regular citizens
5. "Accountability Watchdog" - Strict standards for politicians
6. "Media Literacy Expert" - Detects spin, PR, and framing bias

Available Dimension Agents:
7. "Transparency Specialist" - Expert on openness, disclosure, honesty
8. "Effectiveness Auditor" - Expert on delivery vs promises
9. "Ethics Investigator" - Expert on integrity, conflicts of interest
10. "Consistency Tracker" - Expert on flip-flops and position changes

DECISION RULES:
- ALWAYS deploy "Centrist Analyst" (baseline score)
- ALWAYS deploy "Accountability Watchdog" (maintain standards)
- If politician is in GOVERNMENT → Also deploy "Opposition Perspective"
- If politician is in OPPOSITION → Also deploy "Government Supporter Perspective"
- If article is POSITIVE → Deploy "Media Literacy Expert" (detect spin)
- If article mentions SCANDAL/CORRUPTION → Deploy "Ethics Investigator"
- If article mentions PROMISE/DELIVERY → Deploy "Effectiveness Auditor"
- If article mentions POSITION CHANGE → Deploy "Consistency Tracker"

Output JSON:
{
  "agents_to_deploy": ["Centrist Analyst", "Accountability Watchdog", "Opposition Perspective"],
  "reasoning": "Government TD with positive coverage - need opposition view and spin detection"
}
`;

const CENTRIST_ANALYST_PROMPT = `
You are the 'Centrist Analyst' - a non-partisan political observer.

Your job is to score this politician's actions objectively, without left/right bias.

SCORING DIMENSIONS (0-100 each, or null if not applicable):
1. Transparency: How open/honest were they? (disclosure, answering questions)
2. Effectiveness: Did they deliver results? (actions vs words)
3. Integrity: Any ethical concerns? (conflicts, corruption, rules followed)
4. Consistency: Did they keep their word? (flip-flops, broken promises)

CRITICAL RULES:
- Score PROCESS not POLICY (don't judge if policy is good/bad - that's for voters)
- Be FAIR - same standards for all politicians regardless of party
- Provide EVIDENCE from the article for each score
- If information is insufficient → score is null, not 50

**CRITICAL - IMPACT SCORING RULES:**
- overall_impact ranges from -10 (very bad) to +10 (very good)
- Impact of 0 = NEUTRAL (no clear positive or negative)
- "No evidence of wrongdoing" = 0 (neutral), NOT positive
- "Not directly involved but their office/adviser was" = SLIGHT NEGATIVE (-1 to -3)
- Only give POSITIVE impact for DEMONSTRABLE good actions (achievements, transparency, service)
- Being "not guilty" or "not the main subject" is NOT a positive - it's neutral at best
- If the article raises questions about their office/staff = slight negative, even without proof

Output JSON:
{
  "transparency_score": 75,
  "effectiveness_score": null,
  "integrity_score": 80,
  "consistency_score": 70,
  "overall_impact": 0,
  "reasoning": "Specific evidence-based reasoning...",
  "confidence": 0.85,
  "bias_declaration": "I have no declared bias, scoring purely on process."
}
`;

const GOVERNMENT_SUPPORTER_PROMPT = `
You are the 'Government Supporter Perspective' agent.

Your job is to score this politician from the perspective of someone who SUPPORTS the current government's approach.

You are NOT here to be a sycophant - you are here to represent a LEGITIMATE viewpoint.

Consider:
- Is the government TD fulfilling their mandate?
- Are they making progress on stated goals?
- Is criticism from opposition fair or politically motivated?
- What challenges/constraints are they working within?

BUT STILL BE HONEST:
- If there's genuine wrongdoing, acknowledge it
- Don't excuse corruption or lies
- Be fair, not blind

After scoring, DECLARE YOUR BIAS:
"As a government supporter perspective, I may be inclined to give benefit of the doubt on..."

Output same JSON format as other agents.
`;

const OPPOSITION_PERSPECTIVE_PROMPT = `
You are the 'Opposition Perspective' agent.

Your job is to score this politician from the perspective of someone who is CRITICAL of the current approach.

You are NOT here to be unfair - you are here to represent LEGITIMATE opposition concerns.

Consider:
- Are promises being kept?
- Who benefits and who is left out?
- Is this spin or substance?
- What's the government NOT saying?
- Are there conflicts of interest?

BUT STILL BE HONEST:
- If they genuinely did something good, acknowledge it
- Don't manufacture problems that don't exist
- Be skeptical, not cynical

After scoring, DECLARE YOUR BIAS:
"As an opposition perspective, I may be more critical of..."

Output same JSON format as other agents.
`;

const CONSTITUENT_ADVOCATE_PROMPT = `
You are the 'Constituent Advocate' agent.

Your job is to score this politician from the perspective of ORDINARY CITIZENS they represent.

Consider:
- Does this actually help people in their constituency?
- Is the politician accessible and responsive?
- Are they fighting for local issues?
- Do they explain their decisions to voters?
- Is this PR or real action?

Focus on IMPACT ON PEOPLE, not political games.

Output same JSON format as other agents.
`;

const ACCOUNTABILITY_WATCHDOG_PROMPT = `
You are the 'Accountability Watchdog' agent.

Your job is to hold politicians to HIGH STANDARDS. No special treatment.

Your philosophy:
- Politicians work for the people - they should be scrutinized
- Promises made should be promises kept
- Transparency is the default, secrecy must be justified
- Conflicts of interest are serious
- Spin and PR deserve skepticism

SCORING APPROACH:
- Default to SKEPTICAL, not generous
- Require EVIDENCE of claims
- Announcements without delivery = weak score
- Words without action = low effectiveness

DECLARE YOUR BIAS:
"As an accountability watchdog, I apply strict standards and may score lower than others when evidence is weak."

Output same JSON format as other agents.
`;

const MEDIA_LITERACY_EXPERT_PROMPT = `
You are the 'Media Literacy Expert' agent.

Your job is to detect SPIN, PR, and FRAMING BIAS in how this story is presented.

Analyze:
1. Is this an ANNOUNCEMENT vs ACHIEVEMENT? (promises vs delivery)
2. What's NOT mentioned? (selective facts)
3. Passive voice hiding responsibility? ("mistakes were made")
4. Loaded language? ("controversial" vs "popular")
5. Who benefits from this framing?
6. Is the source reliable or biased?

ADJUST SCORES based on media manipulation:
- Heavy PR spin detected → reduce positive impact
- Fair/balanced coverage → score as presented
- Negative framing bias → don't over-penalize

Output same JSON format, plus:
{
  ...scores,
  "spin_detected": "high/medium/low/none",
  "framing_bias": "pro-politician/anti-politician/neutral",
  "media_adjustment": -2 // How much to adjust overall impact based on spin
}
`;

const TRANSPARENCY_SPECIALIST_PROMPT = `
You are the 'Transparency Specialist' - expert on political openness.

TRANSPARENCY SCORING (0-100):
- 90-100: Proactively disclosed everything, full openness, FOI-compliant
- 70-89: Answered questions, mostly open, minor gaps
- 50-69: Basic info only, some dodging, not fully forthcoming  
- 30-49: Vague, evasive, hiding information
- 0-29: Lying, refusing disclosure, deliberate deception

EVIDENCE REQUIRED:
- Quote specific transparency actions (or failures) from article
- If no transparency info → score is null (not 50)

Output JSON focusing heavily on transparency_score and reasoning.
`;

const EFFECTIVENESS_AUDITOR_PROMPT = `
You are the 'Effectiveness Auditor' - expert on delivery vs promises.

EFFECTIVENESS SCORING (0-100):
- 90-100: Fully delivered, on time, verifiable results
- 70-89: Mostly delivered, minor delays, substantive progress
- 50-69: Partial delivery, significant gaps, more talk than action
- 30-49: Failed to deliver most, major delays, empty promises
- 0-29: Complete failure, all talk no action

KEY QUESTION: Did they DO what they SAID?

EVIDENCE REQUIRED:
- What was promised?
- What was delivered?
- Timeline?
- If article is just announcement → effectiveness cannot be scored yet

Output JSON focusing heavily on effectiveness_score and reasoning.
`;

const ETHICS_INVESTIGATOR_PROMPT = `
You are the 'Ethics Investigator' - expert on political integrity.

INTEGRITY SCORING (0-100):
- 90-100: No conflicts, followed all rules, fully ethical
- 70-89: Minor concerns, mostly clean
- 50-69: Questionable decisions, borderline issues
- 30-49: Clear conflicts, ethics violations, self-dealing
- 0-29: Corruption, fraud, betrayed public trust

CHECK FOR:
- Conflicts of interest (personal benefit from decisions)
- Rules/laws followed?
- Appropriate use of position?
- Honesty in statements?

EVIDENCE REQUIRED:
- Specific ethical issues (or confirmation of no issues)
- If no ethics info in article → score is null

Output JSON focusing heavily on integrity_score and reasoning.
`;

const CONSISTENCY_TRACKER_PROMPT = `
You are the 'Consistency Tracker' - expert on political flip-flops.

CONSISTENCY SCORING (0-100):
- 90-100: Completely consistent with past positions
- 70-89: Mostly consistent, minor evolution with explanation
- 50-69: Some contradictions, shifting positions
- 30-49: Major flip-flops, says one thing does another
- 0-29: Complete reversal, blatant hypocrisy

CHECK FOR:
- Does current position match past statements?
- Changed position for votes or principles?
- Is evolution explained or unexplained?

EVIDENCE:
- What they said before vs now
- If no historical context → score is null

Output JSON focusing heavily on consistency_score and reasoning.
`;

const IDEOLOGY_ANALYST_PROMPT = `
You are the 'Ideology Analyst' - expert on mapping political positions to ideological dimensions.

Your job is to analyze what POLICY STANCE the politician is taking in this article, and how it maps to ideological dimensions.

**IDEOLOGY DIMENSIONS** (scale: -0.5 to +0.5 each, 0 = no signal):

1. **economic** (-0.5 = left/collective, +0.5 = right/market)
   - Public spending, nationalization, tax policy, regulation
   - Left: "invest in public services", "tax the wealthy"
   - Right: "cut taxes", "reduce regulation", "private sector"

2. **social** (-0.5 = progressive, +0.5 = conservative)
   - LGBTQ+ rights, abortion, gender, family values
   - Progressive: "marriage equality", "reproductive rights"
   - Conservative: "traditional family", "pro-life"

3. **cultural** (-0.5 = multicultural, +0.5 = nationalist)
   - Immigration, integration, national identity
   - Multicultural: "welcoming refugees", "diversity"
   - Nationalist: "control borders", "Irish values first"

4. **authority** (-0.5 = libertarian, +0.5 = authoritarian)
   - Civil liberties, policing, surveillance, censorship
   - Libertarian: "civil liberties", "free speech"
   - Authoritarian: "law and order", "security measures"

5. **environmental** (-0.5 = pro-climate, +0.5 = pro-business)
   - Climate action, carbon tax, green policy
   - Pro-climate: "green transition", "carbon tax"
   - Pro-business: "protect jobs", "realistic timeline"

6. **welfare** (-0.5 = expand, +0.5 = reduce)
   - Social welfare, benefits, safety net
   - Expand: "increase supports", "living wage"
   - Reduce: "welfare reform", "work requirements"

7. **globalism** (-0.5 = EU integration, +0.5 = Ireland-first)
   - EU policy, international cooperation
   - EU: "European solidarity", "EU rules"
   - Ireland-first: "national sovereignty", "Irish interests"

8. **technocratic** (-0.5 = expert-led, +0.5 = populist)
   - Who should make decisions?
   - Expert: "follow the science", "expert advice"
   - Populist: "listen to the people", "common sense"

**CALIBRATION - Be Conservative:**
- **±0.4 to ±0.5:** STRONG action (implementing policy, leading advocacy)
- **±0.2 to ±0.3:** CLEAR position (explicit defense, vocal stance)
- **±0.1 to ±0.2:** MODERATE signal (stated position, mentioned stance)
- **±0.05 to ±0.1:** WEAK signal (tangential, implied)
- **0.0:** No clear ideological information on that dimension

**POLICY STANCE:**
- "support" = TD advocates FOR this policy
- "oppose" = TD criticizes/opposes policy
- "neutral" = TD doesn't take clear position
- "unclear" = Not enough information

Output JSON:
{
  "policy_stance": {
    "stance": "support|oppose|neutral|unclear",
    "strength": 3,
    "evidence": "Specific quote or action",
    "policy_topic": "Brief description"
  },
  "ideology_delta": {
    "economic": 0.0,
    "social": 0.0,
    "cultural": 0.0,
    "authority": 0.0,
    "environmental": 0.0,
    "welfare": 0.0,
    "globalism": 0.0,
    "technocratic": 0.0
  },
  "is_ideological_policy": true,
  "policy_direction": "progressive|conservative|centrist|technical",
  "reasoning": "Explanation of ideology mapping",
  "confidence": 0.8
}

If the article doesn't reveal any policy stance or ideological information about this politician, return policy_stance as null and all ideology_delta values as 0.
`;

const ARBITRATOR_PROMPT = `
You are the 'Arbitrator' - your job is to synthesize multiple agent scores into a final consensus.

You will receive scores from multiple agents with different perspectives.

YOUR TASK:
1. Analyze agreement/disagreement between agents
2. Weight scores appropriately:
   - Higher confidence scores get more weight
   - Declared biases should be acknowledged
   - Centrist and Accountability Watchdog are "anchor" agents
3. Detect CONTESTED issues (agents strongly disagree)
4. Produce CONSENSUS scores with reasoning

CONSENSUS RULES:
- If agents agree (within 15 points) → Average the scores
- If agents disagree moderately (15-30 points) → Weight toward anchor agents
- If agents strongly disagree (30+ points) → Flag for human review

**CRITICAL - IMPACT SCORING:**
- Range: -10 to +10
- 0 = NEUTRAL (no clear positive or negative action by the politician)
- "No evidence of wrongdoing" = 0 (neutral), NOT positive
- "Not the main subject" = 0 (neutral), NOT positive
- If article raises concerns about their office/staff/associates = slight NEGATIVE (-1 to -3)
- Only give POSITIVE impact for DEMONSTRABLE good actions
- When in doubt between neutral and slight negative, lean NEGATIVE for accountability
- Politicians should be held to high standards - mere "not guilty" is not praiseworthy

Output JSON:
{
  "consensus_scores": {
    "transparency_score": 72,
    "effectiveness_score": 65,
    "integrity_score": 80,
    "consistency_score": null,
    "overall_impact": 0,
    "confidence": 0.85
  },
  "agreement_level": "high/medium/low/contested",
  "major_disagreements": ["Agent X gave 85 for integrity, Agent Y gave 45 - significant disagreement"],
  "consensus_reasoning": "Most agents agreed on transparency being good, but effectiveness was mixed...",
  "flagged_for_human_review": false,
  "review_reason": null
}
`;

// --- AGENT PROMPT MAP ---

const AGENT_PROMPTS: Record<string, string> = {
  "Centrist Analyst": CENTRIST_ANALYST_PROMPT,
  "Government Supporter Perspective": GOVERNMENT_SUPPORTER_PROMPT,
  "Opposition Perspective": OPPOSITION_PERSPECTIVE_PROMPT,
  "Constituent Advocate": CONSTITUENT_ADVOCATE_PROMPT,
  "Accountability Watchdog": ACCOUNTABILITY_WATCHDOG_PROMPT,
  "Media Literacy Expert": MEDIA_LITERACY_EXPERT_PROMPT,
  "Transparency Specialist": TRANSPARENCY_SPECIALIST_PROMPT,
  "Effectiveness Auditor": EFFECTIVENESS_AUDITOR_PROMPT,
  "Ethics Investigator": ETHICS_INVESTIGATOR_PROMPT,
  "Consistency Tracker": CONSISTENCY_TRACKER_PROMPT,
  "Ideology Analyst": IDEOLOGY_ANALYST_PROMPT,
};

// --- HELPER FUNCTIONS ---

/**
 * Run the Manager to decide which agents to deploy
 */
async function runManager(
  article: { title: string; content: string; source?: string },
  politician: { name: string; party?: string; isGovernment?: boolean },
  escalationReason: string
): Promise<{ agents_to_deploy: string[]; reasoning: string }> {
  
  console.log(`   👔 Team Manager assembling agents for ${politician.name}...`);
  
  const input = `
ARTICLE:
Title: ${article.title}
Content: ${article.content.slice(0, 2000)}...
Source: ${article.source || 'Unknown'}

POLITICIAN:
Name: ${politician.name}
Party: ${politician.party || 'Unknown'}
Position: ${politician.isGovernment ? 'GOVERNMENT' : 'OPPOSITION/BACKBENCH'}

ESCALATION REASON: ${escalationReason}

Decide which agents to deploy.
`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: MANAGER_PROMPT },
      { role: "user", content: input }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3
  });
  
  const decision = JSON.parse(response.choices[0].message.content || '{}');
  console.log(`   ✅ Team deployed: ${decision.agents_to_deploy?.join(', ')}`);
  
  return decision;
}

/**
 * Run a single perspective agent
 */
async function runAgent(
  agentName: string,
  article: { title: string; content: string },
  politician: { name: string; party?: string; constituency?: string }
): Promise<AgentScore> {
  
  console.log(`   🤖 ${agentName} analyzing...`);
  
  const systemPrompt = AGENT_PROMPTS[agentName];
  if (!systemPrompt) {
    throw new Error(`Unknown agent: ${agentName}`);
  }
  
  const input = `
Analyze this article about TD ${politician.name} (${politician.party || 'Unknown party'}, ${politician.constituency || 'Unknown constituency'}).

ARTICLE:
Title: ${article.title}

Content:
${article.content}

Provide your scoring with evidence from the article.
`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      agentName,
      agentPerspective: agentName,
      transparencyScore: normalizeScore(result.transparency_score),
      effectivenessScore: normalizeScore(result.effectiveness_score),
      integrityScore: normalizeScore(result.integrity_score),
      consistencyScore: normalizeScore(result.consistency_score),
      overallImpact: Math.max(-10, Math.min(10, result.overall_impact || 0)),
      reasoning: result.reasoning || '',
      confidence: result.confidence || 0.7,
      biasDeclaration: result.bias_declaration,
      status: "completed"
    };
    
  } catch (error) {
    console.error(`   ❌ ${agentName} failed:`, error);
    return {
      agentName,
      agentPerspective: agentName,
      transparencyScore: null,
      effectivenessScore: null,
      integrityScore: null,
      consistencyScore: null,
      overallImpact: 0,
      reasoning: "Agent failed to analyze",
      confidence: 0,
      status: "failed"
    };
  }
}

/**
 * Run the Arbitrator to synthesize all agent scores
 */
async function runArbitrator(
  agentScores: AgentScore[],
  article: { title: string },
  politician: { name: string }
): Promise<{
  consensusScores: MultiAgentAnalysis['consensusScores'];
  arbitratorReport: MultiAgentAnalysis['arbitratorReport'];
}> {
  
  console.log(`   ⚖️ Arbitrator synthesizing ${agentScores.length} agent reports...`);
  
  const completedScores = agentScores.filter(s => s.status === 'completed');
  
  const input = `
ARTICLE: "${article.title}"
POLITICIAN: ${politician.name}

AGENT REPORTS:
${completedScores.map(score => `
--- ${score.agentName} ---
Transparency: ${score.transparencyScore ?? 'N/A'}
Effectiveness: ${score.effectivenessScore ?? 'N/A'}
Integrity: ${score.integrityScore ?? 'N/A'}
Consistency: ${score.consistencyScore ?? 'N/A'}
Overall Impact: ${score.overallImpact}
Confidence: ${(score.confidence * 100).toFixed(0)}%
Bias Declaration: ${score.biasDeclaration || 'None'}
Reasoning: ${score.reasoning}
`).join('\n')}

Synthesize these into consensus scores.
`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",  // Use stronger model for arbitration
    messages: [
      { role: "system", content: ARBITRATOR_PROMPT },
      { role: "user", content: input }
    ],
    response_format: { type: "json_object" },
    temperature: 0.2  // Low temperature for consistent arbitration
  });
  
  const result = JSON.parse(response.choices[0].message.content || '{}');
  
  return {
    consensusScores: {
      transparencyScore: normalizeScore(result.consensus_scores?.transparency_score),
      effectivenessScore: normalizeScore(result.consensus_scores?.effectiveness_score),
      integrityScore: normalizeScore(result.consensus_scores?.integrity_score),
      consistencyScore: normalizeScore(result.consensus_scores?.consistency_score),
      overallImpact: Math.max(-10, Math.min(10, result.consensus_scores?.overall_impact || 0)),
      confidence: result.consensus_scores?.confidence || 0.7
    },
    arbitratorReport: {
      agreementLevel: result.agreement_level || 'medium',
      majorDisagreements: result.major_disagreements || [],
      consensusReasoning: result.consensus_reasoning || '',
      flaggedForHumanReview: result.flagged_for_human_review || false,
      reviewReason: result.review_reason
    }
  };
}

/**
 * Run the Ideology Analyst agent
 */
async function runIdeologyAnalyst(
  article: { title: string; content: string },
  politician: { name: string; party?: string; constituency?: string }
): Promise<IdeologyAnalysis | null> {
  
  console.log(`   🧭 Ideology Analyst mapping positions...`);
  
  const input = `
Analyze the ideological position of TD ${politician.name} (${politician.party || 'Unknown party'}) in this article.

ARTICLE:
Title: ${article.title}

Content:
${article.content}

Map their policy stance to ideology dimensions. If no clear policy stance, return null for policy_stance.
`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: IDEOLOGY_ANALYST_PROMPT },
        { role: "user", content: input }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Normalize ideology delta values to -0.5 to +0.5 range
    const normalizeIdeology = (val: unknown): number => {
      if (typeof val !== 'number' || !Number.isFinite(val)) return 0;
      return Math.max(-0.5, Math.min(0.5, val));
    };
    
    const ideologyDelta: IdeologyDelta = {
      economic: normalizeIdeology(result.ideology_delta?.economic),
      social: normalizeIdeology(result.ideology_delta?.social),
      cultural: normalizeIdeology(result.ideology_delta?.cultural),
      authority: normalizeIdeology(result.ideology_delta?.authority),
      environmental: normalizeIdeology(result.ideology_delta?.environmental),
      welfare: normalizeIdeology(result.ideology_delta?.welfare),
      globalism: normalizeIdeology(result.ideology_delta?.globalism),
      technocratic: normalizeIdeology(result.ideology_delta?.technocratic),
    };
    
    // Check if any dimension has a signal
    const hasSignal = Object.values(ideologyDelta).some(v => Math.abs(v) > 0.05);
    
    console.log(`   ✅ Ideology Analyst: ${hasSignal ? 'Policy stance detected' : 'No clear ideology signal'}`);
    
    if (hasSignal) {
      const topSignals = Object.entries(ideologyDelta)
        .filter(([_, v]) => Math.abs(v) >= 0.1)
        .map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v.toFixed(2)}`)
        .join(', ');
      if (topSignals) {
        console.log(`      Signals: ${topSignals}`);
      }
    }
    
    return {
      policyStance: result.policy_stance ? {
        stance: result.policy_stance.stance || 'unclear',
        strength: Math.max(1, Math.min(5, result.policy_stance.strength || 1)),
        evidence: result.policy_stance.evidence || '',
        policyTopic: result.policy_stance.policy_topic || ''
      } : null,
      ideologyDelta,
      isIdeologicalPolicy: result.is_ideological_policy || false,
      policyDirection: result.policy_direction || null,
      reasoning: result.reasoning || '',
      confidence: result.confidence || 0.7
    };
    
  } catch (error) {
    console.error(`   ❌ Ideology Analyst failed:`, error);
    return null;
  }
}

/**
 * Normalize score to 0-100 or null
 */
function normalizeScore(score: unknown): number | null {
  if (score === null || score === undefined || typeof score !== 'number') {
    return null;
  }
  if (!Number.isFinite(score)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

// --- ESCALATION LOGIC ---

/**
 * Determine if an article should be escalated to multi-agent scoring
 * Returns true if article warrants the extra cost of multi-agent analysis
 */
export function shouldEscalateToMultiAgent(
  article: { title: string; content: string; source?: string },
  politician: { name: string; party?: string; role?: string },
  initialAnalysis?: { 
    impact_score?: number;
    confidence?: number;
    sentiment?: string;
    story_type?: string;
  }
): { shouldEscalate: boolean; reason: string } {
  
  const reasons: string[] = [];
  
  // 1. Low confidence from initial scorer
  if (initialAnalysis?.confidence && initialAnalysis.confidence < 0.7) {
    reasons.push('Low confidence from initial analysis');
  }
  
  // 2. Extreme score (very positive or very negative)
  if (initialAnalysis?.impact_score && Math.abs(initialAnalysis.impact_score) > 7) {
    reasons.push(`Extreme impact score (${initialAnalysis.impact_score})`);
  }
  
  // 3. Senior politicians (Cabinet, party leaders)
  const seniorRoles = ['Taoiseach', 'Tánaiste', 'Minister', 'Leader', 'President', 'Chair'];
  if (politician.role && seniorRoles.some(r => politician.role!.includes(r))) {
    reasons.push('Senior politician (Cabinet/Leadership)');
  }
  
  // 4. Party leaders (always important)
  const partyLeaders = [
    'Simon Harris', 'Micheál Martin', 'Mary Lou McDonald', 'Eamon Ryan',
    'Ivana Bacik', 'Holly Cairns', 'Peadar Tóibín', 'Richard Boyd Barrett'
  ];
  if (partyLeaders.includes(politician.name)) {
    reasons.push('Party leader');
  }
  
  // 5. Controversial topics
  const controversialKeywords = [
    'scandal', 'corruption', 'resign', 'investigation', 'inquiry',
    'conflict of interest', 'ethics', 'illegal', 'fraud', 'abuse',
    'immigration', 'asylum', 'refugee', 'housing crisis', 'homelessness'
  ];
  const articleText = (article.title + ' ' + article.content).toLowerCase();
  const hasControversy = controversialKeywords.some(kw => articleText.includes(kw));
  if (hasControversy) {
    reasons.push('Controversial topic detected');
  }
  
  // 6. Scandal or controversy story type
  if (initialAnalysis?.story_type === 'scandal' || initialAnalysis?.story_type === 'controversy') {
    reasons.push(`Story type: ${initialAnalysis.story_type}`);
  }
  
  // 7. Major news outlets (higher visibility = more scrutiny needed)
  const majorOutlets = ['RTE', 'Irish Times', 'Independent', 'Journal'];
  if (article.source && majorOutlets.some(o => article.source!.includes(o))) {
    reasons.push('Major news outlet');
  }
  
  // Decision
  const shouldEscalate = reasons.length >= 2;  // Need at least 2 reasons to escalate
  
  return {
    shouldEscalate,
    reason: reasons.length > 0 ? reasons.join('; ') : 'No escalation triggers'
  };
}

// --- MAIN SERVICE ---

/**
 * Run full multi-agent scoring on an article
 */
export async function runMultiAgentScoring(
  article: { 
    id: number;
    title: string; 
    content: string; 
    source?: string;
  },
  politician: { 
    name: string; 
    party?: string; 
    constituency?: string;
    isGovernment?: boolean;
  },
  escalationReason: string
): Promise<MultiAgentAnalysis> {
  
  const startTime = Date.now();
  let llmCalls = 0;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 NEWS ARTICLE SCORING TEAM: ${politician.name}`);
  console.log(`📰 Article: ${article.title.substring(0, 50)}...`);
  console.log(`⚡ Escalation: ${escalationReason}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    // Step 1: Manager decides which agents to deploy
    const decision = await runManager(article, politician, escalationReason);
    llmCalls++;
    
    // Ensure core agents are always deployed
    const agentsToRun = new Set<string>(decision.agents_to_deploy);
    agentsToRun.add("Centrist Analyst");
    agentsToRun.add("Accountability Watchdog");
    
    // Step 2: Run all agents in parallel (including Ideology Analyst)
    console.log(`\n   🚀 Running ${agentsToRun.size} scoring agents + Ideology Analyst in parallel...`);
    
    const agentPromises = Array.from(agentsToRun).map(agentName => 
      runAgent(agentName, article, politician)
    );
    
    // Run Ideology Analyst in parallel with other agents
    const ideologyPromise = runIdeologyAnalyst(article, politician);
    
    const [agentScores, ideologyAnalysis] = await Promise.all([
      Promise.all(agentPromises),
      ideologyPromise
    ]);
    
    llmCalls += agentsToRun.size + 1;  // +1 for Ideology Analyst
    
    // Log agent results
    agentScores.forEach(score => {
      if (score.status === 'completed') {
        console.log(`   ✅ ${score.agentName}: Impact ${score.overallImpact}, Confidence ${(score.confidence * 100).toFixed(0)}%`);
      } else {
        console.log(`   ❌ ${score.agentName}: Failed`);
      }
    });
    
    // Step 3: Arbitrator synthesizes scores
    const { consensusScores, arbitratorReport } = await runArbitrator(
      agentScores,
      article,
      politician
    );
    llmCalls++;
    
    const processingTime = Date.now() - startTime;
    
    // Log final results
    console.log(`\n   ${'─'.repeat(40)}`);
    console.log(`   ⚖️ CONSENSUS SCORES:`);
    console.log(`      Transparency: ${consensusScores.transparencyScore ?? 'N/A'}`);
    console.log(`      Effectiveness: ${consensusScores.effectivenessScore ?? 'N/A'}`);
    console.log(`      Integrity: ${consensusScores.integrityScore ?? 'N/A'}`);
    console.log(`      Consistency: ${consensusScores.consistencyScore ?? 'N/A'}`);
    console.log(`      Overall Impact: ${consensusScores.overallImpact}`);
    console.log(`      Agreement: ${arbitratorReport.agreementLevel}`);
    console.log(`      Confidence: ${(consensusScores.confidence * 100).toFixed(0)}%`);
    
    if (arbitratorReport.flaggedForHumanReview) {
      console.log(`   ⚠️ FLAGGED FOR HUMAN REVIEW: ${arbitratorReport.reviewReason}`);
    }
    
    // Log ideology analysis
    if (ideologyAnalysis && ideologyAnalysis.policyStance) {
      console.log(`\n   🧭 IDEOLOGY ANALYSIS:`);
      console.log(`      Policy: ${ideologyAnalysis.policyStance.policyTopic}`);
      console.log(`      Stance: ${ideologyAnalysis.policyStance.stance} (strength: ${ideologyAnalysis.policyStance.strength}/5)`);
      console.log(`      Direction: ${ideologyAnalysis.policyDirection || 'N/A'}`);
      
      const significantDeltas = Object.entries(ideologyAnalysis.ideologyDelta)
        .filter(([_, v]) => Math.abs(v) >= 0.1)
        .map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v.toFixed(2)}`);
      
      if (significantDeltas.length > 0) {
        console.log(`      Ideology Shifts: ${significantDeltas.join(', ')}`);
      }
    }
    
    console.log(`\n   📊 Stats: ${llmCalls} LLM calls, ${processingTime}ms`);
    console.log(`${'='.repeat(60)}\n`);
    
    return {
      articleId: article.id,
      articleTitle: article.title,
      politicianName: politician.name,
      managerDecision: {
        agentsDeployed: Array.from(agentsToRun),
        reasoning: decision.reasoning,
        escalationReason
      },
      agentScores,
      consensusScores,
      ideologyAnalysis,
      arbitratorReport,
      totalLLMCalls: llmCalls,
      processingTimeMs: processingTime,
      timestamp: new Date()
    };
    
  } catch (error) {
    console.error(`❌ Multi-agent scoring failed:`, error);
    throw error;
  }
}

/**
 * Convert multi-agent analysis to format compatible with existing TD scoring
 */
export function convertToArticleAnalysis(
  multiAgentResult: MultiAgentAnalysis
): {
  transparency_score: number | null;
  effectiveness_score: number | null;
  integrity_score: number | null;
  consistency_score: number | null;
  impact_score: number;
  confidence: number;
  analyzed_by: string;
  ai_reasoning: string;
  needs_review: boolean;
  review_reason?: string;
  // Ideology data
  td_policy_stance?: {
    stance: string;
    strength: number;
    evidence: string;
    policy_topic: string;
    ideology_delta: Record<string, number>;
  };
  is_ideological_policy: boolean;
  policy_direction: string | null;
} {
  const result: ReturnType<typeof convertToArticleAnalysis> = {
    transparency_score: multiAgentResult.consensusScores.transparencyScore,
    effectiveness_score: multiAgentResult.consensusScores.effectivenessScore,
    integrity_score: multiAgentResult.consensusScores.integrityScore,
    consistency_score: multiAgentResult.consensusScores.consistencyScore,
    impact_score: multiAgentResult.consensusScores.overallImpact,
    confidence: multiAgentResult.consensusScores.confidence,
    analyzed_by: `multi-agent (${multiAgentResult.totalLLMCalls} calls)`,
    ai_reasoning: multiAgentResult.arbitratorReport.consensusReasoning,
    needs_review: multiAgentResult.arbitratorReport.flaggedForHumanReview,
    review_reason: multiAgentResult.arbitratorReport.reviewReason,
    is_ideological_policy: multiAgentResult.ideologyAnalysis?.isIdeologicalPolicy || false,
    policy_direction: multiAgentResult.ideologyAnalysis?.policyDirection || null
  };
  
  // Add policy stance if present
  if (multiAgentResult.ideologyAnalysis?.policyStance) {
    result.td_policy_stance = {
      stance: multiAgentResult.ideologyAnalysis.policyStance.stance,
      strength: multiAgentResult.ideologyAnalysis.policyStance.strength,
      evidence: multiAgentResult.ideologyAnalysis.policyStance.evidence,
      policy_topic: multiAgentResult.ideologyAnalysis.policyStance.policyTopic,
      ideology_delta: multiAgentResult.ideologyAnalysis.ideologyDelta
    };
  }
  
  return result;
}

/**
 * Convert process score (0-100) to impact score (-10 to +10)
 */
function processScoreToImpact(processScore?: number | null): number | null {
  if (processScore === null || processScore === undefined) {
    return null;
  }
  // 90-100 → +8 to +10 (excellent)
  if (processScore >= 90) return Math.round((processScore - 90) / 1 + 8);
  // 70-89 → +3 to +7 (good)
  if (processScore >= 70) return Math.round((processScore - 70) / 5 + 3);
  // 50-69 → -2 to +2 (average)
  if (processScore >= 50) return Math.round((processScore - 50) / 10);
  // 30-49 → -7 to -3 (below average)
  if (processScore >= 30) return Math.round((processScore - 30) / 5 - 4);
  // 0-29 → -10 to -8 (poor)
  return Math.round((processScore - 30) / 3 - 7);
}

/**
 * Apply process dimension scores (transparency, integrity, etc.) to TD ELO ratings
 * This updates the td_scores table with ELO changes based on multi-agent consensus
 */
export async function applyProcessScoresToELO(
  multiAgentResult: MultiAgentAnalysis,
  article: { id: number; published_date?: string | Date; url?: string; title?: string },
  politician: { name: string },
  credibilityScore: number = 0.85
): Promise<void> {
  const { supabaseDb: supabase } = await import('../db.js');
  const { ELOScoringService } = await import('./eloScoringService.js');
  
  if (!supabase) return;
  
  // Get current TD scores
  const { data: currentTD, error: tdError } = await supabase
    .from('td_scores')
    .select('*')
    .eq('politician_name', politician.name)
    .single();
  
  if (tdError || !currentTD) {
    console.log(`   ⚠️ TD not found in database: ${politician.name}`);
    return;
  }
  
  // Convert process scores (0-100) to impact scores (-10 to +10)
  const consensus = multiAgentResult.consensusScores;
  const transparencyImpact = processScoreToImpact(consensus.transparencyScore);
  const effectivenessImpact = processScoreToImpact(consensus.effectivenessScore);
  const integrityImpact = processScoreToImpact(consensus.integrityScore);
  const consistencyImpact = processScoreToImpact(consensus.consistencyScore);
  
  // Build analysis object compatible with ELO service
  const analysisForELO = {
    impact_score: consensus.overallImpact,
    transparency_impact: transparencyImpact,
    effectiveness_impact: effectivenessImpact,
    integrity_impact: integrityImpact,
    consistency_impact: consistencyImpact,
    constituency_service_impact: 0,
    story_type: 'policy_work' as const,
    sentiment: 'neutral' as const
  };
  
  // Calculate article age
  const articleDate = article.published_date 
    ? new Date(article.published_date) 
    : new Date();
  const articleAge = ELOScoringService.getArticleAge(articleDate);
  
  // Apply multi-agent confidence as credibility modifier
  const adjustedCredibility = credibilityScore * consensus.confidence;
  
  // Current scores
  const currentScores = {
    overall_elo: currentTD.overall_elo || 1500,
    transparency_elo: currentTD.transparency_elo || 1500,
    effectiveness_elo: currentTD.effectiveness_elo || 1500,
    integrity_elo: currentTD.integrity_elo || 1500,
    consistency_elo: currentTD.consistency_elo || 1500,
    constituency_service_elo: currentTD.constituency_service_elo || 1500
  };
  
  // Calculate ELO changes
  const { updated, changes } = ELOScoringService.updateTDScores(
    currentScores,
    analysisForELO as any,
    adjustedCredibility,
    articleAge
  );
  
  // Only update if there are meaningful changes
  if (!changes.overall || changes.overall.change === 0) {
    console.log(`   ℹ️ No ELO changes for ${politician.name}`);
    return;
  }
  
  console.log(`   📊 Applying ELO changes for ${politician.name}:`);
  console.log(`      Overall: ${changes.overall.oldScore} → ${changes.overall.newScore} (${changes.overall.change >= 0 ? '+' : ''}${changes.overall.change})`);
  
  if (changes.transparency) {
    console.log(`      Transparency: ${changes.transparency.change >= 0 ? '+' : ''}${changes.transparency.change}`);
  }
  if (changes.integrity) {
    console.log(`      Integrity: ${changes.integrity.change >= 0 ? '+' : ''}${changes.integrity.change}`);
  }
  if (changes.effectiveness) {
    console.log(`      Effectiveness: ${changes.effectiveness.change >= 0 ? '+' : ''}${changes.effectiveness.change}`);
  }
  if (changes.consistency) {
    console.log(`      Consistency: ${changes.consistency.change >= 0 ? '+' : ''}${changes.consistency.change}`);
  }
  
  // Update td_scores table
  const { error: updateError } = await supabase
    .from('td_scores')
    .update({
      overall_elo: updated.overall_elo,
      transparency_elo: updated.transparency_elo,
      effectiveness_elo: updated.effectiveness_elo,
      integrity_elo: updated.integrity_elo,
      consistency_elo: updated.consistency_elo,
      constituency_service_elo: updated.constituency_service_elo,
      total_stories: (currentTD.total_stories || 0) + 1,
      last_updated: new Date().toISOString()
    })
    .eq('id', currentTD.id);
  
  if (updateError) {
    console.error(`   ❌ Error updating TD ELO scores:`, updateError);
    return;
  }
  
  // Log to td_score_history
  const { error: historyError } = await supabase
    .from('td_score_history')
    .insert({
      politician_name: politician.name,
      article_id: article.id,
      old_overall_elo: changes.overall.oldScore,
      new_overall_elo: changes.overall.newScore,
      elo_change: changes.overall.change,
      dimension_affected: 'overall',
      impact_score: consensus.overallImpact,
      story_type: 'policy_work',
      article_url: article.url,
      article_title: article.title
    });
  
  if (historyError) {
    console.error(`   ⚠️ Warning: Failed to log ELO history:`, historyError);
  }
  
  console.log(`   ✅ ELO scores updated successfully`);
}

/**
 * Apply ideology adjustments to TD profile using the data science enhancements
 * This applies: time decay, extremity penalty, direction penalty, adaptive scaling
 */
export async function applyIdeologyToProfile(
  multiAgentResult: MultiAgentAnalysis,
  article: { id: number; published_date?: string | Date; source?: string },
  politician: { name: string }
): Promise<void> {
  const ideology = multiAgentResult.ideologyAnalysis;
  if (!ideology || !ideology.policyStance) {
    return; // No ideology signal to apply
  }
  
  // Check if any dimension has a meaningful signal
  const hasSignal = Object.values(ideology.ideologyDelta).some(v => Math.abs(v) > 0.05);
  if (!hasSignal) {
    return;
  }
  
  // Import the profile service
  const { TDIdeologyProfileService } = await import('./tdIdeologyProfileService.js');
  
  // Determine source reliability
  const sourceUrl = (article.source || '').toLowerCase();
  let sourceReliability = 0.7;
  if (sourceUrl.includes('rte') || sourceUrl.includes('oireachtas')) {
    sourceReliability = 0.9;
  } else if (sourceUrl.includes('irish times') || sourceUrl.includes('independent')) {
    sourceReliability = 0.85;
  } else if (sourceUrl.includes('journal') || sourceUrl.includes('examiner')) {
    sourceReliability = 0.75;
  } else if (sourceUrl.includes('gript') || sourceUrl.includes('ditch')) {
    sourceReliability = 0.7;
  }
  
  // Calculate base weight from stance strength and confidence
  const baseWeight = (ideology.policyStance.strength / 5) * ideology.confidence * sourceReliability;
  
  console.log(`   🧭 Applying ideology to ${politician.name}'s profile...`);
  console.log(`      Policy: ${ideology.policyStance.policyTopic}`);
  console.log(`      Base weight: ${baseWeight.toFixed(3)} (strength: ${ideology.policyStance.strength}/5, conf: ${(ideology.confidence * 100).toFixed(0)}%, source: ${sourceReliability})`);
  
  // Apply adjustments through the data science pipeline
  // This applies: time decay, extremity penalty, direction penalty, adaptive scaling
  await TDIdeologyProfileService.applyAdjustments(
    politician.name,
    ideology.ideologyDelta,
    {
      sourceType: 'article',
      sourceId: article.id,
      policyTopic: ideology.policyStance.policyTopic,
      weight: baseWeight,
      confidence: ideology.confidence,
      sourceDate: article.published_date || new Date(),
      sourceReliability
    }
  );
  
  console.log(`   ✅ Ideology profile updated with data science enhancements`);
}

// Export service
export const NewsArticleScoringTeam = {
  shouldEscalate: shouldEscalateToMultiAgent,
  runTeamScoring: runMultiAgentScoring,
  convertToArticleAnalysis,
  applyProcessScoresToELO,   // Apply process scores (transparency, integrity, etc.) to ELO
  applyIdeologyToProfile     // Apply ideology deltas with data science enhancements
};

// Alias for backwards compatibility
export const MultiAgentTDScoringService = NewsArticleScoringTeam;

