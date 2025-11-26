/**
 * Debate Admin Routes
 * Endpoints for triggering debate scoring pipelines
 */

import { Router } from 'express';
import { spawn } from 'child_process';
import { supabaseDb } from '../../db';
import { getOpenAIClient } from '../../services/openaiService';

const router = Router();

/**
 * POST /api/admin/debates/pipeline - Trigger the full debate scoring pipeline
 */
router.post('/pipeline', async (req, res, next) => {
  try {
    console.log('🚀 Triggering debate scoring pipeline...');
    
    // Run in background
    const pipelineProcess = spawn('npm', ['run', 'debates:pipeline'], {
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    pipelineProcess.on('error', (error) => {
      console.error('❌ Failed to start debate pipeline:', error);
    });

    pipelineProcess.on('exit', (code) => {
      if (code === 0) {
        console.log('✅ Debate pipeline completed successfully');
      } else {
        console.error(`❌ Debate pipeline exited with code ${code}`);
      }
    });
    
    res.json({
      success: true,
      message: 'Debate scoring pipeline started in background',
      estimated_duration: '15-30 minutes',
      note: 'Check server logs for progress'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/debates/extract-stances - Extract policy positions for Politician Clone
 * 
 * Query params:
 *   limit: number of politicians to process (default: 10)
 *   politician: specific politician name to process
 */
router.post('/extract-stances', async (req, res, next) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({ success: false, message: 'Database not available' });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const specificPolitician = req.query.politician as string | undefined;

    console.log(`🧠 Stance extraction triggered (limit: ${limit}, politician: ${specificPolitician || 'all'})`);

    // Run extraction in background
    extractStancesBackground(limit, specificPolitician);

    res.json({
      success: true,
      message: 'Stance extraction started in background',
      params: { limit, politician: specificPolitician || 'top by activity' },
      estimated_duration: `${limit * 2}-${limit * 5} minutes`,
      note: 'Extracts policy positions from debate chunks using LLM'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/debates/stance-stats - Get stance extraction statistics
 */
router.get('/stance-stats', async (req, res, next) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({ success: false, message: 'Database not available' });
    }

    // Get stats
    const { data: stats } = await supabaseDb
      .from('policy_positions')
      .select('politician_id, topic, updated_at')
      .order('updated_at', { ascending: false });

    const politicianCount = new Set(stats?.map(s => s.politician_id) || []).size;
    const topicCounts: Record<string, number> = {};
    stats?.forEach(s => {
      topicCounts[s.topic] = (topicCounts[s.topic] || 0) + 1;
    });

    const lastUpdate = stats?.[0]?.updated_at;

    res.json({
      success: true,
      stats: {
        total_positions: stats?.length || 0,
        politicians_covered: politicianCount,
        topics: topicCounts,
        last_extraction: lastUpdate
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/debates/review-feedback - Trigger self-correction for negative feedback
 */
router.post('/review-feedback', async (req, res, next) => {
  try {
    console.log('🕵️ Triggering negative feedback review...');
    
    // Run in background
    const reviewProcess = spawn('npx', ['tsx', 'server/jobs/reviewNegativeFeedback.ts'], {
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    reviewProcess.on('error', (error) => {
      console.error('❌ Failed to start feedback review:', error);
    });
    
    res.json({
      success: true,
      message: 'Feedback review started in background',
      estimated_duration: '1-5 minutes',
      note: 'Analyzes downvoted answers and flags policy positions for review'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Background stance extraction (non-blocking)
 */
async function extractStancesBackground(limit: number, specificPolitician?: string) {
  try {
    console.log('🧠 Starting background stance extraction...');

    // Get politicians
    let query = supabaseDb!
      .from('td_scores')
      .select('id, politician_name, party')
      .eq('is_active', true)
      .order('total_stories', { ascending: false });

    if (specificPolitician) {
      query = query.ilike('politician_name', `%${specificPolitician}%`);
    } else {
      query = query.limit(limit);
    }

    const { data: politicians, error: tdError } = await query;

    if (tdError || !politicians) {
      console.error('❌ Failed to fetch politicians:', tdError);
      return;
    }

    console.log(`Processing ${politicians.length} politicians...`);

    for (const politician of politicians) {
      await processPoliticianStances(politician);
    }

    console.log('✅ Stance extraction complete');

  } catch (error) {
    console.error('❌ Stance extraction failed:', error);
  }
}

async function processPoliticianStances(politician: { id: number; politician_name: string; party: string }) {
  console.log(`\n🔎 Analyzing ${politician.politician_name}...`);

  const { data: chunks } = await supabaseDb!
    .from('debate_chunks')
    .select('id, chunk_content, date, topic')
    .eq('politician_name', politician.politician_name)
    .order('date', { ascending: false })
    .limit(30);

  if (!chunks || chunks.length < 5) {
    console.log(`   ⚠️ Not enough data (${chunks?.length || 0} chunks)`);
    return;
  }

  const contextText = chunks.map(c => 
    `ID: ${c.id}\nDate: ${c.date}\nText: "${c.chunk_content.substring(0, 800)}..."`
  ).join('\n\n---\n\n');

  const prompt = `
    Extract 3-6 policy positions for ${politician.politician_name} (${politician.party}) from these debate transcripts.
    
    ${contextText}
    
    Return JSON: { "positions": [{ "topic": "Housing", "position_summary": "...", "strength": 0.9, "trend": "stable", "supporting_chunk_ids": ["uuid"] }] }
  `;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Extract policy positions. Output valid JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.0,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    const positions = result.positions || [];

    console.log(`   ✨ Found ${positions.length} positions`);

    for (const pos of positions) {
      const validIds = pos.supporting_chunk_ids?.filter((id: string) => 
        chunks.some(c => c.id === id)
      ) || [];

      await supabaseDb!
        .from('policy_positions')
        .upsert({
          politician_id: politician.id,
          topic: pos.topic,
          position_summary: pos.position_summary,
          strength: pos.strength,
          trend: pos.trend,
          key_quote_ids: validIds,
          updated_at: new Date().toISOString()
        }, { onConflict: 'politician_id,topic' });

      console.log(`   💾 ${pos.topic}`);
    }

  } catch (err) {
    console.error(`   ❌ Error:`, err);
  }
}

export default router;

