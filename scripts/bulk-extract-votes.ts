/**
 * Bulk Votes Extraction
 * WORKAROUND for broken member_id filtering
 * Fetches ALL votes, then matches to TDs client-side
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000,
  headers: {
    'User-Agent': 'GlasPolitics/1.0',
    'Accept': 'application/json'
  }
});

async function bulkExtractVotes() {
  console.log('🗳️  BULK VOTES EXTRACTION');
  console.log('═'.repeat(70));
  console.log('WORKAROUND: Fetching ALL votes, filtering client-side');
  console.log('Extracting individual voting records with party loyalty analysis\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Step 1: Get all TDs from database
  console.log('📊 Step 1: Loading TDs from database...');
  const { data: tds, error: tdError } = await supabase
    .from('td_scores')
    .select('id, politician_name, party, member_code, member_uri');

  if (tdError || !tds) {
    console.error('❌ Failed to load TDs:', tdError);
    return;
  }

  console.log(`✅ Loaded ${tds.length} TDs\n`);

  // Create lookup maps
  const tdLookupByUri = new Map<string, any>();
  const tdLookupByName = new Map<string, any>();
  
  tds.forEach(td => {
    if (td.member_uri) {
      tdLookupByUri.set(td.member_uri, td);
    }
    if (td.member_code) {
      // Store multiple variations to handle API inconsistencies
      tdLookupByUri.set(`/ie/oireachtas/member/${td.member_code}`, td);
      tdLookupByUri.set(`/ie/oireachtas/member/id/${td.member_code}`, td); // API format
      tdLookupByUri.set(`https://data.oireachtas.ie/ie/oireachtas/member/id/${td.member_code}`, td); // Full URL
      tdLookupByUri.set(`https://data.oireachtas.ie/ie/oireachtas/member/${td.member_code}`, td); // Alt format
    }
    tdLookupByName.set(td.politician_name.toLowerCase(), td);
  });

  console.log(`✅ Created lookup maps\n`);

  // Step 2: Fetch ALL votes from API
  console.log('🗳️  Step 2: Fetching ALL votes from Oireachtas API...');
  console.log('This may take several minutes...\n');

  const allVotes: any[] = [];
  const dateFrom = '2024-01-01';
  const dateTo = new Date().toISOString().split('T')[0];
  let skip = 0;
  const limit = 500;
  let totalFetched = 0;

  while (true) {
    console.log(`   Fetching batch ${Math.floor(skip / limit) + 1} (skip: ${skip})...`);

    try {
      const response = await apiClient.get('/votes', {
        params: {
          chamber: 'dail',
          date_start: dateFrom,
          date_end: dateTo,
          limit,
          skip
        }
      });

      const results = response.data.results || [];
      
      if (results.length === 0) {
        console.log('   ✅ No more votes to fetch\n');
        break;
      }

      allVotes.push(...results);
      totalFetched += results.length;
      console.log(`   ✅ Fetched ${results.length} votes (Total: ${totalFetched})`);

      if (results.length < limit) break;

      skip += limit;

      // Safety limit
      if (skip > 10000) {
        console.log('   ⚠️  Reached safety limit of 10,000 votes');
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: any) {
      console.error(`   ❌ Error fetching batch: ${error.message}`);
      break;
    }
  }

  console.log(`\n✅ Total votes fetched: ${allVotes.length}`);

  // Step 3: Process each vote and extract TD votes
  console.log('\n💾 Step 3: Extracting individual TD votes...');
  console.log('─'.repeat(70));

  let totalVoteRecords = 0;
  let inserted = 0;
  let errors = 0;

  for (const result of allVotes) {
    const division = result.division;
    const voteDate = division.date;
    const rawSubject = division.subject || division.showAs || '';
    const voteSubject = typeof rawSubject === 'string' ? rawSubject : String(rawSubject || '');
    const voteOutcome = division.outcome || '';
    const voteId = division.divisionId || division.uri?.split('/').pop() || `v-${Date.now()}`;

    // Extract vote tallies (get the tally count, not the whole object)
    const totalTaVotes = division.tallies?.taVotes?.tally || 0;
    const totalNilVotes = division.tallies?.nilVotes?.tally || 0;
    const totalStaonVotes = division.tallies?.staonVotes?.tally || 0;

    // Process each type of vote (ta, nil, staon)
    const voteTypes = [
      { type: 'ta', members: division.tallies?.taVotes?.members || [] },
      { type: 'nil', members: division.tallies?.nilVotes?.members || [] },
      { type: 'staon', members: division.tallies?.staonVotes?.members || [] }
    ];

    for (const voteType of voteTypes) {
      for (const memberVote of voteType.members) {
        const member = memberVote.member;
        const memberUri = member?.uri;
        const memberName = member?.showAs || member?.fullName;

        // Find TD
        let td = memberUri ? tdLookupByUri.get(memberUri) : null;
        if (!td && memberName) {
          td = tdLookupByName.get(memberName.toLowerCase());
        }

        if (!td) continue;

        totalVoteRecords++;

        // Calculate party loyalty
        const votedWithParty = calculatePartyLoyalty(division, td.party, voteType.type as any);

        // Insert vote record
        const voteData = {
          td_id: td.id,
          vote_id: `${voteId}-${td.id}`,
          vote_uri: division.uri || '',
          vote_date: voteDate,
          vote_subject: voteSubject.substring(0, 500),
          vote_outcome: voteOutcome,
          td_vote: voteType.type,
          voted_with_party: votedWithParty,
          td_party_at_vote: td.party,
          debate_uri: division.debate?.uri || null,
          legislation_uri: division.bill?.uri || null,
          total_ta_votes: totalTaVotes,
          total_nil_votes: totalNilVotes,
          total_staon_votes: totalStaonVotes
        };

        try {
          const { error: insertError } = await supabase
            .from('td_votes')
            .upsert(voteData, {
              onConflict: 'vote_id',
              ignoreDuplicates: false
            });

          if (!insertError) {
            inserted++;
          } else {
            errors++;
            if (errors <= 5) {
              console.error(`   ❌ Insert error: ${insertError.message}`);
            }
          }
        } catch (error: any) {
          errors++;
        }
      }
    }

    // Progress update
    if (totalVoteRecords % 500 === 0 && totalVoteRecords > 0) {
      console.log(`   Progress: ${totalVoteRecords} vote records, ${inserted} inserted`);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 EXTRACTION COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Divisions processed:      ${allVotes.length.toLocaleString()}`);
  console.log(`Individual votes found:   ${totalVoteRecords.toLocaleString()}`);
  console.log(`Successfully inserted:    ${inserted.toLocaleString()}`);
  console.log(`Errors:                   ${errors.toLocaleString()}`);
  console.log('═'.repeat(70));

  // Statistics
  const { data: stats } = await supabase.from('td_votes').select('*');

  if (stats) {
    const partyLoyalVotes = stats.filter((v: any) => v.voted_with_party === true).length;
    const crossPartyVotes = stats.filter((v: any) => v.voted_with_party === false).length;
    const avgLoyalty = stats.length > 0 ? ((partyLoyalVotes / stats.length) * 100).toFixed(1) : 0;

    console.log('\n📈 VOTING STATISTICS:');
    console.log(`   Total votes in DB:        ${stats.length.toLocaleString()}`);
    console.log(`   Party loyal votes:        ${partyLoyalVotes.toLocaleString()}`);
    console.log(`   Cross-party votes:        ${crossPartyVotes.toLocaleString()}`);
    console.log(`   Average party loyalty:    ${avgLoyalty}%`);
  }

  console.log('\n✅ Bulk votes extraction complete!\n');
}

// Helper: Calculate if TD voted with their party
function calculatePartyLoyalty(division: any, tdParty: string, tdVote: 'ta' | 'nil' | 'staon'): boolean {
  // Count how party members voted
  let partyTaCount = 0;
  let partyNilCount = 0;
  let partyStaonCount = 0;

  // Count ta votes from party
  if (division.tallies?.taVotes?.members) {
    partyTaCount = division.tallies.taVotes.members.filter((m: any) => 
      m.member?.party?.includes(tdParty) || m.member?.showAs?.includes(tdParty)
    ).length;
  }

  // Count nil votes from party
  if (division.tallies?.nilVotes?.members) {
    partyNilCount = division.tallies.nilVotes.members.filter((m: any) => 
      m.member?.party?.includes(tdParty) || m.member?.showAs?.includes(tdParty)
    ).length;
  }

  // Count staon votes from party
  if (division.tallies?.staonVotes?.members) {
    partyStaonCount = division.tallies.staonVotes.members.filter((m: any) => 
      m.member?.party?.includes(tdParty) || m.member?.showAs?.includes(tdParty)
    ).length;
  }

  // Determine party's majority vote
  const maxCount = Math.max(partyTaCount, partyNilCount, partyStaonCount);
  
  if (maxCount === 0) return true; // No party members voted, consider loyal

  let partyMajorityVote: 'ta' | 'nil' | 'staon';
  if (partyTaCount === maxCount) partyMajorityVote = 'ta';
  else if (partyNilCount === maxCount) partyMajorityVote = 'nil';
  else partyMajorityVote = 'staon';

  return tdVote === partyMajorityVote;
}

bulkExtractVotes().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

