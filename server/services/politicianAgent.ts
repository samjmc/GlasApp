
import { supabaseDb } from '../db';
import { generateEmbedding } from './openaiService';

export interface PolicyPosition {
  id: string;
  topic: string;
  position_summary: string;
  strength: number;
  trend: string;
  key_quote_ids: string[];
  updated_at: string;
}

export interface DebateSearchResult {
  id: string;
  chunk_content: string;
  date: string;
  similarity: number;
  topic: string | null;
}

/**
 * Get structured policy positions for a politician
 */
export async function getPolicyPositions(politicianName: string, topic?: string): Promise<PolicyPosition[]> {
  if (!supabaseDb) throw new Error('Supabase client not initialized');

  // 1. Get Politician ID
  const { data: td, error: tdError } = await supabaseDb
    .from('td_scores')
    .select('id')
    .eq('politician_name', politicianName)
    .single();

  if (tdError || !td) {
    console.warn(`Politician not found: ${politicianName}`);
    return [];
  }

  // 2. Query Policy Positions
  let query = supabaseDb
    .from('policy_positions')
    .select('*')
    .eq('politician_id', td.id);

  if (topic) {
    query = query.ilike('topic', `%${topic}%`);
  }

  const { data: positions, error } = await query;

  if (error) {
    throw new Error(`Error fetching positions: ${error.message}`);
  }

  return positions || [];
}

/**
 * Search the politician's debate record using vector similarity
 */
export async function searchDebateRecord(
  politicianName: string, 
  queryText: string, 
  limit = 5
): Promise<DebateSearchResult[]> {
  if (!supabaseDb) throw new Error('Supabase client not initialized');

  try {
    // 1. Generate Embedding
    const embedding = await generateEmbedding(queryText);

    // 2. Call RPC
    // Signature: match_debate_chunks_text(query_embedding, match_threshold, match_count, filter_politician_name)
    const { data, error } = await supabaseDb.rpc('match_debate_chunks_text', {
      query_embedding: embedding,
      match_threshold: 0.5, // Adjust as needed
      match_count: limit,
      filter_politician_name: politicianName
    });

    if (error) {
      throw new Error(`Vector search failed: ${error.message}`);
    }

    return data || [];
  } catch (err) {
    console.error('Error in searchDebateRecord:', err);
    return [];
  }
}

/**
 * Check if a politician has a clear position on a topic
 * Returns a confidence score and the position if found
 */
export async function checkPositionConfidence(
  politicianName: string, 
  topic: string
): Promise<{ hasPosition: boolean; position: PolicyPosition | null; confidence: number }> {
  const positions = await getPolicyPositions(politicianName, topic);
  
  if (positions.length === 0) {
    return { hasPosition: false, position: null, confidence: 0 };
  }

  // Find the best match (highest strength)
  const bestPosition = positions.reduce((prev, current) => 
    (current.strength > prev.strength) ? current : prev
  );

  return {
    hasPosition: true,
    position: bestPosition,
    confidence: bestPosition.strength
  };
}

