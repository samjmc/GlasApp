/**
 * Debate Ideology Analysis Service
 * 
 * Analyzes parliamentary debates and votes to extract TD ideological positions
 * with political science enhancements:
 * - Voting records integration (gold standard, 2-3× weight)
 * - Party discipline detection
 * - Rhetorical vs substantive classification
 * - Issue salience weighting
 * - Government vs opposition context
 */

import { supabaseDb as supabase } from '../db.js';
import { TDIdeologyProfileService } from './tdIdeologyProfileService.js';
import { OpenAI } from 'openai';
import { IDEOLOGY_DIMENSIONS } from '../constants/ideology.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Issue salience mapping - how ideologically meaningful each topic is per dimension
const ISSUE_SALIENCE: Record<string, Record<string, number>> = {
  welfare: {
    welfare: 1.0,
    social: 0.8,
    economic: 0.6,
    cultural: 0.2,
    authority: 0.3,
    environmental: 0.2,
    globalism: 0.3,
    technocratic: 0.4,
  },
  immigration: {
    cultural: 1.0,
    globalism: 0.9,
    welfare: 0.5,
    social: 0.4,
    economic: 0.3,
    authority: 0.7,
    environmental: 0.2,
    technocratic: 0.3,
  },
  taxation: {
    economic: 1.0,
    welfare: 0.7,
    social: 0.3,
    cultural: 0.2,
    authority: 0.3,
    environmental: 0.3,
    globalism: 0.4,
    technocratic: 0.5,
  },
  housing: {
    economic: 0.8,
    welfare: 0.7,
    social: 0.6,
    cultural: 0.2,
    authority: 0.4,
    environmental: 0.5,
    globalism: 0.2,
    technocratic: 0.4,
  },
  healthcare: {
    welfare: 0.9,
    social: 0.8,
    economic: 0.6,
    cultural: 0.2,
    authority: 0.4,
    environmental: 0.2,
    globalism: 0.3,
    technocratic: 0.6,
  },
  education: {
    social: 0.9,
    economic: 0.6,
    welfare: 0.5,
    cultural: 0.4,
    authority: 0.5,
    environmental: 0.2,
    globalism: 0.3,
    technocratic: 0.7,
  },
  environment: {
    environmental: 1.0,
    economic: 0.7,
    technocratic: 0.8,
    globalism: 0.6,
    social: 0.4,
    cultural: 0.3,
    authority: 0.4,
    welfare: 0.3,
  },
  justice: {
    authority: 1.0,
    social: 0.7,
    cultural: 0.5,
    economic: 0.3,
    welfare: 0.4,
    environmental: 0.2,
    globalism: 0.3,
    technocratic: 0.5,
  },
  default: {
    economic: 0.5,
    social: 0.5,
    cultural: 0.5,
    authority: 0.5,
    environmental: 0.5,
    welfare: 0.5,
    globalism: 0.5,
    technocratic: 0.5,
  },
};

interface DebateSpeech {
  id: string;
  speaker_name: string;
  speaker_party: string | null;
  speaker_role: string | null;
  paragraphs: string[];
  word_count: number;
  recorded_time: string;
  section_id: string;
}

interface VoteRecord {
  id: number;
  td_id: number;
  td_vote: 'Ta' | 'Nil' | 'Staon';
  vote_subject: string;
  vote_date: string;
  voted_with_party: boolean;
  td_party_at_vote: string | null;
  debate_uri: string | null;
  legislation_uri: string | null;
}

interface DebateAnalysis {
  ideology_delta: Record<string, number>;
  statement_strength: number;
  stance: 'support' | 'oppose' | 'neutral' | 'unclear';
  policy_topic: string;
  speech_classification: 'rhetorical' | 'substantive' | 'mixed';
  substantive_ratio: number;
  confidence: number;
  topic_dimension_mapping: Record<string, number>;
}

interface VoteAnalysis {
  ideology_delta: Record<string, number>;
  policy_topic: string;
  stance: 'support' | 'oppose' | 'neutral';
  confidence: number;
}

interface PartyDisciplineContext {
  isGovernmentTD: boolean;
  isOppositionTD: boolean;
  isDefendingPartyPolicy: boolean;
  isOpposingPartyPolicy: boolean;
  isRebellion: boolean;
  isCrossParty: boolean;
}

/**
 * Analyze a debate speech to extract ideological positions
 */
export async function analyzeDebateSpeech(speechId: string): Promise<void> {
  if (!supabase) return;

  // Check if already analyzed
  const { data: existing } = await supabase
    .from('debate_ideology_analysis')
    .select('id')
    .eq('speech_id', speechId)
    .maybeSingle();

  if (existing) {
    console.log(`⏭️  Speech ${speechId} already analyzed, skipping`);
    return;
  }

  // Fetch speech data
  const { data: speech, error: speechError } = await supabase
    .from('debate_speeches')
    .select('*')
    .eq('id', speechId)
    .maybeSingle();

  if (speechError || !speech) {
    console.error(`❌ Error fetching speech ${speechId}:`, speechError?.message);
    return;
  }

  // Get debate section context
  const { data: section } = await supabase
    .from('debate_sections')
    .select('topic, title, debate_day_id')
    .eq('id', speech.section_id)
    .maybeSingle();

  // Get TD metadata - SKIP if not a TD
  const { data: tdMeta } = await supabase
    .from('td_scores')
    .select('politician_name, party, constituency')
    .eq('politician_name', speech.speaker_name)
    .maybeSingle();

  // Skip non-TD participants (CEOs, civil servants, experts, etc.)
  // They shouldn't get ideology scores - only elected officials should
  if (!tdMeta) {
    console.log(`⏭️  Skipping ${speech.speaker_name} - not a TD (role: ${speech.speaker_role || 'unknown'})`);
    return;
  }

  console.log(`📝 Analyzing speech by ${speech.speaker_name} (${speech.speaker_party || tdMeta.party || 'Independent'})`);

  // Combine paragraphs into full text
  const speechText = Array.isArray(speech.paragraphs) 
    ? speech.paragraphs.join('\n\n')
    : JSON.stringify(speech.paragraphs);

  // Analyze speech with LLM
  const analysis = await extractIdeologyFromSpeech(
    speech as DebateSpeech,
    speechText,
    section?.topic || section?.title || 'General',
  );

  if (!analysis) {
    console.error(`❌ Failed to analyze speech ${speechId}`);
    return;
  }

  // Check for party discipline context
  const partyContext = await determinePartyDisciplineContext(
    speech.speaker_name,
    speech.speaker_party,
    speech.speaker_role,
    analysis.stance,
    analysis.policy_topic,
  );

  // Calculate speech quality weights
  const qualityWeights = calculateSpeechQualityWeights(
    speech as DebateSpeech,
    analysis,
  );

  // Calculate effective weight with all enhancements
  let effectiveWeight = qualityWeights.baseWeight;

  // Apply rhetorical vs substantive adjustment
  if (analysis.speech_classification === 'rhetorical') {
    effectiveWeight *= 0.3; // 70% reduction for rhetoric
  } else if (analysis.speech_classification === 'substantive') {
    effectiveWeight *= 1.2; // 20% increase for substance
  }

  // Apply issue salience weighting per dimension (BEFORE consistency check)
  const salienceAdjustedDeltas: Record<string, number> = {};
  const topicSalience = ISSUE_SALIENCE[analysis.policy_topic.toLowerCase()] || ISSUE_SALIENCE.default;

  for (const dimension of IDEOLOGY_DIMENSIONS) {
    const rawDelta = analysis.ideology_delta[dimension] || 0;
    const salienceWeight = topicSalience[dimension] || 0.5;
    salienceAdjustedDeltas[dimension] = rawDelta * salienceWeight;
  }

  // Check for consistency with previous statements
  const consistencyCheck = await checkConsistency(
    speech.speaker_name,
    analysis.policy_topic,
    salienceAdjustedDeltas,
    speech.recorded_time,
    'speech',
    speechId,
  );

  // Apply consistency penalty if contradiction detected
  if (consistencyCheck.hasContradiction) {
    effectiveWeight *= consistencyCheck.penalty;
    console.log(`   ⚠️  Consistency issue detected: ${consistencyCheck.reason} (penalty: ${consistencyCheck.penalty.toFixed(2)}×)`);
  }

  // Apply party discipline adjustments
  if (partyContext.isRebellion) {
    effectiveWeight *= 1.5; // 50% increase - rebellion is significant!
  } else if (partyContext.isCrossParty) {
    effectiveWeight *= 1.3; // 30% increase - cross-party support
  } else if (partyContext.isDefendingPartyPolicy && partyContext.isGovernmentTD) {
    effectiveWeight *= 0.6; // 40% reduction - party discipline
  } else if (partyContext.isOpposingPartyPolicy && partyContext.isOppositionTD) {
    effectiveWeight *= 0.7; // 30% reduction - expected opposition
  }

  // Save analysis record
  await saveDebateAnalysis(speechId, speech.speaker_name, analysis, qualityWeights, effectiveWeight, partyContext);

  // Get current profile for history
  const { data: currentProfile } = await supabase
    .from('td_ideology_profiles')
    .select('*')
    .eq('politician_name', speech.speaker_name)
    .maybeSingle() || { data: null };

  // Save to history before applying adjustments
  if (currentProfile) {
    await saveToHistory(
      speech.speaker_name,
      analysis.policy_topic,
      salienceAdjustedDeltas,
      speech.recorded_time,
      currentProfile,
      'speech',
      speechId,
    );
  }

  // Apply ideology adjustments using existing service
  await TDIdeologyProfileService.applyAdjustments(
    speech.speaker_name,
    salienceAdjustedDeltas,
    {
      sourceType: 'debate',
      sourceId: speech.id,
      policyTopic: analysis.policy_topic,
      weight: effectiveWeight,
      confidence: analysis.confidence,
      sourceDate: speech.recorded_time,
      sourceReliability: 0.95, // Primary source - very high reliability
    }
  );

  console.log(`✅ Speech analysis complete for ${speech.speaker_name}`);
}

/**
 * Analyze a vote record to extract ideological positions
 * VOTING RECORDS = GOLD STANDARD (2-3× weight vs speeches)
 */
export async function analyzeVoteRecord(voteId: number): Promise<void> {
  if (!supabase) return;

  // Check if already analyzed
  const { data: existing } = await supabase
    .from('debate_ideology_analysis')
    .select('id')
    .eq('vote_id', voteId)
    .maybeSingle();

  if (existing) {
    console.log(`⏭️  Vote ${voteId} already analyzed, skipping`);
    return;
  }

  // Fetch vote record
  const { data: vote, error: voteError } = await supabase
    .from('td_votes')
    .select('*, td_scores:td_id(politician_name, party, constituency)')
    .eq('id', voteId)
    .maybeSingle();

  if (voteError || !vote) {
    console.error(`❌ Error fetching vote ${voteId}:`, voteError?.message);
    return;
  }

  const tdMeta = vote.td_scores as any;
  if (!tdMeta) {
    // Votes should only be from TDs, but check anyway
    console.log(`⏭️  Skipping vote ${voteId} - TD not found in database`);
    return;
  }

  // Verify TD exists in td_scores (should always be true for votes, but double-check)
  const { data: tdVerify } = await supabase
    .from('td_scores')
    .select('politician_name')
    .eq('politician_name', tdMeta.politician_name)
    .maybeSingle();

  if (!tdVerify) {
    console.log(`⏭️  Skipping vote ${voteId} - ${tdMeta.politician_name} is not a TD`);
    return;
  }

  console.log(`🗳️  Analyzing vote by ${tdMeta.politician_name} (${vote.td_party_at_vote || 'Unknown'})`);

  // Analyze vote with LLM
  const analysis = await extractIdeologyFromVote(vote as VoteRecord, tdMeta.politician_name);

  if (!analysis) {
    console.error(`❌ Failed to analyze vote ${voteId}`);
    return;
  }

  // Check for party discipline context
  const partyContext = await determinePartyDisciplineContext(
    tdMeta.politician_name,
    vote.td_party_at_vote,
    null, // No role for votes
    analysis.stance,
    analysis.policy_topic,
  );

  // VOTING RECORDS = 2.5× weight vs speeches (gold standard)
  const voteWeight = 2.5;

  // Calculate effective weight with party discipline
  let effectiveWeight = voteWeight * analysis.confidence;

  // Apply issue salience weighting (BEFORE consistency check)
  const salienceAdjustedDeltas: Record<string, number> = {};
  const topicSalience = ISSUE_SALIENCE[analysis.policy_topic.toLowerCase()] || ISSUE_SALIENCE.default;

  for (const dimension of IDEOLOGY_DIMENSIONS) {
    const rawDelta = analysis.ideology_delta[dimension] || 0;
    const salienceWeight = topicSalience[dimension] || 0.5;
    salienceAdjustedDeltas[dimension] = rawDelta * salienceWeight;
  }

  // Check for consistency with previous statements
  const consistencyCheck = await checkConsistency(
    tdMeta.politician_name,
    analysis.policy_topic,
    salienceAdjustedDeltas,
    vote.vote_date,
    'vote',
    voteId.toString(),
  );

  // Apply consistency penalty if contradiction detected
  if (consistencyCheck.hasContradiction) {
    effectiveWeight *= consistencyCheck.penalty;
    console.log(`   ⚠️  Consistency issue detected: ${consistencyCheck.reason} (penalty: ${consistencyCheck.penalty.toFixed(2)}×)`);
  }

  // Apply party discipline adjustments (votes are stronger signals)
  if (partyContext.isRebellion) {
    effectiveWeight *= 1.5; // 50% increase - voting rebellion is VERY significant!
  } else if (partyContext.isCrossParty) {
    effectiveWeight *= 1.3; // 30% increase - cross-party vote
  } else if (partyContext.isDefendingPartyPolicy && partyContext.isGovernmentTD) {
    effectiveWeight *= 0.7; // 30% reduction - party discipline (less penalty than speeches)
  } else if (partyContext.isOpposingPartyPolicy && partyContext.isOppositionTD) {
    effectiveWeight *= 0.8; // 20% reduction - expected opposition (less penalty than speeches)
  }

  // Save analysis record
  await saveVoteAnalysis(voteId, tdMeta.politician_name, analysis, effectiveWeight, partyContext);

  // Get current profile for history
  const { data: currentProfile } = await supabase
    .from('td_ideology_profiles')
    .select('*')
    .eq('politician_name', tdMeta.politician_name)
    .maybeSingle() || { data: null };

  // Save to history before applying adjustments
  if (currentProfile) {
    await saveToHistory(
      tdMeta.politician_name,
      analysis.policy_topic,
      salienceAdjustedDeltas,
      vote.vote_date,
      currentProfile,
      'vote',
      voteId.toString(),
    );
  }

  // Apply ideology adjustments using existing service
  await TDIdeologyProfileService.applyAdjustments(
    tdMeta.politician_name,
    salienceAdjustedDeltas,
    {
      sourceType: 'debate',
      sourceId: voteId,
      policyTopic: analysis.policy_topic,
      weight: effectiveWeight,
      confidence: analysis.confidence,
      sourceDate: vote.vote_date,
      sourceReliability: 0.98, // Voting records = highest reliability
    }
  );

  console.log(`✅ Vote analysis complete for ${tdMeta.politician_name} (weight: ${effectiveWeight.toFixed(2)}×)`);
}

/**
 * Extract ideology deltas from speech using LLM
 */
async function extractIdeologyFromSpeech(
  speech: DebateSpeech,
  speechText: string,
  debateTopic: string,
): Promise<DebateAnalysis | null> {
  try {
    const prompt = createSpeechAnalysisPrompt(speech, speechText, debateTopic);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a political scientist analyzing parliamentary speeches to extract ideological positions. Be precise and conservative with signal strength.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const result = JSON.parse(content) as DebateAnalysis;
    
    // Validate and clamp ideology deltas
    for (const dimension of IDEOLOGY_DIMENSIONS) {
      result.ideology_delta[dimension] = Math.max(-0.5, Math.min(0.5, result.ideology_delta[dimension] || 0));
    }

    return result;
  } catch (error: any) {
    console.error('Error extracting ideology from speech:', error.message);
    return null;
  }
}

/**
 * Extract ideology deltas from vote using LLM
 */
async function extractIdeologyFromVote(
  vote: VoteRecord,
  politicianName: string,
): Promise<VoteAnalysis | null> {
  try {
    const prompt = createVoteAnalysisPrompt(vote, politicianName);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a political scientist analyzing voting records to extract ideological positions. Voting records are the gold standard for ideology.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const result = JSON.parse(content) as VoteAnalysis;
    
    // Validate and clamp ideology deltas
    for (const dimension of IDEOLOGY_DIMENSIONS) {
      result.ideology_delta[dimension] = Math.max(-0.5, Math.min(0.5, result.ideology_delta[dimension] || 0));
    }

    return result;
  } catch (error: any) {
    console.error('Error extracting ideology from vote:', error.message);
    return null;
  }
}

/**
 * Create LLM prompt for speech analysis
 */
function createSpeechAnalysisPrompt(
  speech: DebateSpeech,
  speechText: string,
  debateTopic: string,
): string {
  return `
You are analyzing a parliamentary debate speech to extract ideological positions.

SPEECH CONTEXT:
- Speaker: ${speech.speaker_name} (${speech.speaker_role || 'TD'}, ${speech.speaker_party || 'Independent'})
- Topic: ${debateTopic}
- Word Count: ${speech.word_count}
- Date: ${speech.recorded_time}

SPEECH TEXT:
${speechText.substring(0, 4000)} ${speechText.length > 4000 ? '[...truncated]' : ''}

YOUR TASKS:

1. EXTRACT IDEOLOGY DELTAS (scale ±0.5 max per dimension):
   Map this speech to ideology dimensions:
   - economic (market vs collective): e.g., tax cuts (+0.3), public spending (-0.3)
   - social (traditional vs progressive): e.g., conservative policy (+0.3), liberal policy (-0.3)
   - cultural (nationalism vs multiculturalism): e.g., immigration restriction (+0.3), multiculturalism (-0.3)
   - authority (authoritarian vs libertarian): e.g., police powers (+0.3), civil liberties (-0.3)
   - environmental (pro-business vs pro-climate): e.g., growth focus (+0.3), green policy (-0.3)
   - welfare (decrease vs increase): e.g., welfare cuts (+0.3), welfare expansion (-0.3)
   - globalism (national vs global): e.g., Ireland-first (+0.3), EU integration (-0.3)
   - technocratic (populist vs expert): e.g., popular will (+0.3), expert-led (-0.3)

   CALIBRATION (be conservative):
   - ±0.4-0.5: STRONG position (clear policy stance, major announcement, leading debate)
   - ±0.2-0.3: CLEAR position (explicit advocacy, vocal defense, direct action)
   - ±0.1-0.2: MODERATE signal (stated preference, implied position, questioning)
   - ±0.05-0.1: WEAK signal (tangential mention, vague statement, procedural)
   - 0.0: No clear ideological information

2. CLASSIFY SPEECH TYPE:
   - "rhetorical": Party talking points, vague language, emotional appeals, no specifics
   - "substantive": Specific policy details, numbers, concrete proposals, technical details
   - "mixed": Combination of rhetoric and substance

3. DETERMINE STATEMENT STRENGTH (1-5):
   - 5: Leading the debate, primary sponsor, strongest advocate
   - 4: Clear vocal position, explicit defense
   - 3: Moderate position, stated stance
   - 2: Weak position, brief mention
   - 1: Implied position only

4. IDENTIFY POLICY TOPIC:
   Brief description: "welfare", "immigration", "taxation", "housing", "healthcare", "education", "environment", "justice"

RETURN JSON:
{
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
  "statement_strength": 4,
  "stance": "support|oppose|neutral|unclear",
  "policy_topic": "welfare",
  "speech_classification": "rhetorical|substantive|mixed",
  "substantive_ratio": 0.8,
  "confidence": 0.85,
  "topic_dimension_mapping": {
    "welfare": 1.0,
    "social": 0.8,
    "economic": 0.6
  }
}
`;
}

/**
 * Create LLM prompt for vote analysis
 */
function createVoteAnalysisPrompt(
  vote: VoteRecord,
  politicianName: string,
): string {
  const voteDirection = vote.td_vote === 'Ta' ? 'Aye (support)' : vote.td_vote === 'Nil' ? 'Nay (oppose)' : 'Abstain';
  
  return `
You are analyzing a voting record to extract ideological positions. VOTING RECORDS ARE THE GOLD STANDARD FOR IDEOLOGY.

VOTE CONTEXT:
- TD: ${politicianName} (${vote.td_party_at_vote || 'Unknown'})
- Vote: ${voteDirection}
- Subject: ${vote.vote_subject}
- Date: ${vote.vote_date}
- Voted with party: ${vote.voted_with_party ? 'Yes' : 'No'}

VOTE SUBJECT:
${vote.vote_subject}

YOUR TASK:
Extract ideology deltas (scale ±0.5 max per dimension) based on the vote direction and subject.

For Aye votes: Positive delta for supporting the policy's ideological direction
For Nay votes: Negative delta for opposing the policy's ideological direction
For Abstain: Smaller delta (0.1-0.2) indicating uncertainty/neutrality

CALIBRATION:
- ±0.4-0.5: Major ideological vote (welfare expansion, immigration, major tax changes)
- ±0.2-0.3: Significant ideological position
- ±0.1-0.2: Moderate ideological signal
- ±0.05-0.1: Weak signal
- 0.0: No clear ideological content

RETURN JSON:
{
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
  "policy_topic": "welfare",
  "stance": "support|oppose|neutral",
  "confidence": 0.90
}
`;
}

/**
 * Determine party discipline context
 */
async function determinePartyDisciplineContext(
  politicianName: string,
  party: string | null,
  role: string | null,
  stance: 'support' | 'oppose' | 'neutral' | 'unclear',
  policyTopic: string,
): Promise<PartyDisciplineContext> {
  if (!supabase || !party) {
    return {
      isGovernmentTD: false,
      isOppositionTD: false,
      isDefendingPartyPolicy: false,
      isOpposingPartyPolicy: false,
      isRebellion: false,
      isCrossParty: false,
    };
  }

  // Determine if TD is in government (check for Minister role or government party)
  const isGovernmentTD = role?.toLowerCase().includes('minister') || 
                        role?.toLowerCase().includes('taoiseach') ||
                        role?.toLowerCase().includes('tánaiste') ||
                        ['Fine Gael', 'Fianna Fáil', 'Green Party'].includes(party);

  const isOppositionTD = !isGovernmentTD && 
                        !['Fine Gael', 'Fianna Fáil', 'Green Party'].includes(party);

  // Check if stance aligns with party policy (simplified - would need party policy database)
  // For now, use basic heuristics
  const isDefendingPartyPolicy = isGovernmentTD && stance === 'support';
  const isOpposingPartyPolicy = isOppositionTD && stance === 'oppose';

  // Rebellion: Government TD opposing government policy
  const isRebellion = isGovernmentTD && stance === 'oppose';

  // Cross-party: Opposition TD supporting government policy
  const isCrossParty = isOppositionTD && stance === 'support';

  return {
    isGovernmentTD,
    isOppositionTD,
    isDefendingPartyPolicy,
    isOpposingPartyPolicy,
    isRebellion,
    isCrossParty,
  };
}

/**
 * Calculate speech quality weights
 */
function calculateSpeechQualityWeights(
  speech: DebateSpeech,
  analysis: DebateAnalysis,
): {
  baseWeight: number;
  lengthWeight: number;
  roleWeight: number;
  statementStrengthWeight: number;
  speechTypeWeight: number;
} {
  // Length weight (500 words = full weight)
  const lengthWeight = Math.min(1.0, speech.word_count / 500);

  // Role weight
  let roleWeight = 0.7; // Default (Opposition TD)
  if (speech.speaker_role?.toLowerCase().includes('minister')) {
    roleWeight = 1.0;
  } else if (speech.speaker_role?.toLowerCase().includes('leader')) {
    roleWeight = 0.9;
  } else if (speech.speaker_role?.toLowerCase().includes('backbencher')) {
    roleWeight = 0.6;
  } else if (speech.speaker_role?.toLowerCase().includes('comhairle')) {
    roleWeight = 0.0; // Technical role, no ideology
  }

  // Statement strength weight (1-5 scale)
  const statementStrengthWeight = analysis.statement_strength / 5;

  // Speech type weight (would need debate context - defaulting)
  const speechTypeWeight = 0.8; // Default (response/intervention)

  const baseWeight = lengthWeight * roleWeight * statementStrengthWeight * speechTypeWeight;

  return {
    baseWeight,
    lengthWeight,
    roleWeight,
    statementStrengthWeight,
    speechTypeWeight,
  };
}

/**
 * Save debate analysis to database
 */
async function saveDebateAnalysis(
  speechId: string,
  politicianName: string,
  analysis: DebateAnalysis,
  qualityWeights: ReturnType<typeof calculateSpeechQualityWeights>,
  effectiveWeight: number,
  partyContext: PartyDisciplineContext,
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from('debate_ideology_analysis')
    .insert({
      speech_id: speechId,
      politician_name: politicianName,
      ideology_delta: analysis.ideology_delta,
      statement_strength: analysis.statement_strength,
      policy_topic: analysis.policy_topic,
      stance: analysis.stance,
      speech_classification: analysis.speech_classification,
      substantive_ratio: analysis.substantive_ratio,
      speech_length_weight: qualityWeights.lengthWeight,
      role_weight: qualityWeights.roleWeight,
      statement_strength_weight: qualityWeights.statementStrengthWeight,
      speech_type_weight: qualityWeights.speechTypeWeight,
      effective_weight: effectiveWeight,
      is_government_td: partyContext.isGovernmentTD,
      is_rebellion: partyContext.isRebellion,
      is_cross_party: partyContext.isCrossParty,
      confidence: analysis.confidence,
      analyzed_at: new Date().toISOString(),
      analyzed_by: 'gpt-4o-mini',
    });

  if (error) {
    console.error('Error saving debate analysis:', error.message);
  }
}

/**
 * Check consistency with previous statements on same topic
 */
async function checkConsistency(
  politicianName: string,
  policyTopic: string,
  currentDelta: Record<string, number>,
  statementDate: string,
  sourceType: 'speech' | 'vote' = 'speech',
  sourceId: string = '',
): Promise<{
  hasContradiction: boolean;
  penalty: number;
  reason: string;
}> {
  if (!supabase) {
    return { hasContradiction: false, penalty: 1.0, reason: '' };
  }

  // Get TD's current ideology profile
  const { data: profile } = await supabase
    .from('td_ideology_profiles')
    .select('*')
    .eq('politician_name', politicianName)
    .maybeSingle();

  if (!profile) {
    return { hasContradiction: false, penalty: 1.0, reason: '' };
  }

  // Check recent statements on same topic (within 180 days)
  const statementDateObj = new Date(statementDate);
  const cutoffDate = new Date(statementDateObj.getTime() - 180 * 24 * 60 * 60 * 1000);

  const { data: recentStatements } = await supabase
    .from('debate_ideology_history')
    .select('*')
    .eq('politician_name', politicianName)
    .eq('policy_topic', policyTopic)
    .gte('statement_date', cutoffDate.toISOString())
    .order('statement_date', { ascending: false })
    .limit(5);

  if (!recentStatements || recentStatements.length === 0) {
    return { hasContradiction: false, penalty: 1.0, reason: '' };
  }

  // Check for contradictions in each dimension
  let hasContradiction = false;
  let contradictionSeverity = 0;
  let contradictionReason = '';

  for (const dimension of IDEOLOGY_DIMENSIONS) {
    const currentDeltaValue = currentDelta[dimension] || 0;

    for (const prevStatement of recentStatements) {
      if (prevStatement.ideology_dimension !== dimension) continue;

      const prevDelta = prevStatement.statement_delta || 0;

      // Check if contradiction (opposite direction)
      if (Math.sign(currentDeltaValue) !== Math.sign(prevDelta) && 
          Math.abs(currentDeltaValue) > 0.1 && 
          Math.abs(prevDelta) > 0.1) {
        hasContradiction = true;
        const daysSince = (statementDateObj.getTime() - new Date(prevStatement.statement_date).getTime()) / (24 * 60 * 60 * 1000);

        if (daysSince < 180) {
          contradictionSeverity += 1;
          if (daysSince < 30) {
            contradictionReason = `Recent contradiction (${Math.round(daysSince)} days ago) on ${dimension}`;
          } else {
            contradictionReason = `Contradiction (${Math.round(daysSince)} days ago) on ${dimension}`;
          }
        }
      }
    }
  }

  // Calculate penalty based on severity
  let penalty = 1.0;
  if (hasContradiction) {
    if (contradictionSeverity >= 3) {
      penalty = 0.4; // Strong contradiction - heavy penalty
    } else if (contradictionSeverity >= 2) {
      penalty = 0.5; // Moderate contradiction
    } else {
      penalty = 0.7; // Mild contradiction
    }
  }

  return {
    hasContradiction,
    penalty,
    reason: contradictionReason || '',
  };
}

/**
 * Save statement to history for consistency checking
 */
async function saveToHistory(
  politicianName: string,
  policyTopic: string,
  delta: Record<string, number>,
  statementDate: string,
  profile: any,
  sourceType: 'speech' | 'vote',
  sourceId: string,
): Promise<void> {
  if (!supabase || !profile) return;

  const historyEntries = [];

  for (const dimension of IDEOLOGY_DIMENSIONS) {
    const deltaValue = delta[dimension] || 0;
    if (Math.abs(deltaValue) < 0.01) continue; // Skip negligible deltas

    historyEntries.push({
      politician_name: politicianName,
      policy_topic: policyTopic,
      ideology_dimension: dimension,
      previous_value: Number(profile[dimension]) || 0,
      statement_delta: deltaValue,
      statement_date: statementDate,
      source_type: sourceType,
      source_id: sourceId,
    });
  }

  if (historyEntries.length > 0) {
    const { error } = await supabase
      .from('debate_ideology_history')
      .upsert(historyEntries, {
        onConflict: 'politician_name,policy_topic,ideology_dimension,statement_date,source_id',
      });

    if (error) {
      console.error('Error saving to ideology history:', error.message);
    } else {
      console.log(`   📚 Saved to ideology history: ${historyEntries.length} dimension(s)`);
    }
  }
}

/**
 * Save vote analysis to database
 */
async function saveVoteAnalysis(
  voteId: number,
  politicianName: string,
  analysis: VoteAnalysis,
  effectiveWeight: number,
  partyContext: PartyDisciplineContext,
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from('debate_ideology_analysis')
    .insert({
      vote_id: voteId,
      politician_name: politicianName,
      ideology_delta: analysis.ideology_delta,
      policy_topic: analysis.policy_topic,
      stance: analysis.stance,
      speech_classification: 'substantive', // Votes are always substantive
      substantive_ratio: 1.0,
      effective_weight: effectiveWeight,
      is_government_td: partyContext.isGovernmentTD,
      is_rebellion: partyContext.isRebellion,
      is_cross_party: partyContext.isCrossParty,
      confidence: analysis.confidence,
      analyzed_at: new Date().toISOString(),
      analyzed_by: 'gpt-4o-mini',
    });

  if (error) {
    console.error('Error saving vote analysis:', error.message);
  }
}

/**
 * Process unprocessed debates in batches
 */
export async function processUnprocessedDebates(batchSize: number = 50, lookbackDays: number = 14): Promise<{
  speechesProcessed: number;
  votesProcessed: number;
  errors: number;
}> {
  if (!supabase) {
    return { speechesProcessed: 0, votesProcessed: 0, errors: 0 };
  }

  const stats = {
    speechesProcessed: 0,
    votesProcessed: 0,
    errors: 0,
  };

  // Calculate date cutoff (last 2 weeks by default)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
  const cutoffDateStr = cutoffDate.toISOString();

  console.log(`📅 Processing debates from last ${lookbackDays} days (since ${cutoffDateStr.split('T')[0]})`);

  // Get unprocessed speeches from last 2 weeks only
  // Use a subquery approach to exclude already analyzed speeches
  const { data: unprocessedSpeeches, error: speechesError } = await supabase
    .rpc('get_unprocessed_debate_speeches', {
      cutoff_date: cutoffDateStr,
      batch_limit: batchSize
    });

  // Fallback: if RPC doesn't exist, use direct query with NOT IN subquery
  let speechesToProcess: any[] = [];
  if (speechesError || !unprocessedSpeeches) {
    // Direct query approach - get speeches not in analyzed list
    const { data: allSpeeches } = await supabase
      .from('debate_speeches')
      .select('id')
      .gte('recorded_time', cutoffDateStr)
      .limit(batchSize * 2); // Get more to account for filtering

    if (allSpeeches) {
      // Get analyzed speech IDs
      const { data: analyzedSpeeches } = await supabase
        .from('debate_ideology_analysis')
        .select('speech_id')
        .not('speech_id', 'is', null);

      const analyzedSpeechIds = new Set(
        analyzedSpeeches?.map((s: any) => s.speech_id).filter(Boolean) || []
      );

      // Filter out already analyzed
      speechesToProcess = allSpeeches
        .filter((s: any) => !analyzedSpeechIds.has(s.id))
        .slice(0, batchSize);
    }
  } else {
    speechesToProcess = unprocessedSpeeches || [];
  }

  if (speechesToProcess && speechesToProcess.length > 0) {
    console.log(`   Found ${speechesToProcess.length} unprocessed speeches to analyze`);
    for (const speech of speechesToProcess) {
      try {
        await analyzeDebateSpeech(speech.id);
        stats.speechesProcessed++;
        // Rate limiting: 2 seconds between LLM calls
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`Error processing speech ${speech.id}:`, error.message);
        stats.errors++;
      }
    }
  } else {
    console.log(`   No unprocessed speeches found in date range`);
  }

  // Process votes - get unprocessed votes from last 2 weeks only
  const { data: allVotes } = await supabase
    .from('td_votes')
    .select('id')
    .gte('vote_date', cutoffDateStr.split('T')[0])
    .limit(batchSize * 2); // Get more to account for filtering

  let votesToProcess: any[] = [];
  if (allVotes) {
    // Get analyzed vote IDs
    const { data: analyzedVotes } = await supabase
      .from('debate_ideology_analysis')
      .select('vote_id')
      .not('vote_id', 'is', null);

    const analyzedVoteIds = new Set(
      analyzedVotes?.map((v: any) => v.vote_id).filter(Boolean) || []
    );

    // Filter out already analyzed
    votesToProcess = allVotes
      .filter((v: any) => !analyzedVoteIds.has(v.id))
      .slice(0, batchSize);
  }

  if (votesToProcess && votesToProcess.length > 0) {
    console.log(`   Found ${votesToProcess.length} unprocessed votes to analyze`);
    for (const vote of votesToProcess) {
      try {
        await analyzeVoteRecord(vote.id);
        stats.votesProcessed++;
        // Rate limiting: 2 seconds between LLM calls
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`Error processing vote ${vote.id}:`, error.message);
        stats.errors++;
      }
    }
  } else {
    console.log(`   No unprocessed votes found in date range`);
  }

  return stats;
}

