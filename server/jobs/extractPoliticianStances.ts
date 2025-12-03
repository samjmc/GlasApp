/**
 * Politician Stance Extraction Job
 * 
 * Extracts structured policy positions from debate chunks using LLM analysis.
 * Populates the `policy_positions` table for the Politician Clone feature.
 * 
 * Usage:
 *   npx tsx server/jobs/extractPoliticianStances.ts [--limit N] [--politician "Name"]
 * 
 * Options:
 *   --limit N          Process top N politicians (default: 10)
 *   --politician "X"   Process only a specific politician
 *   --all              Process ALL politicians (expensive!)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getOpenAIClient } from '../services/openaiService';

// Initialize a fresh Supabase client locally to avoid any potential config issues
// with the shared client (e.g. custom fetch agents on Windows)
const supabaseDb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Parse CLI args
const args = process.argv.slice(2);
const limitArg = args.indexOf('--limit');
const politicianArg = args.indexOf('--politician');
const processAll = args.includes('--all');

const POLITICIAN_LIMIT = processAll ? 999 : (limitArg !== -1 ? parseInt(args[limitArg + 1]) || 10 : 10);
const SPECIFIC_POLITICIAN = politicianArg !== -1 ? args[politicianArg + 1] : null;

async function extractPoliticianStances() {
  if (!supabaseDb) {
    console.error('❌ Supabase client not available');
    process.exit(1);
  }

  const startTime = Date.now();
  console.log('\n' + '═'.repeat(70));
  console.log('🧠 POLITICIAN STANCE EXTRACTION JOB');
  console.log(`📅 ${new Date().toLocaleString('en-IE')}`);
  console.log('═'.repeat(70));
  console.log(`Mode: ${SPECIFIC_POLITICIAN ? `Single politician: ${SPECIFIC_POLITICIAN}` : `Top ${POLITICIAN_LIMIT} by activity`}`);
  console.log('═'.repeat(70) + '\n');

  // 1. Get list of politicians
  let query = supabaseDb
    .from('td_scores')
    .select('id, politician_name, party')
    .eq('is_active', true)
    .order('total_stories', { ascending: false });

  if (SPECIFIC_POLITICIAN) {
    query = query.ilike('politician_name', `%${SPECIFIC_POLITICIAN}%`);
  } else {
    query = query.limit(POLITICIAN_LIMIT);
  }

  const { data: politicians, error: tdError } = await query;

  if (tdError) {
    console.error('Error fetching politicians:', tdError);
    return;
  }

  console.log(`Processing ${politicians.length} politicians...`);

  for (const [index, politician] of politicians.entries()) {
    console.log(`\n[${index + 1}/${politicians.length}] Processing ${politician.politician_name}...`);
    await processPolitician(politician);
    // Add a small delay to avoid hitting rate limits too hard
    if (index < politicians.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('✅ Extraction complete.');
}

async function processPolitician(politician: any) {
  // 2. Fetch recent debate chunks using a stratified sampling approach
  // Instead of just the last 60, we want to cover the last 12 months to detect evolution
  
  // 1. Fast Check: Do they have ANY chunks?
  const { count, error: countError } = await supabaseDb!
    .from('debate_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('politician_name', politician.politician_name);

  if (countError) {
    console.error(`   ❌ Error checking chunks for ${politician.politician_name}:`, countError.message);
    return;
  }

  if (count === null || count === 0) {
     console.log(`   ⚠️ Not enough debate data (0 chunks). Skipping.`);
     return;
  }

  // 2. Get Date Range (Safe fallback if sorting fails)
  // Try to get min/max date. If sorting by date fails/times out, we'll just grab a sample.
  let minDate = Date.now();
  let maxDate = 0;

  try {
      const { data: dateSample } = await supabaseDb!
        .from('debate_chunks')
        .select('date')
        .eq('politician_name', politician.politician_name)
        .limit(100); // Grab a sample of 100 chunks
        
      if (dateSample && dateSample.length > 0) {
          const dates = dateSample.map(d => new Date(d.date).getTime()).filter(t => !isNaN(t));
          if (dates.length > 0) {
              minDate = Math.min(...dates);
              maxDate = Math.max(...dates);
          }
      }
  } catch (err) {
      console.log(`   ⚠️ Date range check failed, assuming generic range.`);
      // Fallback defaults if date query fails
      minDate = new Date('2020-01-01').getTime();
      maxDate = Date.now();
  }
  const oneMonth = 1000 * 60 * 60 * 24 * 30;
  
  // If history is short (< 3 months), just take all/most recent
  let chunks: any[] = [];
  
  if ((maxDate - minDate) < (3 * oneMonth)) {
    const { data } = await supabaseDb!
      .from('debate_chunks')
      .select('id, chunk_content, date, topic')
      .eq('politician_name', politician.politician_name)
      .order('date', { ascending: false })
      .limit(60);
    chunks = data || [];
  } else {
    // Stratified sampling: Get chunks from different quarters
    // 1. Recent (last 3 months) - Heavy weight (30 chunks)
    // 2. Mid-term (3-12 months ago) - Medium weight (20 chunks)
    // 3. Old (12+ months ago) - Light weight (10 chunks)
    
    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - (3 * oneMonth)).toISOString();
    const twelveMonthsAgo = new Date(now.getTime() - (12 * oneMonth)).toISOString();
    
    const [recent, midTerm, old] = await Promise.all([
      supabaseDb!.from('debate_chunks')
        .select('id, chunk_content, date, topic')
        .eq('politician_name', politician.politician_name)
        .gte('date', threeMonthsAgo)
        .order('date', { ascending: false })
        .limit(30),
      
      supabaseDb!.from('debate_chunks')
        .select('id, chunk_content, date, topic')
        .eq('politician_name', politician.politician_name)
        .lt('date', threeMonthsAgo)
        .gte('date', twelveMonthsAgo)
        .order('date', { ascending: false }) // Gets the "newest" of the old stuff
        .limit(20),
        
      supabaseDb!.from('debate_chunks')
        .select('id, chunk_content, date, topic')
        .eq('politician_name', politician.politician_name)
        .lt('date', twelveMonthsAgo)
        .order('date', { ascending: false })
        .limit(10)
    ]);
    
    chunks = [
      ...(recent.data || []),
      ...(midTerm.data || []), // Spread to get temporal coverage
      ...(old.data || [])
    ];
    
    // If we didn't fill our quota from history, fill up with more recent stuff
    if (chunks.length < 40) {
       const { data: fill } = await supabaseDb!
        .from('debate_chunks')
        .select('id, chunk_content, date, topic')
        .eq('politician_name', politician.politician_name)
        .order('date', { ascending: false })
        .limit(60);
       chunks = fill || [];
    }
  }

  // Remove duplicates (just in case)
  chunks = chunks.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

  if (chunks.length < 5) {
    console.log(`   ⚠️ Not enough debate data after filtering (${chunks.length} chunks). Skipping.`);
    return;
  }

  // 3. Prepare Prompt
  // We group chunks by date to help the LLM see the timeline
  const sortedChunks = [...chunks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const contextText = sortedChunks.map(c => `ID: ${c.id}\nDate: ${c.date}\nTopic: ${c.topic || 'General'}\nText: "${c.chunk_content.substring(0, 600)}..."`).join('\n\n---\n\n');

  const prompt = `
    You are a political analyst building a "Belief Graph" for ${politician.politician_name} (${politician.party}).
    Analyze their debate transcripts chronologically to identify core policy positions and consistency.
    
    CRITICAL: You are provided with records spanning from ${sortedChunks[0].date} to ${sortedChunks[sortedChunks.length-1].date}.
    Look specifically for contradictions or shifts in stance over this period.

    Input Transcripts (Chronological):
    ${contextText}

    Task:
    Extract 4-8 distinct policy positions.
    For each position, analyze if they have been consistent or if their stance has evolved.

    Definitions:
    - "stable": Consistent view over the time period.
    - "hardening": Becoming more strict/firm on the issue over time.
    - "softening": Becoming less strict/more compromising over time.
    - "reversal": A clear contradiction or 180-degree turn on a previous position.
    - "new": Only appears in very recent records (< 3 months).

    Return JSON format:
    {
      "positions": [
        {
          "topic": "Housing",
          "position_summary": "Consistently argues for state-led construction over private developers.",
          "strength": 0.9,
          "trend": "stable",
          "supporting_chunk_ids": ["uuid-1", "uuid-2"]
        }
      ]
    }
  `;

  try {
    // 4. Call LLM
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a precise political data extractor. Output valid JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.0,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No content from LLM");

    const result = JSON.parse(content);
    const positions = result.positions || [];

    console.log(`   ✨ Identified ${positions.length} positions.`);

    // 5. Upsert into policy_positions
    for (const pos of positions) {
      // Clean up IDs (ensure they exist in our list)
      const validIds = pos.supporting_chunk_ids.filter((id: string) => chunks.some(c => c.id === id));
      
      // Calculate time span from the supporting chunks
      const supportingChunks = chunks.filter(c => validIds.includes(c.id));
      const dates = supportingChunks.map(c => new Date(c.date).getTime()).filter(d => !isNaN(d));
      const minDate = dates.length ? new Date(Math.min(...dates)).toISOString() : null;
      const maxDate = dates.length ? new Date(Math.max(...dates)).toISOString() : null;

      const payload = {
        politician_id: politician.id,
        topic: pos.topic,
        position_summary: pos.position_summary,
        strength: pos.strength,
        trend: pos.trend,
        key_quote_ids: validIds,
        time_span_start: minDate,
        time_span_end: maxDate,
        updated_at: new Date().toISOString()
      };

      const { error: upsertError } = await supabaseDb!
        .from('policy_positions')
        .upsert(payload, { onConflict: 'politician_id,topic' });

      if (upsertError) {
        console.error(`   ❌ Error saving ${pos.topic}:`, upsertError.message);
      } else {
        console.log(`   💾 Saved: ${pos.topic} (${pos.trend})`);
      }
    }

  } catch (err) {
    console.error(`   ❌ LLM/Processing Error:`, err);
  }
}

extractPoliticianStances().catch(console.error);
