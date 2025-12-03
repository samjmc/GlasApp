
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

export interface VoteRecord {
  date: string;
  subject: string;
  vote: 'ta' | 'nil' | 'staon';
  outcome: string;
  votedWithParty: boolean | null;
  category?: string;
  isRebelVote?: boolean;
  description?: string | null;
}

export interface VotingFilters {
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;    // YYYY-MM-DD
  category?: string;   // housing, health, economy, etc.
  onlyRebelVotes?: boolean;
}

// Helper to enrich votes with plain English descriptions
async function enrichVotesWithDescriptions(votes: any[]): Promise<VoteRecord[]> {
  if (!votes || votes.length === 0) return [];
  
  const uniqueSubjects = [...new Set(votes.map(v => v.vote_subject))];
  let descriptionsMap: Record<string, string> = {};
  
  if (uniqueSubjects.length > 0) {
    const { data: descriptions } = await supabaseDb
      .from('vote_subject_embeddings')
      .select('vote_subject, description')
      .in('vote_subject', uniqueSubjects);
      
    if (descriptions) {
      descriptions.forEach((d: any) => {
        if (d.description) descriptionsMap[d.vote_subject] = d.description;
      });
    }
  }
  
  return votes.map(v => ({
    date: v.vote_date,
    subject: v.vote_subject,
    description: descriptionsMap[v.vote_subject] || null,
    vote: v.td_vote as 'ta' | 'nil' | 'staon',
    outcome: v.vote_outcome,
    votedWithParty: v.voted_with_party,
    category: v.vote_category,
    isRebelVote: v.is_rebel_vote
  }));
}

/**
 * Get a politician's voting record on a specific topic or bill
 * This is the KEY tool for answering "Did you vote for X?" questions
 * Now supports time-based filtering and category search
 */
export async function getVotingRecord(
  politicianName: string,
  topicOrKeyword: string,
  limit = 10,
  filters?: VotingFilters
): Promise<VoteRecord[]> {
  if (!supabaseDb) throw new Error('Supabase client not initialized');

  console.log(`Tool: Getting voting record for '${politicianName}' on '${topicOrKeyword}'`);

  // 1. Get Politician ID
  const { data: td, error: tdError } = await supabaseDb
    .from('td_scores')
    .select('id')
    .ilike('politician_name', politicianName)
    .single();

  if (tdError || !td) {
    console.warn(`Politician not found: ${politicianName}`);
    return [];
  }

  // 2. Build query with filters
  let query = supabaseDb
    .from('td_votes')
    .select('vote_date, vote_subject, td_vote, vote_outcome, voted_with_party, vote_category, is_rebel_vote')
    .eq('td_id', td.id);

  // Search by subject keyword OR category
  if (topicOrKeyword) {
    const searchLower = topicOrKeyword.toLowerCase().trim();
    
    // 1. Check if the keyword matches a category directly
    const categories = ['housing', 'health', 'economy', 'foreign_affairs', 'justice', 'education', 'environment', 'social_welfare', 'defence', 'procedural'];
    
    if (categories.includes(searchLower)) {
      query = query.eq('vote_category', searchLower);
    } else {
      // 2. Try Semantic Search first (Finds "Climate Action Bill" from "climate bill")
      let semanticMatchesFound = false;
      try {
        console.log(`Generating embedding for vote search: '${topicOrKeyword}'`);
        const embedding = await generateEmbedding(topicOrKeyword);
        
        const { data: matches, error: matchError } = await supabaseDb.rpc('match_vote_subjects', {
          query_embedding: embedding,
          match_threshold: 0.45, // Lowered slightly to catch "climate bill" -> "Climate Action..."
          match_count: 20
        });

        if (!matchError && matches && matches.length > 0) {
          const subjects = matches.map((m: any) => m.vote_subject);
          console.log(`✅ Semantic search found ${subjects.length} matches for '${topicOrKeyword}'`);
          query = query.in('vote_subject', subjects);
          semanticMatchesFound = true;
        } else {
          console.log(`No semantic matches found for '${topicOrKeyword}' (threshold 0.45)`);
        }
      } catch (e) {
        console.warn('Semantic search failed:', e);
      }

      // 3. Fallback to keyword search if semantic search failed or found nothing
      if (!semanticMatchesFound) {
        console.log(`Falling back to keyword search for '${topicOrKeyword}'`);
        // Map common topic words to categories for better matching (legacy fallback)
        const topicToCategoryMap: Record<string, string> = {
          'climate': 'environment',
          'carbon': 'environment',
          'energy': 'environment',
          'hospital': 'health',
          'healthcare': 'health',
          'rent': 'housing',
          'eviction': 'housing',
          'budget': 'economy',
          'tax': 'economy',
          'gaza': 'foreign_affairs',
          'ukraine': 'foreign_affairs',
          'crime': 'justice',
          'school': 'education'
        };
        
        // Check if any word in the search maps to a category
        const searchWords = searchLower.split(/\s+/);
        let matchedCategory: string | null = null;
        
        for (const word of searchWords) {
          if (topicToCategoryMap[word]) {
            matchedCategory = topicToCategoryMap[word];
            break;
          }
        }
        
        if (matchedCategory) {
          query = query.eq('vote_category', matchedCategory);
        } else {
          // Simple keyword match
          query = query.ilike('vote_subject', `%${topicOrKeyword}%`);
        }
      }
    }
  }

  // Apply additional filters
  if (filters?.startDate) {
    query = query.gte('vote_date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('vote_date', filters.endDate);
  }
  if (filters?.category) {
    query = query.eq('vote_category', filters.category);
  }
  if (filters?.onlyRebelVotes) {
    query = query.eq('is_rebel_vote', true);
  }

  const { data: votes, error } = await query
    .order('vote_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching votes:', error);
    return [];
  }

  return enrichVotesWithDescriptions(votes || []);
}

/**
 * Get recent votes for a politician (for general activity overview)
 */
export async function getRecentVotes(
  politicianName: string,
  limit = 5
): Promise<VoteRecord[]> {
  if (!supabaseDb) throw new Error('Supabase client not initialized');

  // 1. Get Politician ID
  const { data: td, error: tdError } = await supabaseDb
    .from('td_scores')
    .select('id')
    .ilike('politician_name', politicianName)
    .single();

  if (tdError || !td) {
    return [];
  }

  // 2. Get most recent votes
  const { data: votes, error } = await supabaseDb
    .from('td_votes')
    .select('vote_date, vote_subject, td_vote, vote_outcome, voted_with_party, vote_category, is_rebel_vote')
    .eq('td_id', td.id)
    .order('vote_date', { ascending: false })
    .limit(limit);

  if (error) {
    return [];
  }

  return enrichVotesWithDescriptions(votes || []);
}

/**
 * Get rebel votes for a politician (votes against party line)
 */
export async function getRebelVotes(
  politicianName: string,
  limit = 10
): Promise<VoteRecord[]> {
  if (!supabaseDb) throw new Error('Supabase client not initialized');

  const { data: td, error: tdError } = await supabaseDb
    .from('td_scores')
    .select('id')
    .ilike('politician_name', politicianName)
    .single();

  if (tdError || !td) {
    return [];
  }

  const { data: votes, error } = await supabaseDb
    .from('td_votes')
    .select('vote_date, vote_subject, td_vote, vote_outcome, voted_with_party, vote_category, is_rebel_vote')
    .eq('td_id', td.id)
    .eq('is_rebel_vote', true)
    .order('vote_date', { ascending: false })
    .limit(limit);

  if (error) {
    return [];
  }

  return enrichVotesWithDescriptions(votes || []);
}

/**
 * Get voting record by category (housing, health, economy, etc.)
 */
export async function getVotesByCategory(
  politicianName: string,
  category: string,
  limit = 10
): Promise<VoteRecord[]> {
  return getVotingRecord(politicianName, category, limit, { category });
}

/**
 * Get voting statistics for a politician
 */
export async function getVotingStats(politicianName: string): Promise<{
  totalVotes: number;
  taVotes: number;
  nilVotes: number;
  staonVotes: number;
  partyLoyaltyRate: number;
  rebelVotes: number;
  votesByCategory: Record<string, number>;
} | null> {
  if (!supabaseDb) throw new Error('Supabase client not initialized');

  // 1. Get Politician ID
  const { data: td, error: tdError } = await supabaseDb
    .from('td_scores')
    .select('id')
    .ilike('politician_name', politicianName)
    .single();

  if (tdError || !td) {
    return null;
  }

  // 2. Get all votes with category and rebel info
  const { data: votes, error } = await supabaseDb
    .from('td_votes')
    .select('td_vote, voted_with_party, vote_category, is_rebel_vote')
    .eq('td_id', td.id);

  if (error || !votes) {
    return null;
  }

  const totalVotes = votes.length;
  const taVotes = votes.filter(v => v.td_vote === 'ta').length;
  const nilVotes = votes.filter(v => v.td_vote === 'nil').length;
  const staonVotes = votes.filter(v => v.td_vote === 'staon').length;
  const rebelVotes = votes.filter(v => v.is_rebel_vote === true).length;
  
  // Calculate votes by category
  const votesByCategory: Record<string, number> = {};
  for (const v of votes) {
    const cat = v.vote_category || 'other';
    votesByCategory[cat] = (votesByCategory[cat] || 0) + 1;
  }
  
  const votesWithPartyData = votes.filter(v => v.voted_with_party !== null);
  const loyalVotes = votesWithPartyData.filter(v => v.voted_with_party === true).length;
  const partyLoyaltyRate = votesWithPartyData.length > 0 
    ? (loyalVotes / votesWithPartyData.length) * 100 
    : 0;

  return {
    totalVotes,
    taVotes,
    nilVotes,
    staonVotes,
    partyLoyaltyRate: Math.round(partyLoyaltyRate * 10) / 10,
    rebelVotes,
    votesByCategory
  };
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


