/**
 * Extract Debates 2024-2025
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';
import { classifyQuestionTopic } from '../server/services/oireachtasAPIService.js';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000
});

async function extractDebates() {
  console.log('💭 EXTRACTING 2024-2025 DEBATES\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Load TDs
  const { data: tds } = await supabase
    .from('td_scores')
    .select('id, politician_name, member_code, member_uri');

  console.log(`✅ Loaded ${tds?.length} TDs`);

  const tdLookup = new Map<string, any>();
  const tdNameLookup = new Map<string, any>();
  
  tds?.forEach(td => {
    if (td.member_code) {
      tdLookup.set(`/ie/oireachtas/member/id/${td.member_code}`, td);
      tdLookup.set(`https://data.oireachtas.ie/ie/oireachtas/member/id/${td.member_code}`, td);
    }
    tdNameLookup.set(td.politician_name.toLowerCase(), td);
  });

  console.log(`✅ Created lookups\n`);

  // Fetch debates
  console.log('📥 Fetching debates...');
  const allDebates: any[] = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const response = await apiClient.get('/debates', {
      params: {
        chamber_type: 'house',
        chamber_id: 'https://data.oireachtas.ie/ie/oireachtas/house/dail/34',
        date_start: '2024-01-01',
        limit,
        skip
      }
    });

    const results = response.data.results || [];
    if (results.length === 0) break;

    allDebates.push(...results);
    console.log(`   Fetched ${allDebates.length} debates`);

    if (results.length < limit) break;
    skip += limit;
    if (skip > 2000) break;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ Total debates: ${allDebates.length}\n`);

  // Process debates
  console.log('🔗 Extracting speakers...');
  const debatesToInsert: any[] = [];

  for (const result of allDebates) {
    const debate = result.debateRecord; // Fixed: use debateRecord instead of debate
    const speakers = debate.debateSections?.flatMap((s: any) => 
      s.debateSection?.speeches?.map((sp: any) => sp.speech?.by) || []
    ) || [];

    const uniqueSpeakers = new Set(speakers.map((s: any) => s?.showAs));

    uniqueSpeakers.forEach(speakerName => {
      if (!speakerName) return;
      
      const td = tdNameLookup.get(speakerName.toLowerCase());
      
      if (td) {
        const topic = classifyQuestionTopic(debate.showAs || '', '');
        
        debatesToInsert.push({
          td_id: td.id,
          debate_id: `${debate.debateId || debate.uri?.split('/').pop()}-${td.id}`,
          debate_uri: debate.uri || '',
          debate_date: debate.date || '',
          subject: (debate.showAs || '').substring(0, 500),
          speaking_turns: 1,
          chamber: 'Dáil',
          ai_topic: topic
        });
      }
    });

    if (debatesToInsert.length % 100 === 0) {
      console.log(`   Progress: ${debatesToInsert.length} participations`);
    }
  }

  console.log(`\n✅ Matched ${debatesToInsert.length} debate participations\n`);

  // Batch insert
  console.log('💾 Inserting debates...');
  const batchSize = 1000;
  let inserted = 0;

  for (let i = 0; i < debatesToInsert.length; i += batchSize) {
    const batch = debatesToInsert.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('td_debates')
      .upsert(batch, { onConflict: 'debate_id' });

    if (!error) {
      inserted += batch.length;
      console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1}: ${inserted.toLocaleString()}`);
    } else {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  console.log(`\n✅ Inserted ${inserted.toLocaleString()} debate participations!\n`);
}

extractDebates().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

