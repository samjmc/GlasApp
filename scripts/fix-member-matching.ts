/**
 * Fix Member Matching
 * Populates member_uri and member_code using better matching logic
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';
import { getCurrentDailMembers } from '../server/services/oireachtasAPIService.js';

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[áàâäãåā]/g, 'a')
    .replace(/[éèêëē]/g, 'e')
    .replace(/[íìîïī]/g, 'i')
    .replace(/[óòôöõōø]/g, 'o')
    .replace(/[úùûüū]/g, 'u')
    .replace(/['']/g, '')
    .replace(/[- ]/g, '')
    .replace(/[^a-z]/g, '');
}

async function fixMemberMatching() {
  console.log('🔧 FIXING MEMBER MATCHING');
  console.log('═'.repeat(70));
  console.log('Populating member_uri and member_code using flexible matching\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Get API members
  console.log('📡 Fetching members from Oireachtas API...');
  const apiMembers = await getCurrentDailMembers();
  console.log(`✅ Found ${apiMembers.length} members from API\n`);

  // Get DB TDs
  const { data: dbTDs, error } = await supabase
    .from('td_scores')
    .select('id, politician_name, party, constituency');

  if (error || !dbTDs) {
    console.error('❌ Failed to fetch TDs from database');
    return;
  }

  console.log(`✅ Found ${dbTDs.length} TDs in database\n`);

  // Match and update
  console.log('🔗 Matching TDs...');
  console.log('─'.repeat(70));

  let matched = 0;
  let unmatched = 0;

  for (const dbTD of dbTDs) {
    const normalizedDBName = normalizeName(dbTD.politician_name);

    // Try to find matching API member
    const apiMatch = apiMembers.find(api => {
      // First try exact name match (normalized)
      if (normalizeName(api.fullName) === normalizedDBName) {
        return true;
      }

      // Fallback: match by party AND constituency
      const partyMatch = api.party?.toLowerCase() === dbTD.party?.toLowerCase();
      const constMatch = api.constituency?.toLowerCase() === dbTD.constituency?.toLowerCase();

      return partyMatch && constMatch;
    });

    if (apiMatch) {
      // Update database with member info
      const { error: updateError } = await supabase
        .from('td_scores')
        .update({
          member_code: apiMatch.memberCode,
          member_uri: `/ie/oireachtas/member/${apiMatch.memberCode}`
        })
        .eq('id', dbTD.id);

      if (updateError) {
        console.log(`❌ ${dbTD.politician_name}: ${updateError.message}`);
      } else {
        matched++;
        console.log(`✅ ${dbTD.politician_name.padEnd(40)} → ${apiMatch.memberCode}`);
      }
    } else {
      unmatched++;
      console.log(`⏭️  ${dbTD.politician_name.padEnd(40)} → No match found`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('📊 MATCHING COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Matched:     ${matched}`);
  console.log(`Unmatched:   ${unmatched}`);
  console.log(`Total:       ${dbTDs.length}`);
  console.log('═'.repeat(70));

  if (matched > 0) {
    console.log('\n✅ You can now re-run the extraction scripts!');
    console.log('   The questions/votes/debates/legislation scripts will now match TDs properly.');
  }
}

fixMemberMatching().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

