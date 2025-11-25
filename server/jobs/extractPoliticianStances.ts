/**
 * Stance Extraction Job
 * 
 * Analyzes debate chunks to extract explicit political stances on topics.
 * This powers:
 * 1. Flip-flop tracker and consistency scoring
 * 2. TD ideology dimension updates (economic, social, etc.)
 * 3. Party aggregation downstream
 * 
 * Run with: npm run debates:extract-stances
 */

import 'dotenv/config';
import { supabaseDb } from '../db';
import OpenAI from 'openai';
import { TDIdeologyProfileService } from '../services/tdIdeologyProfileService';
import { IDEOLOGY_DIMENSIONS, type IdeologyDimension } from '../constants/ideology';

const BATCH_SIZE = 10;
const TOPICS = [
  'housing',
  'healthcare',
  'immigration',
  'taxation',
  'climate',
  'education',
  'crime',
  'economy',
  'EU',
  'Northern Ireland',
  'agriculture',
  'transport',
  'childcare',
  'pensions',
  'defence',
  'workers_rights',
  'business',
  'social_welfare',
  'justice',
  'foreign_policy'
];

// Map topics to ideology dimensions for automatic ideology updates
const TOPIC_TO_IDEOLOGY_MAP: Record<string, Partial<Record<IdeologyDimension, number>>> = {
  // Economic dimension: positive = free market, negative = state intervention
  'taxation': { economic: 1 },           // Tax discussions often reveal economic stance
  'business': { economic: 1 },
  'economy': { economic: 1 },
  'workers_rights': { economic: -1, welfare: 1 },
  
  // Social dimension: positive = progressive, negative = conservative
  'immigration': { social: 1, globalism: 1 },
  'justice': { social: 1, authority: -1 },
  
  // Environmental dimension
  'climate': { environmental: 1 },
  'agriculture': { environmental: 0.5 },
  
  // Welfare dimension: positive = pro-welfare
  'healthcare': { welfare: 1 },
  'social_welfare': { welfare: 1 },
  'childcare': { welfare: 1 },
  'pensions': { welfare: 1 },
  'housing': { welfare: 0.5, economic: -0.5 },
  'education': { welfare: 0.5, technocratic: 0.5 },
  
  // Authority dimension: positive = pro-authority
  'crime': { authority: 1 },
  'defence': { authority: 1 },
  
  // Globalism dimension: positive = internationalist
  'EU': { globalism: 1 },
  'foreign_policy': { globalism: 1 },
  'Northern Ireland': { globalism: 0.5 },
};

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

interface ExtractedStance {
  topic: string;
  stance: 'supports' | 'opposes' | 'neutral' | 'mixed' | 'unclear';
  summary: string;
  confidence: number;
  intensity?: number; // 1-5 scale of how strongly they feel
}

async function extractStancesFromChunk(chunk: any): Promise<ExtractedStance[]> {
  const prompt = `Analyze this political speech excerpt and extract any clear stances on policy topics.

Speech by ${chunk.politician_name} (${chunk.date ? new Date(chunk.date).toLocaleDateString() : 'date unknown'}):
"${chunk.chunk_content}"

For each topic where the speaker takes a clear position, extract:
1. topic: One of [${TOPICS.join(', ')}] or "other:[specific topic]"
2. stance: "supports", "opposes", "neutral", "mixed", or "unclear"
3. summary: One sentence summary of their position (max 100 chars)
4. confidence: 0.0-1.0 how confident you are in this extraction
5. intensity: 1-5 how strongly they feel (1=mild preference, 5=passionate advocacy)

Rules:
- Only extract stances that are EXPLICITLY stated or very clearly implied
- Don't infer stances from tangential comments
- If they criticize a policy, that's "opposes"
- If they praise/advocate for something, that's "supports"
- "mixed" means they explicitly acknowledge both pros and cons
- Skip topics not mentioned at all
- intensity=5 for passionate statements like "absolutely unacceptable" or "we must urgently"
- intensity=1 for mild statements like "perhaps we could consider"

Return JSON: {"stances": [{"topic": "...", "stance": "...", "summary": "...", "confidence": 0.X, "intensity": N}, ...]}
Return {"stances": []} if no clear stances found.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.3 // Low temp for consistent extraction
    });

    const content = response.choices[0].message.content || '{"stances":[]}';
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : (parsed.stances || []);
  } catch (err) {
    console.error('Extraction error:', err);
    return [];
  }
}

async function getPreviousStance(politicianName: string, topic: string): Promise<string | null> {
  if (!supabaseDb) return null;
  
  const { data } = await supabaseDb
    .from('politician_stances')
    .select('stance')
    .eq('politician_name', politicianName)
    .eq('topic', topic)
    .order('statement_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  return data?.stance || null;
}

async function saveStance(
  chunk: any,
  stance: ExtractedStance,
  previousStance: string | null
): Promise<void> {
  if (!supabaseDb) return;
  
  const isPositionChange = previousStance !== null && previousStance !== stance.stance;
  
  await supabaseDb.from('politician_stances').insert({
    politician_name: chunk.politician_name,
    topic: stance.topic,
    stance: stance.stance,
    stance_summary: stance.summary,
    confidence: stance.confidence,
    source_chunk_id: chunk.id,
    statement_date: chunk.date,
    previous_stance: previousStance,
    is_position_change: isPositionChange
  });
  
  if (isPositionChange) {
    console.log(`🔄 POSITION CHANGE: ${chunk.politician_name} on ${stance.topic}: ${previousStance} → ${stance.stance}`);
  }
  
  // Update ideology dimensions based on stance
  await updateIdeologyFromStance(chunk, stance);
}

/**
 * Convert a stance extraction into ideology dimension adjustments
 * This powers the TD ideology profiles and party aggregations
 */
async function updateIdeologyFromStance(chunk: any, stance: ExtractedStance): Promise<void> {
  const topicMapping = TOPIC_TO_IDEOLOGY_MAP[stance.topic];
  if (!topicMapping) return; // Topic doesn't map to ideology dimensions
  
  // Calculate direction multiplier based on stance
  let directionMultiplier = 0;
  switch (stance.stance) {
    case 'supports':
      directionMultiplier = 1;
      break;
    case 'opposes':
      directionMultiplier = -1;
      break;
    case 'mixed':
      directionMultiplier = 0; // Mixed views don't shift ideology
      return;
    case 'neutral':
    case 'unclear':
      return; // No ideology update for unclear stances
  }
  
  // Calculate intensity factor (1-5 → 0.4-1.0)
  const intensityFactor = 0.4 + ((stance.intensity || 3) - 1) * 0.15;
  
  // Build ideology adjustments
  const adjustments: Record<string, number> = {};
  for (const [dimension, baseValue] of Object.entries(topicMapping)) {
    // Raw delta: direction × base mapping × intensity
    // Scale to ±0.3 max (the TDIdeologyProfileService will further cap this)
    adjustments[dimension] = directionMultiplier * (baseValue as number) * intensityFactor * 0.3;
  }
  
  // Apply to TD ideology profile
  try {
    await TDIdeologyProfileService.applyAdjustments(
      chunk.politician_name,
      adjustments,
      {
        sourceType: 'debate',
        sourceId: chunk.id,
        policyTopic: stance.topic,
        weight: 1.0,
        confidence: stance.confidence,
        sourceDate: chunk.date,
        sourceReliability: 0.95 // Parliamentary debate = high reliability
      }
    );
    
    console.log(`   📊 Updated ideology for ${chunk.politician_name} from ${stance.topic} stance`);
  } catch (err) {
    console.error(`   ❌ Failed to update ideology: ${err}`);
  }
}

async function processChunks(): Promise<void> {
  if (!supabaseDb) {
    console.error('❌ Database not available');
    return;
  }

  console.log('🔍 Starting Stance Extraction Job...');
  
  // Get chunks that haven't been processed for stance extraction
  const { data: chunks, error } = await supabaseDb
    .from('debate_chunks')
    .select('id, politician_name, chunk_content, date')
    .not('id', 'in', 
      supabaseDb.from('politician_stances').select('source_chunk_id')
    )
    .order('date', { ascending: false }) // Process recent chunks first
    .limit(BATCH_SIZE);

  if (error) {
    console.error('❌ Error fetching chunks:', error);
    return;
  }

  if (!chunks || chunks.length === 0) {
    console.log('✅ No new chunks to process');
    return;
  }

  console.log(`📦 Processing ${chunks.length} chunks...`);

  let stancesExtracted = 0;
  let positionChanges = 0;

  for (const chunk of chunks) {
    const stances = await extractStancesFromChunk(chunk);
    
    for (const stance of stances) {
      if (stance.confidence < 0.6) continue; // Skip low-confidence extractions
      
      const previousStance = await getPreviousStance(chunk.politician_name, stance.topic);
      await saveStance(chunk, stance, previousStance);
      
      stancesExtracted++;
      if (previousStance && previousStance !== stance.stance) {
        positionChanges++;
      }
    }
    
    process.stdout.write('.');
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ Done! Extracted ${stancesExtracted} stances, found ${positionChanges} position changes.`);
}

// Run the job
processChunks().catch(console.error);

