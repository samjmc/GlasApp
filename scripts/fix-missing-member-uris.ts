/**
 * Fix Missing Member URIs
 * Populate member_uri and member_code for TDs that are missing this data
 */

import { supabaseDb as supabase } from '../server/db.js';

interface ApiMember {
  fullName: string;
  memberCode: string;
  uri: string;
}

async function fixMissingMemberUris() {
  console.log('🔧 FIXING MISSING MEMBER URIS');
  console.log('═'.repeat(70));

  if (!supabase) {
    console.error('❌ Supabase client not initialized');
    process.exit(1);
  }

  // Step 1: Get all TDs from Oireachtas API
  console.log('📡 Fetching all current Dáil members from API...');
  const apiUrl = 'https://api.oireachtas.ie/v1/members?date_start=2024-01-01&chamber=dail&limit=200';
  const response = await fetch(apiUrl);
  const data = await response.json();
  
  const apiMembers: ApiMember[] = data.results.map((r: any) => ({
    fullName: r.member.fullName,
    memberCode: r.member.memberCode,
    uri: r.member.uri
  }));

  console.log(`✅ Found ${apiMembers.length} members in API\n`);

  // Step 2: Get all TDs from database
  const { data: dbTDs, error } = await supabase
    .from('td_scores')
    .select('id, politician_name, member_uri, member_code');

  if (error || !dbTDs) {
    console.error('❌ Failed to fetch TDs from database:', error);
    return;
  }

  console.log(`✅ Found ${dbTDs.length} TDs in database\n`);

  // Step 3: Match and update
  console.log('🔄 Matching and updating TDs...');
  console.log('─'.repeat(70));

  let updated = 0;
  let alreadyHaveUri = 0;
  let notFoundInApi = 0;

  for (const dbTD of dbTDs) {
    // Skip if already has member_uri
    if (dbTD.member_uri) {
      alreadyHaveUri++;
      continue;
    }

    // Find matching member in API
    const apiMember = apiMembers.find(m => 
      m.fullName.toLowerCase().trim() === dbTD.politician_name.toLowerCase().trim()
    );

    if (!apiMember) {
      console.log(`⚠️  ${dbTD.politician_name} - Not found in API (likely inactive)`);
      notFoundInApi++;
      continue;
    }

    // Update database
    const { error: updateError } = await supabase
      .from('td_scores')
      .update({
        member_uri: apiMember.uri,
        member_code: apiMember.memberCode,
        is_active: true
      })
      .eq('id', dbTD.id);

    if (updateError) {
      console.error(`❌ ${dbTD.politician_name} - Update failed:`, updateError.message);
    } else {
      console.log(`✅ ${dbTD.politician_name} → ${apiMember.memberCode}`);
      updated++;
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('✅ COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Updated: ${updated}`);
  console.log(`Already had URI: ${alreadyHaveUri}`);
  console.log(`Not found in API (inactive): ${notFoundInApi}`);
  console.log('═'.repeat(70));
}

fixMissingMemberUris().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

