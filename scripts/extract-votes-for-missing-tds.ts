/**
 * Extract Votes for TDs with Missing Vote Data
 * Targeted extraction to save time
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

async function extractVotesForMissingTDs() {
  console.log('🗳️  EXTRACTING VOTES FOR MISSING TDs');
  console.log('═'.repeat(70));

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Find TDs with 0 or null votes
  const { data: tdsNeedingVotes } = await supabase
    .from('td_scores')
    .select('id, politician_name, member_code, member_uri')
    .eq('is_active', true)
    .or('total_votes.is.null,total_votes.eq.0');

  console.log(`Found ${tdsNeedingVotes?.length} TDs with 0 votes\n`);

  if (!tdsNeedingVotes || tdsNeedingVotes.length === 0) {
    console.log('✅ All TDs have votes!');
    return;
  }

  console.log('TDs needing votes:');
  tdsNeedingVotes.forEach(td => {
    console.log(`   - ${td.politician_name} (${td.member_code})`);
  });

  // Create lookups
  const tdLookup = new Map<string, any>();
  const tdNameLookup = new Map<string, any>();
  
  tdsNeedingVotes.forEach(td => {
    if (td.member_code) {
      tdLookup.set(`/ie/oireachtas/member/id/${td.member_code}`, td);
      tdLookup.set(`https://data.oireachtas.ie/ie/oireachtas/member/id/${td.member_code}`, td);
    }
    tdNameLookup.set(td.politician_name.toLowerCase(), td);
  });

  console.log(`\n📥 Fetching divisions from API...`);

  // Fetch all divisions
  const allDivisions: any[] = [];
  let skip = 0;
  const limit = 100;

  while (allDivisions.length < 200) {
    const url = `https://api.oireachtas.ie/v1/divisions?date_start=2024-01-01&chamber=dail&limit=${limit}&skip=${skip}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) break;
    
    allDivisions.push(...data.results);
    skip += limit;
    
    if (data.results.length < limit) break;
  }

  console.log(`✅ Fetched ${allDivisions.length} divisions\n`);

  // Process votes
  console.log('🔗 Processing votes...');
  const votesToInsert: any[] = [];
  let matchedCount = 0;

  for (const result of allDivisions) {
    const division = result.division;
    const tallies = division.tallies;

    // Process Tá votes
    for (const taVote of (tallies.taVotes?.ta?.members?.member || [])) {
      const td = tdLookup.get(taVote.memberURI) || tdNameLookup.get(taVote.fullName?.toLowerCase());
      if (td) {
        votesToInsert.push({
          td_id: td.id,
          vote_uri: division.uri,
          vote_subject: division.subject,
          vote_date: division.date,
          td_vote: 'ta',
          vote_outcome: division.outcome,
          total_ta_votes: tallies.totalVotes?.ta || 0,
          total_nil_votes: tallies.totalVotes?.nil || 0,
          total_staon_votes: tallies.totalVotes?.staon || 0
        });
        matchedCount++;
      }
    }

    // Process Níl votes
    for (const nilVote of (tallies.nilVotes?.nil?.members?.member || [])) {
      const td = tdLookup.get(nilVote.memberURI) || tdNameLookup.get(nilVote.fullName?.toLowerCase());
      if (td) {
        votesToInsert.push({
          td_id: td.id,
          vote_uri: division.uri,
          vote_subject: division.subject,
          vote_date: division.date,
          td_vote: 'nil',
          vote_outcome: division.outcome,
          total_ta_votes: tallies.totalVotes?.ta || 0,
          total_nil_votes: tallies.totalVotes?.nil || 0,
          total_staon_votes: tallies.totalVotes?.staon || 0
        });
        matchedCount++;
      }
    }

    // Process Staon votes
    for (const staonVote of (tallies.staonVotes?.staon?.members?.member || [])) {
      const td = tdLookup.get(staonVote.memberURI) || tdNameLookup.get(staonVote.fullName?.toLowerCase());
      if (td) {
        votesToInsert.push({
          td_id: td.id,
          vote_uri: division.uri,
          vote_subject: division.subject,
          vote_date: division.date,
          td_vote: 'staon',
          vote_outcome: division.outcome,
          total_ta_votes: tallies.totalVotes?.ta || 0,
          total_nil_votes: tallies.totalVotes?.nil || 0,
          total_staon_votes: tallies.totalVotes?.staon || 0
        });
        matchedCount++;
      }
    }
  }

  console.log(`✅ Matched ${matchedCount} votes\n`);

  // Show breakdown by TD
  const votesByTD = new Map<number, number>();
  votesToInsert.forEach(v => {
    votesByTD.set(v.td_id, (votesByTD.get(v.td_id) || 0) + 1);
  });

  console.log('📊 Votes found per TD:');
  tdsNeedingVotes.forEach(td => {
    const count = votesByTD.get(td.id) || 0;
    console.log(`   ${td.politician_name.padEnd(30)} ${count} votes`);
  });

  // Insert votes
  if (votesToInsert.length > 0) {
    console.log('\n💾 Inserting votes...');
    
    const batchSize = 1000;
    let inserted = 0;

    for (let i = 0; i < votesToInsert.length; i += batchSize) {
      const batch = votesToInsert.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('td_votes')
        .insert(batch);

      if (error) {
        console.error(`❌ Batch failed: ${error.message}`);
      } else {
        inserted += batch.length;
        console.log(`   ✅ Inserted ${inserted}/${votesToInsert.length}`);
      }
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Votes matched: ${votesToInsert.length}`);
  console.log(`TDs with votes found: ${votesByTD.size}`);
  console.log('═'.repeat(70));
}

extractVotesForMissingTDs().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});




