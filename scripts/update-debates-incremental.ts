/**
 * Incremental Debate Update
 * Only fetches debates since the last update - MUCH faster!
 * Run this weekly/monthly to stay current
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';
import { classifyQuestionTopic } from '../server/services/oireachtasAPIService.js';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000
});

async function updateDebatesIncremental() {
  console.log('🔄 INCREMENTAL DEBATE UPDATE\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  const startTime = Date.now();

  // Get the most recent debate date in database
  const { data: mostRecent } = await supabase
    .from('td_debates')
    .select('debate_date')
    .order('debate_date', { ascending: false })
    .limit(1);

  const lastDate = mostRecent?.[0]?.debate_date;
  const dateStart = lastDate || '2024-01-01';

  console.log(`📅 Fetching debates since: ${dateStart}\n`);

  // Load TDs
  const { data: tds } = await supabase
    .from('td_scores')
    .select('id, politician_name, member_code, member_uri');

  console.log(`✅ Loaded ${tds?.length} TDs`);

  const tdLookupByName = new Map<string, any>();
  const tdLookupByUri = new Map<string, any>();
  
  tds?.forEach(td => {
    tdLookupByName.set(td.politician_name.toLowerCase(), td);
    if (td.member_code) {
      tdLookupByUri.set(`/ie/oireachtas/member/id/${td.member_code}`, td);
      tdLookupByUri.set(`https://data.oireachtas.ie/ie/oireachtas/member/id/${td.member_code}`, td);
    }
    if (td.member_uri) {
      tdLookupByUri.set(td.member_uri, td);
    }
  });

  // Fetch debates since last update
  console.log('\n📥 Fetching new debates...');
  const newDebateRecords: any[] = [];
  let skip = 0;
  const limit = 50;

  while (true) {
    const response = await apiClient.get('/debates', {
      params: {
        chamber_type: 'house',
        chamber_id: 'https://data.oireachtas.ie/ie/oireachtas/house/dail/34',
        date_start: dateStart,
        limit,
        skip
      }
    });

    const results = response.data.results || [];
    if (results.length === 0) break;

    newDebateRecords.push(...results);
    
    if (results.length < limit) break;
    skip += limit;
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`✅ Found ${newDebateRecords.length} debate records to process\n`);

  if (newDebateRecords.length === 0) {
    console.log('✅ No new debates to process. Database is up to date!');
    return;
  }

  // Process debates
  console.log('🔍 Fetching debate details...');
  const debatesToInsert: any[] = [];
  let processed = 0;

  for (const debateRecord of newDebateRecords) {
    try {
      const debate = debateRecord.debateRecord;
      const debateUri = debate.uri;
      
      const detailResponse = await apiClient.get('/debates', {
        params: {
          debate_id: debateUri,
          limit: 1
        }
      });

      const fullDebate = detailResponse.data.results?.[0]?.debateRecord;
      
      if (!fullDebate || !fullDebate.debateSections) {
        processed++;
        continue;
      }

      const speakerMap = new Map<number, Set<string>>();

      fullDebate.debateSections.forEach((section: any) => {
        const debateSection = section.debateSection;
        const speakers = debateSection.speakers || [];
        
        speakers.forEach((speakerObj: any) => {
          const speaker = speakerObj.speaker;
          if (!speaker) return;

          const speakerName = speaker.showAs || speaker.as?.showAs;
          const speakerUri = speaker.uri || speaker.as?.uri;
          
          if (!speakerName) return;

          let td = null;
          if (speakerUri) td = tdLookupByUri.get(speakerUri);
          if (!td) td = tdLookupByName.get(speakerName.toLowerCase());

          if (td) {
            if (!speakerMap.has(td.id)) {
              speakerMap.set(td.id, new Set());
            }
            speakerMap.get(td.id)!.add(debateSection.showAs || 'General Debate');
          }
        });
      });

      speakerMap.forEach((topics, tdId) => {
        const topicList = Array.from(topics);
        const primaryTopic = classifyQuestionTopic(topicList[0] || '', '');

        debatesToInsert.push({
          td_id: tdId,
          debate_id: `${fullDebate.date}-${debateUri.split('/').pop()}-${tdId}`,
          debate_uri: debateUri,
          debate_date: fullDebate.date,
          subject: (fullDebate.debateSections?.[0]?.debateSection?.showAs || 'General Debate').substring(0, 500),
          speaking_turns: topicList.length,
          chamber: 'Dáil',
          ai_topic: primaryTopic
        });
      });

      processed++;
      if (processed % 10 === 0) {
        console.log(`   Progress: ${processed}/${newDebateRecords.length}`);
      }

      await new Promise(r => setTimeout(r, 200));

    } catch (error) {
      processed++;
    }
  }

  // Insert
  if (debatesToInsert.length > 0) {
    console.log(`\n💾 Inserting ${debatesToInsert.length} new participations...`);
    
    const { error } = await supabase
      .from('td_debates')
      .upsert(debatesToInsert, { onConflict: 'debate_id' });

    if (error) {
      console.error('Error:', error.message);
    } else {
      console.log(`✅ Inserted ${debatesToInsert.length} debate participations!`);
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n✅ Update complete in ${totalTime} seconds!`);
}

updateDebatesIncremental().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});



