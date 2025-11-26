import { Router, Request, Response } from 'express';
import { z } from 'zod';
import OpenAI from 'openai';
import { supabaseDb } from '../db';
import { generateEmbedding } from '../services/openaiService';
import { getPolicyPositions } from '../services/politicianAgent';

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
      // Clean up the embedding string format
      const embeddingString = `[${questionEmbedding.join(',')}]`;
      
      const { data, error } = await supabaseDb.rpc('match_debate_chunks_text', {
        query_embedding_text: embeddingString,
        match_politician: politicianName,
        match_threshold: 0.2, // Relaxed threshold (0.3 -> 0.2)
        match_count: 30 // Increased from 20 to get more candidates
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
      
      // Search using OR logic for better recall
      if (keyTerms.length > 0) {
        let query = supabaseDb
          .from('debate_chunks')
          .select('id, politician_name, chunk_content, date')
          .ilike('politician_name', `%${politicianName}%`)
          .order('date', { ascending: false })
          .limit(20);

        // Construct OR filter for content
        const orFilter = keyTerms.map(term => `chunk_content.ilike.%${term}%`).join(',');
        if (orFilter) {
          query = query.or(orFilter);
        }

        const { data, error } = await query;
        
        if (data && data.length > 0) {
          chunks = data.map((chunk: any) => ({
            ...chunk,
            similarity: 0.5 // Assign default relevance for keyword matches
          }));
          console.log(`[Chat] Keyword fallback found ${chunks.length} chunks`);
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

    // 3.5 Fetch Structured Policy Positions (The "Belief Graph")
    console.log(`[Chat] Fetching structured policy positions for "${politicianName}"`);
    const policyPositions = await getPolicyPositions(politicianName);
    let structuredMemoryContext = '';
    
    if (policyPositions && policyPositions.length > 0) {
      structuredMemoryContext = '\n=== KNOWN POLICY POSITIONS (STRUCTURED MEMORY) ===\n';
      structuredMemoryContext += 'Use these core beliefs as the "skeleton" of your answer, then use the debate records below to add specific quotes and nuance.\n\n';
      
      // Group by topic
      const byTopic: Record<string, any[]> = {};
      policyPositions.forEach((p: any) => {
        if (!byTopic[p.topic]) byTopic[p.topic] = [];
        byTopic[p.topic].push(p);
      });
      
      for (const [topic, positions] of Object.entries(byTopic)) {
        structuredMemoryContext += `TOPIC: ${topic}\n`;
        (positions as any[]).forEach(p => {
          structuredMemoryContext += `- ${p.position_summary} (Strength: ${p.strength}, Trend: ${p.trend})\n`;
        });
        structuredMemoryContext += '\n';
      }
      structuredMemoryContext += '=== END OF STRUCTURED MEMORY ===\n\n';
    } else {
      console.log(`[Chat] No structured policy positions found for "${politicianName}"`);
    }

    // 4. Build the system prompt
    console.log(`[Chat] Building prompt with context length: ${context.length} chars, hasRelevantContent: ${hasRelevantContent}`);
    
    const systemPrompt = `You are an AI representation of ${politicianName}, an Irish politician.
Your responses must be based on the structured memory and debate transcripts provided below.

CRITICAL RULES:
1. Use the "Known Policy Positions" as the high-level summary of your views.
2. Use the "Parliamentary Debate Records" to find specific quotes, dates, and details to back up those views.
3. IF "Known Policy Positions" are missing for the topic, you MUST rely entirely on the "Parliamentary Debate Records".
4. NEVER say "I don't have records" if there are relevant quotes in the transcript section. Infer the position from the quotes.
5. Speak in first person as if you are ${politicianName}.
6. Reference specific dates when quoting from the context to add credibility.
7. Keep responses conversational but informative.
8. If the debate records span multiple years and show DIFFERENT positions, acknowledge this:
   - "My position on this has evolved over time..."
   - Present positions chronologically with dates
   - State your MOST RECENT position as current stance
9. Be transparent about any contradictions in the record.

SPECIAL COMMANDS:
- "Show me contradictions" or "Have you flip-flopped?" → List any contradictory statements with dates
- "Timeline of your stance on [topic]" → Chronological bullet-point list with dates
- "What have you changed your mind on?" → List any evolved positions honestly

IMPORTANT: The context below contains your belief graph and REAL parliamentary debate quotes. Always use them to form your response.
${structuredMemoryContext}
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

const feedbackSchema = z.object({
  politicianName: z.string().min(1),
  userQuestion: z.string().min(1),
  aiResponse: z.string().min(1),
  rating: z.enum(['positive', 'negative']),
  feedbackText: z.string().optional(),
  contextData: z.record(z.any()).optional()
});

/**
 * POST /api/chat/politician/feedback
 * Submit user feedback for a chat response
 */
router.post('/feedback', async (req: Request, res: Response) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({ success: false, message: 'Database not available' });
    }

    const validated = feedbackSchema.parse(req.body);
    
    const { error } = await supabaseDb
      .from('chat_feedback')
      .insert({
        politician_name: validated.politicianName,
        user_question: validated.userQuestion,
        ai_response: validated.aiResponse,
        rating: validated.rating,
        feedback_text: validated.feedbackText || null,
        context_data: validated.contextData || {}
      });

    if (error) {
      console.error('Error saving feedback:', error);
      throw error;
    }

    console.log(`[Feedback] Saved ${validated.rating} rating for ${validated.politicianName}`);

    return res.json({
      success: true,
      message: 'Feedback recorded'
    });

  } catch (error) {
    console.error('Feedback submission error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Invalid data' });
    }
    return res.status(500).json({ success: false, message: 'Failed to save feedback' });
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

    // Fetch positions from policy_positions (The Belief Graph)
    // We derive consistency from the 'trend' field
    const { data: positions, error: posError } = await supabaseDb
      .from('policy_positions')
      .select('topic, position_summary, trend, strength, updated_at, key_quote_ids, id')
      .eq('politician_id', (await getPoliticianId(name)))
      .order('updated_at', { ascending: false });

    if (posError) {
      console.error('Error fetching policy positions:', posError);
    }

    // Process positions into consistency scores
    const topicScores: any[] = [];
    let totalConsistency = 0;
    let scoredTopics = 0;

    (positions || []).forEach((pos: any) => {
      let baseScore = 0.5; // Default
      let positionChanges = 0;

      // 1. Base Score from Trend
      if (pos.trend === 'stable') {
        baseScore = 1.0;
      } else if (pos.trend === 'hardening' || pos.trend === 'softening') {
        baseScore = 0.8; // Pragmatic evolution
        positionChanges = 1;
      } else if (pos.trend === 'reversal') {
        baseScore = 0.0; // Flip-flop
        positionChanges = 2;
      } else if (pos.trend === 'new') {
        baseScore = 0.5;
      }

      // 2. Time Span Penalty (Crucial for "Rock Solid" claims)
      // Calculate days between first and last evidence
      const start = pos.time_span_start ? new Date(pos.time_span_start).getTime() : Date.now();
      const end = pos.time_span_end ? new Date(pos.time_span_end).getTime() : Date.now();
      const daysDiff = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));

      let timeWeight = 1.0;
      if (daysDiff < 30) {
        timeWeight = 0.5; // < 1 month of data = 50% confidence max
      } else if (daysDiff < 180) {
        timeWeight = 0.8; // < 6 months = 80% confidence max
      } else {
        timeWeight = 1.0; // > 6 months = Full confidence
      }

      // Final Topic Score
      const finalScore = baseScore * timeWeight;

      topicScores.push({
        topic: pos.topic,
        consistency_score: finalScore,
        total_statements: (pos.key_quote_ids || []).length,
        position_changes: positionChanges,
        history_days: Math.round(daysDiff)
      });

      totalConsistency += finalScore;
      scoredTopics++;
    });

    // Calculate overall (weighted by number of statements/history could be better, but average is fine for now)
    const overallScore = scoredTopics > 0 ? totalConsistency / scoredTopics : null;

    // Get recent "changes" (hardening/softening/reversal)
    const recentChanges = (positions || [])
      .filter((p: any) => ['hardening', 'softening', 'reversal'].includes(p.trend))
      .slice(0, 5)
      .map((p: any) => ({
        topic: p.topic,
        stance: p.position_summary,
        previous_stance: p.trend === 'reversal' ? 'Contradictory position' : (p.trend === 'hardening' ? 'Less strict' : 'Stricter'),
        stance_summary: p.trend === 'reversal' ? 'Major position reversal detected' : `Position appears to be ${p.trend}`,
        statement_date: p.updated_at
      }));

    return res.json({
      success: true,
      politician: name,
      overallConsistencyScore: overallScore ? Math.round(overallScore * 100) : null,
      topicScores: topicScores,
      recentPositionChanges: recentChanges,
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

async function getPoliticianId(name: string) {
  const { data } = await supabaseDb!
    .from('td_scores')
    .select('id')
    .eq('politician_name', name)
    .single();
  return data?.id;
}

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

    // Fetch from policy_positions (The Belief Graph)
    let query = supabaseDb
      .from('policy_positions')
      .select('topic, position_summary, trend, strength, updated_at, confidence_score')
      .eq('politician_id', (await getPoliticianId(name)))
      .order('updated_at', { ascending: false });

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
      // Map to frontend expected format
      byTopic[stance.topic].push({
        topic: stance.topic,
        stance: stance.trend === 'stable' ? 'Consistent' : stance.trend,
        stance_summary: stance.position_summary,
        statement_date: stance.updated_at,
        is_position_change: stance.trend === 'hardening' || stance.trend === 'softening',
        confidence: stance.confidence_score
      });
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

