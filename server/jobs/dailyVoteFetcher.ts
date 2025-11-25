/**
 * Daily Vote Fetcher Job
 * 
 * Fetches new voting records from Oireachtas API and stores them in database
 * Runs daily to keep voting records up-to-date for ideology analysis
 */

import { supabaseDb as supabase } from '../db.js';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000,
  headers: {
    'User-Agent': 'GlasPolitics/1.0',
    'Accept': 'application/json'
  }
});

interface VoteDivision {
  divisionId: string;
  uri: string;
  date: string;
  subject: string | { showAs: string };
  outcome: string;
  tallies?: {
    taVotes?: {
      tally: number;
      members: Array<{ member: { uri: string; showAs: string; party?: string; memberCode?: string } }>;
    };
    nilVotes?: {
      tally: number;
      members: Array<{ member: { uri: string; showAs: string; party?: string; memberCode?: string } }>;
    };
    staonVotes?: {
      tally: number;
      members: Array<{ member: { uri: string; showAs: string; party?: string; memberCode?: string } }>;
    };
  };
  debate?: { uri: string };
  bill?: { uri: string };
}

async function fetchNewVotes(): Promise<{
  divisionsFetched: number;
  voteRecordsInserted: number;
  errors: number;
}> {
  if (!supabase) {
    console.error('❌ Supabase not initialized');
    return { divisionsFetched: 0, voteRecordsInserted: 0, errors: 0 };
  }

  console.log('🗳️  Daily Vote Fetcher');
  console.log('═'.repeat(70));
  console.log('Fetching new voting records from Oireachtas API\n');

  // Step 1: Determine date range (last 7 days or since last vote)
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const dateFrom = sevenDaysAgo.toISOString().split('T')[0];

  // Get latest vote date from database
  const { data: latestVote } = await supabase
    .from('td_votes')
    .select('vote_date')
    .order('vote_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const fetchFromDate = latestVote?.vote_date 
    ? new Date(latestVote.vote_date).toISOString().split('T')[0]
    : dateFrom;

  console.log(`📅 Fetching votes from: ${fetchFromDate} to ${today}`);
  console.log(`   (Last vote in DB: ${latestVote?.vote_date || 'None'})\n`);

  // Step 2: Load TDs from database for matching
  console.log('📊 Loading TDs from database...');
  const { data: tds, error: tdError } = await supabase
    .from('td_scores')
    .select('id, politician_name, party, member_code, member_uri');

  if (tdError || !tds) {
    console.error('❌ Failed to load TDs:', tdError);
    return { divisionsFetched: 0, voteRecordsInserted: 0, errors: 0 };
  }

  console.log(`✅ Loaded ${tds.length} TDs\n`);

  // Create lookup maps
  const tdLookupByUri = new Map<string, any>();
  const tdLookupByCode = new Map<string, any>();
  const tdLookupByName = new Map<string, any>();

  tds.forEach(td => {
    if (td.member_uri) {
      tdLookupByUri.set(td.member_uri, td);
    }
    if (td.member_code) {
      tdLookupByCode.set(td.member_code, td);
      tdLookupByUri.set(`/ie/oireachtas/member/id/${td.member_code}`, td);
      tdLookupByUri.set(`https://data.oireachtas.ie/ie/oireachtas/member/id/${td.member_code}`, td);
    }
    tdLookupByName.set(td.politician_name.toLowerCase(), td);
  });

  // Step 3: Fetch divisions from API
  console.log('📥 Fetching divisions from Oireachtas API...');
  const allDivisions: VoteDivision[] = [];
  let skip = 0;
  const limit = 500;
  let totalFetched = 0;

  while (true) {
    try {
      const response = await apiClient.get('/votes', {
        params: {
          chamber: 'dail',
          date_start: fetchFromDate,
          date_end: today,
          limit,
          skip,
        },
      });

      const results = response.data?.results || [];
      
      if (results.length === 0) {
        break;
      }

      for (const result of results) {
        if (result.division) {
          allDivisions.push(result.division);
        }
      }

      totalFetched += results.length;
      console.log(`   ✅ Fetched ${results.length} divisions (Total: ${totalFetched})`);

      if (results.length < limit) break;

      skip += limit;
      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting

      // Safety limit
      if (skip > 5000) {
        console.log('   ⚠️  Reached safety limit');
        break;
      }
    } catch (error: any) {
      console.error(`   ❌ Error fetching batch: ${error.message}`);
      break;
    }
  }

  console.log(`\n✅ Total divisions fetched: ${allDivisions.length}\n`);

  // Step 4: Extract individual TD votes
  console.log('🔍 Extracting individual TD votes...');
  let voteRecordsInserted = 0;
  let errors = 0;
  const votesToInsert: any[] = [];

  for (const division of allDivisions) {
    if (!division.tallies) continue;

    const voteDate = division.date;
    const voteSubject = typeof division.subject === 'string' 
      ? division.subject 
      : division.subject?.showAs || '';
    const voteOutcome = division.outcome || '';
    const voteId = division.divisionId || division.uri?.split('/').pop() || `v-${Date.now()}`;

    const totalTaVotes = division.tallies.taVotes?.tally || 0;
    const totalNilVotes = division.tallies.nilVotes?.tally || 0;
    const totalStaonVotes = division.tallies.staonVotes?.tally || 0;

    // Process each vote type
    const voteTypes = [
      { type: 'Ta' as const, members: division.tallies.taVotes?.members || [] },
      { type: 'Nil' as const, members: division.tallies.nilVotes?.members || [] },
      { type: 'Staon' as const, members: division.tallies.staonVotes?.members || [] }
    ];

    for (const voteType of voteTypes) {
      for (const memberVote of voteType.members) {
        const member = memberVote.member;
        const memberUri = member?.uri;
        const memberName = member?.showAs;
        const memberCode = member?.memberCode;

        // Find TD
        let td = memberUri ? tdLookupByUri.get(memberUri) : null;
        if (!td && memberCode) {
          td = tdLookupByCode.get(memberCode);
        }
        if (!td && memberName) {
          td = tdLookupByName.get(memberName.toLowerCase());
        }

        if (!td) continue;

        // Calculate party loyalty
        const votedWithParty = calculatePartyLoyalty(division, td.party, voteType.type);

        // Prepare vote record
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
          total_staon_votes: totalStaonVotes,
        };

        votesToInsert.push(voteData);
      }
    }

    // Progress update
    if (votesToInsert.length % 500 === 0 && votesToInsert.length > 0) {
      console.log(`   Progress: ${votesToInsert.length} vote records prepared`);
    }
  }

  console.log(`✅ Prepared ${votesToInsert.length} vote records\n`);

  // Step 5: Batch insert votes
  if (votesToInsert.length > 0) {
    console.log('💾 Inserting votes into database...');
    const batchSize = 1000;

    for (let i = 0; i < votesToInsert.length; i += batchSize) {
      const batch = votesToInsert.slice(i, i + batchSize);
      
      try {
        const { error } = await supabase
          .from('td_votes')
          .upsert(batch, {
            onConflict: 'vote_id',
            ignoreDuplicates: false
          });

        if (error) {
          console.error(`   ❌ Batch ${Math.floor(i / batchSize) + 1} error: ${error.message}`);
          errors += batch.length;
        } else {
          voteRecordsInserted += batch.length;
          console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1}: ${voteRecordsInserted.toLocaleString()}/${votesToInsert.length.toLocaleString()}`);
        }
      } catch (error: any) {
        console.error(`   ❌ Batch ${Math.floor(i / batchSize) + 1} failed: ${error.message}`);
        errors += batch.length;
      }
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 VOTE FETCHING COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Divisions fetched:       ${allDivisions.length.toLocaleString()}`);
  console.log(`Vote records prepared:   ${votesToInsert.length.toLocaleString()}`);
  console.log(`Successfully inserted:   ${voteRecordsInserted.toLocaleString()}`);
  if (errors > 0) {
    console.log(`Errors:                  ${errors.toLocaleString()}`);
  }
  console.log('═'.repeat(70));

  return {
    divisionsFetched: allDivisions.length,
    voteRecordsInserted,
    errors,
  };
}

/**
 * Calculate if TD voted with their party's majority
 */
function calculatePartyLoyalty(
  division: VoteDivision,
  tdParty: string | null,
  tdVote: 'Ta' | 'Nil' | 'Staon'
): boolean {
  if (!tdParty || !division.tallies) return true;

  let partyTaCount = 0;
  let partyNilCount = 0;
  let partyStaonCount = 0;

  // Count ta votes from party
  if (division.tallies.taVotes?.members) {
    partyTaCount = division.tallies.taVotes.members.filter((m: any) => 
      m.member?.party === tdParty
    ).length;
  }

  // Count nil votes from party
  if (division.tallies.nilVotes?.members) {
    partyNilCount = division.tallies.nilVotes.members.filter((m: any) => 
      m.member?.party === tdParty
    ).length;
  }

  // Count staon votes from party
  if (division.tallies.staonVotes?.members) {
    partyStaonCount = division.tallies.staonVotes.members.filter((m: any) => 
      m.member?.party === tdParty
    ).length;
  }

  // Determine party's majority vote
  const maxCount = Math.max(partyTaCount, partyNilCount, partyStaonCount);
  
  if (maxCount === 0) return true; // No party members voted, consider loyal

  let partyMajorityVote: 'Ta' | 'Nil' | 'Staon';
  if (partyTaCount === maxCount) partyMajorityVote = 'Ta';
  else if (partyNilCount === maxCount) partyMajorityVote = 'Nil';
  else partyMajorityVote = 'Staon';

  // Did TD vote with party majority?
  return tdVote === partyMajorityVote;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchNewVotes()
    .then((stats) => {
      console.log('\n✅ Vote fetcher complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Vote fetcher failed:', error);
      process.exit(1);
    });
}

export { fetchNewVotes };

