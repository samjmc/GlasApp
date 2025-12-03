
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import 'dotenv/config';

// Configuration
const TOPICS = [
  'Housing', 
  'Health', 
  'Cost of Living', 
  'Environment', 
  'Immigration', 
  'Education', 
  'Justice', 
  'Foreign Affairs',
  'Northern Ireland',
  'European Union'
];

// Batch size control
const POLITICIANS_LIMIT = 20; // Process top 20

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

async function main() {
  console.log('🚀 Starting Structured Memory Population...');

  // 1. Fetch Politicians (Top 20 by rank/elo)
  const { data: politicians, error } = await supabase
    .from('td_scores')
    .select('id, politician_name, party')
    .order('national_rank', { ascending: true })
    .limit(POLITICIANS_LIMIT);

  if (error || !politicians) {
    console.error('❌ Error fetching politicians:', error);
    return;
  }

  console.log(`Found ${politicians.length} politicians to process.`);

  for (const td of politicians) {
    console.log(`\n👤 Processing: ${td.politician_name} (${td.party})`);

    for (const topic of TOPICS) {
      // Check if profile already exists
      const { data: existing } = await supabase
        .from('policy_positions')
        .select('id')
        .eq('politician_id', td.id)
        .eq('topic', topic)
        .single();

      if (existing) {
        console.log(`   - ${topic}: Already exists (Skipping)`);
        continue;
      }

      // 2. Find relevant chunks
      const topicEmbedding = await generateEmbedding(topic);
      
      const { data: chunks, error: searchError } = await supabase.rpc('match_debate_chunks', {
        query_embedding: topicEmbedding,
        match_politician: td.politician_name,
        match_threshold: 0.45, // slightly lower to ensure we get data
        match_count: 15
      });

      if (searchError) {
        console.error(`   ❌ Search error for ${topic}:`, searchError);
        continue;
      }

      if (!chunks || chunks.length < 3) {
        console.log(`   - ${topic}: Insufficient data (${chunks?.length || 0} chunks)`);
        continue;
      }

      console.log(`   - ${topic}: Analyzing ${chunks.length} chunks...`);

      // 3. Generate Profile
      const prompt = `
      Analyze these debate excerpts for politician ${td.politician_name} regarding "${topic}".
      
      Excerpts:
      ${chunks.map((c: any, i: number) => `[${i}] "${c.chunk_content.substring(0, 300)}..."`).join('\n')}
      
      Task:
      1. Summarize their policy position on ${topic} in 2-3 clear sentences. Be substantive (mention specific bills/actions if present).
      2. Determine position strength (0.0 to 1.0, where 1.0 is extremely passionate/active).
      3. Determine trend (hardening, softening, stable, new, unknown).
      4. Identify which quotes (indices) best support this summary (max 3).
      
      Output JSON:
      {
        "summary": "string",
        "strength": number,
        "trend": "string",
        "key_quote_indices": [number]
      }
      `;

      try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content || '{}');
        
        if (result.summary) {
            // Map indices back to UUIDs
            const quoteIds = (result.key_quote_indices || []).map((idx: number) => chunks[idx]?.id).filter(Boolean);
            
            // Ensure strength is 0-1
            let strength = result.strength;
            if (strength > 1) strength = strength / 10;
            if (strength > 1) strength = 1; // clamp
            
            // Ensure trend is valid
            const trend = (result.trend || 'unknown').toLowerCase();

            // 4. Insert Profile
            const { error: insertError } = await supabase
            .from('policy_positions')
            .insert({
                politician_id: td.id,
                topic: topic,
                position_summary: result.summary,
                strength: strength,
                trend: trend,
                key_quote_ids: quoteIds,
                updated_at: new Date().toISOString()
            });

            if (insertError) {
                console.error(`   ❌ Insert failed:`, insertError);
            } else {
                console.log(`   ✅ Profile generated: "${result.summary.substring(0, 50)}..."`);
            }
        }
      } catch (err) {
          console.error(`   ❌ LLM/Parsing error:`, err);
      }
      
      // Rate limit safety
      await new Promise(r => setTimeout(r, 200));
    }
  }
}

main();
