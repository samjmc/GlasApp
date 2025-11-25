import { Router, Request, Response } from 'express';
import { z } from 'zod';
import OpenAI from 'openai';
import { supabaseDb } from '../db';
import { generateEmbedding } from '../services/openaiService';

const router = Router();

// Initialize OpenAI client lazily
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required but not set.');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

const chatRequestSchema = z.object({
  politicianName: z.string().min(1),
  question: z.string().min(1).max(500),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string()
    })
  ).optional()
});

/**
 * POST /api/chat/politician
 * Chat with a "Digital Twin" of a politician based on their debate record
 */
router.post('/politician', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    const validated = chatRequestSchema.parse(req.body);
    const { politicianName, question, history = [] } = validated;

    // 1. Generate embedding for the user's question
    console.log(`[Chat] Generating embedding for question: "${question.substring(0, 50)}..."`);
    const questionEmbedding = await generateEmbedding(question);
    console.log(`[Chat] Generated embedding with ${questionEmbedding.length} dimensions`);

    // 2. Search for relevant debate chunks using VECTOR SIMILARITY (semantic search)
    console.log(`[Chat] Searching for chunks for politician: "${politicianName}" using vector search`);
    
    let chunks: any[] = [];
    let searchError: any = null;
    
    // Convert embedding array to PostgreSQL vector format string
    const embeddingString = `[${questionEmbedding.join(',')}]`;
    
    // Use pgvector semantic search via RPC function
    try {
      const { data, error } = await supabaseDb.rpc('match_debate_chunks_text', {
        query_embedding_text: embeddingString,
        match_politician: politicianName,
        match_threshold: 0.3, // Lower threshold to find more semantic matches
        match_count: 20
      });
      
      if (error) {
        console.error('[Chat] Vector search RPC error:', error);
        searchError = error;
      } else if (data && data.length > 0) {
        chunks = data;
        console.log(`[Chat] Vector search found ${chunks.length} chunks with similarities: ${chunks.map((c: any) => c.similarity?.toFixed(3)).join(', ')}`);
      }
    } catch (rpcError) {
      console.error('[Chat] Vector search exception:', rpcError);
      searchError = rpcError;
    }
    
    // Fallback to keyword search if vector search fails or returns nothing
    if (chunks.length === 0) {
      console.log('[Chat] Vector search returned no results, trying keyword fallback...');
      
      // Extract key terms for fallback
      const stopWords = ['what', 'your', 'about', 'have', 'been', 'with', 'this', 'that', 'from', 
        'they', 'will', 'would', 'could', 'should', 'there', 'their', 'position', 'views', 'think',
        'changed', 'over', 'time', 'stance', 'opinion', 'feel', 'believe', 'how', 'does', 'when'];
      
      const keyTerms = question.toLowerCase()
        .replace(/[?.,!'"]/g, '')
        .split(' ')
        .filter(word => word.length > 3 && !stopWords.includes(word));
      
      for (const searchTerm of keyTerms) {
        const { data, error } = await supabaseDb
          .from('debate_chunks')
          .select('id, politician_name, chunk_content, date')
          .ilike('politician_name', `%${politicianName}%`)
          .ilike('chunk_content', `%${searchTerm}%`)
          .order('date', { ascending: false })
          .limit(15);
        
        if (data && data.length > 0) {
          chunks = data.map((chunk: any) => ({
            ...chunk,
            similarity: 0.6 // Assign reasonable similarity for keyword matches
          }));
          console.log(`[Chat] Keyword fallback found ${chunks.length} chunks for term: ${searchTerm}`);
          break;
        }
        if (error) searchError = error;
      }
    }
    
    // DO NOT fall back to showing unrelated content - this causes misleading responses

    console.log(`[Chat] Search returned: ${chunks?.length || 0} chunks, error: ${searchError ? JSON.stringify(searchError) : 'none'}`);
    
    if (searchError) {
      console.error('Vector search error:', searchError);
      // Log details for debugging
      console.error('Search params:', { politicianName, threshold: 0.3, count: 15 });
    }

    // 3. Build context from retrieved chunks
    let context = '';
    const citations: Array<{ date: string; content: string }> = [];
    let hasRelevantContent = false;
    let positionEvolution = '';

    if (chunks && chunks.length > 0) {
      // Use top chunks, prioritizing higher similarity but accepting lower scores
      // Sort by similarity descending and take best matches
      const sortedBySimilarity = [...chunks].sort((a: any, b: any) => b.similarity - a.similarity);
      // Take top 8 chunks that have at least 0.35 similarity
      const relevantChunks = sortedBySimilarity
        .filter((c: any) => c.similarity > 0.35)
        .slice(0, 8);
      
      if (relevantChunks.length > 0) {
        hasRelevantContent = true;
        
        // Sort chronologically (oldest first) to show evolution of position
        const sortedChunks = [...relevantChunks].sort((a: any, b: any) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateA - dateB;
        });
        
        // Check if chunks span a significant time period (more than 6 months)
        const dates = sortedChunks
          .filter((c: any) => c.date)
          .map((c: any) => new Date(c.date).getTime());
        
        if (dates.length >= 2) {
          const timeSpanMonths = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24 * 30);
          if (timeSpanMonths > 6) {
            positionEvolution = `\n⚠️ TIME SPAN NOTICE: These records span ${Math.round(timeSpanMonths)} months. The politician's position may have evolved over time. Always note the dates and highlight if their stance appears to have changed.\n`;
          }
        }
        
        for (const chunk of sortedChunks) {
          const dateStr = chunk.date ? new Date(chunk.date).toLocaleDateString('en-IE') : 'Unknown date';
          context += `[${dateStr}]: "${chunk.chunk_content}"\n\n`;
          citations.push({
            date: dateStr,
            content: chunk.chunk_content.substring(0, 200) + '...'
          });
        }
      }
    }
    
    if (!hasRelevantContent) {
      // No relevant chunks found - be explicit about this
      context = 'NO RELEVANT DEBATE RECORDS FOUND FOR THIS TOPIC.';
      console.log(`[Chat] No relevant chunks found for "${politicianName}" on question: "${question}"`);
      console.log(`[Chat] Raw chunks returned: ${chunks?.length || 0}, Similarities: ${chunks?.map((c: any) => c.similarity?.toFixed(3)).join(', ') || 'none'}`);
    } else {
      console.log(`[Chat] Found ${citations.length} relevant chunks for "${politicianName}"`);
    }

    // 4. Build the system prompt
    console.log(`[Chat] Building prompt with context length: ${context.length} chars, hasRelevantContent: ${hasRelevantContent}`);
    
    const systemPrompt = `You are an AI representation of ${politicianName}, an Irish politician.
Your responses must be based on the debate transcripts provided below.

CRITICAL RULES:
1. Use the information from the provided context to answer questions. The context contains REAL quotes from parliamentary debates.
2. ONLY say "I don't have records" if the context explicitly says "NO RELEVANT DEBATE RECORDS FOUND". If there IS context below, USE IT to answer.
3. Speak in first person as if you are ${politicianName}.
4. Reference specific dates when quoting from the context to add credibility.
5. Keep responses conversational but informative.
6. If the debate records span multiple years and show DIFFERENT positions, acknowledge this:
   - "My position on this has evolved over time..."
   - Present positions chronologically with dates
   - State your MOST RECENT position as current stance
7. Be transparent about any contradictions in the record.

SPECIAL COMMANDS:
- "Show me contradictions" or "Have you flip-flopped?" → List any contradictory statements with dates
- "Timeline of your stance on [topic]" → Chronological bullet-point list with dates
- "What have you changed your mind on?" → List any evolved positions honestly

IMPORTANT: The context below contains REAL parliamentary debate quotes. Always use them to form your response unless the context says "NO RELEVANT DEBATE RECORDS FOUND".
${positionEvolution}
=== PARLIAMENTARY DEBATE RECORDS ===
${context}
=== END OF RECORDS ===`;

    // 5. Build conversation messages
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user', content: question }
    ];

    // 6. Call OpenAI
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini', // Cheaper model for this use case
      messages,
      max_tokens: 500,
      temperature: 0.7
    });

    const reply = response.choices[0].message.content ||
      "I'm sorry, I couldn't generate a response at this time.";

    // 7. Return response with citations
    return res.json({
      success: true,
      reply,
      citations: citations.slice(0, 3), // Top 3 most relevant sources
      disclaimer: `This is an AI-generated response based on ${politicianName}'s public parliamentary debate records. It is not a direct quote or official statement.`
    });

  } catch (error) {
    console.error('Politician chat error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        details: error.errors
      });
    }

    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/chat/politician/:name/consistency
 * Get consistency scores and flip-flops for a politician
 */
router.get('/politician/:name/consistency', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({ success: false, message: 'Database not available' });
    }

    const { name } = req.params;

    // Get consistency scores by topic
    const { data: scores, error: scoresError } = await supabaseDb.rpc(
      'get_politician_consistency_score',
      { p_name: name }
    );

    if (scoresError) {
      console.error('Consistency score error:', scoresError);
    }

    // Get recent position changes
    const { data: changes, error: changesError } = await supabaseDb
      .from('politician_stances')
      .select('topic, stance, previous_stance, stance_summary, statement_date')
      .ilike('politician_name', `%${name}%`)
      .eq('is_position_change', true)
      .order('statement_date', { ascending: false })
      .limit(10);

    if (changesError) {
      console.error('Position changes error:', changesError);
    }

    // Calculate overall consistency
    const overallScore = scores && scores.length > 0
      ? scores.reduce((sum: number, s: any) => sum + s.consistency_score, 0) / scores.length
      : null;

    return res.json({
      success: true,
      politician: name,
      overallConsistencyScore: overallScore ? Math.round(overallScore * 100) : null,
      topicScores: scores || [],
      recentPositionChanges: changes || [],
      message: overallScore 
        ? `${name} has a ${Math.round(overallScore * 100)}% consistency score across tracked topics.`
        : `No stance data available yet for ${name}.`
    });

  } catch (error) {
    console.error('Consistency check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get consistency data'
    });
  }
});

/**
 * GET /api/chat/politician/:name/stances
 * Get all extracted stances for a politician, grouped by topic
 */
router.get('/politician/:name/stances', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({ success: false, message: 'Database not available' });
    }

    const { name } = req.params;
    const { topic } = req.query;

    let query = supabaseDb
      .from('politician_stances')
      .select('topic, stance, stance_summary, statement_date, is_position_change, confidence')
      .ilike('politician_name', `%${name}%`)
      .order('statement_date', { ascending: true });

    if (topic) {
      query = query.eq('topic', topic);
    }

    const { data: stances, error } = await query;

    if (error) {
      throw error;
    }

    // Group by topic for easier consumption
    const byTopic: Record<string, any[]> = {};
    for (const stance of stances || []) {
      if (!byTopic[stance.topic]) {
        byTopic[stance.topic] = [];
      }
      byTopic[stance.topic].push(stance);
    }

    return res.json({
      success: true,
      politician: name,
      stances: byTopic,
      totalStances: stances?.length || 0,
      topicsTracked: Object.keys(byTopic).length
    });

  } catch (error) {
    console.error('Stances fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get stance data'
    });
  }
});

/**
 * GET /api/chat/politician/:name/available
 * Check if a politician has enough debate data for chat
 */
router.get('/politician/:name/available', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({ success: false, available: false });
    }

    const { name } = req.params;

    const { count, error } = await supabaseDb
      .from('debate_chunks')
      .select('*', { count: 'exact', head: true })
      .ilike('politician_name', `%${name}%`);

    if (error) {
      throw error;
    }

    const chunkCount = count || 0;
    const available = chunkCount >= 10; // Minimum 10 chunks for meaningful chat

    return res.json({
      success: true,
      available,
      chunkCount,
      message: available
        ? `${name} has ${chunkCount} debate records available for chat.`
        : `${name} doesn't have enough debate records yet. We need at least 10 chunks.`
    });

  } catch (error) {
    console.error('Availability check error:', error);
    return res.status(500).json({
      success: false,
      available: false,
      message: 'Failed to check availability'
    });
  }
});

export default router;

