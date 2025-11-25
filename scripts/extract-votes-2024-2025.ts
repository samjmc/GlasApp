/**
 * Extract Votes 2024-2025
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000
});

async function extractVotes() {
  console.log('🗳️  EXTRACTING 2024-2025 VOTES\n');

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

  console.log(`✅ Created lookups (${tdLookup.size} URIs, ${tdNameLookup.size} names)\n`);

  // Fetch votes
  console.log('📥 Fetching divisions...');
  const allDivisions: any[] = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const response = await apiClient.get('/divisions', {
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

    allDivisions.push(...results);
    console.log(`   Fetched ${allDivisions.length} divisions`);

    if (results.length < limit) break;
    skip += limit;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ Total divisions: ${allDivisions.length}\n`);

  // Process votes
  console.log('🔗 Processing individual votes...');
  const votesToInsert: any[] = [];
  let processed = 0;

  for (const result of allDivisions) {
    const division = result.division;
    const tallies = division.tallies;
    
    if (!tallies) continue;
    
    // Process each vote category
    const voteCategories = [
      { type: tallies.taVotes, vote: 'ta' },
      { type: tallies.nilVotes, vote: 'nil' },
      { type: tallies.staonVotes, vote: 'staon' }
    ];
    
    voteCategories.forEach(({ type, vote }) => {
      const members = type?.members || [];
      
      members.forEach((m: any) => {
        const memberCode = m.member?.memberCode;
        const memberUri = m.member?.uri;
        const memberName = m.member?.showAs;
        
        let td = memberCode ? tdLookup.get(memberCode) : null;
        if (!td && memberUri) {
          td = tdLookup.get(memberUri);
        }
        if (!td && memberName) {
          td = tdNameLookup.get(memberName.toLowerCase());
        }
        
        if (td) {
          votesToInsert.push({
            td_id: td.id,
            vote_id: `${division.voteId || division.uri?.split('/').pop()}-${td.id}`,
            vote_uri: division.uri || '',
            vote_date: division.date || '',
            vote_subject: (division.subject?.showAs || '').substring(0, 500),
            td_vote: vote,
            vote_outcome: division.outcome || '',
            td_party_at_vote: td.party || '',
            voted_with_party: null,
            debate_uri: division.debate?.uri || null,
            legislation_uri: null,
            total_ta_votes: tallies.taVotes?.tally || 0,
            total_nil_votes: tallies.nilVotes?.tally || 0,
            total_staon_votes: tallies.staonVotes?.tally || 0
          });
        }
      });
    });

    processed++;
    if (processed % 50 === 0) {
      console.log(`   Processed ${processed}/${allDivisions.length} divisions (${votesToInsert.length} votes)`);
    }
  }

  console.log(`\n✅ Matched ${votesToInsert.length} individual votes\n`);

  // Batch insert
  console.log('💾 Inserting votes...');
  const batchSize = 1000;
  let inserted = 0;

  for (let i = 0; i < votesToInsert.length; i += batchSize) {
    const batch = votesToInsert.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('td_votes')
      .upsert(batch, { onConflict: 'vote_id' });

    if (!error) {
      inserted += batch.length;
      console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1}: ${inserted.toLocaleString()}/${votesToInsert.length.toLocaleString()}`);
    } else {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  console.log(`\n✅ Inserted ${inserted.toLocaleString()} votes!\n`);
}

extractVotes().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

