/**
 * Find the 7 current TDs missing member_uri
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';
import { getCurrentDailMembers } from '../server/services/oireachtasAPIService.js';

async function find7Missing() {
  console.log('🔍 FINDING 7 CURRENT TDs WITHOUT MEMBER_URI\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Get current Dáil members from API
  const apiMembers = await getCurrentDailMembers();
  console.log(`✅ API: ${apiMembers.length} current Dáil members`);

  // Get database TDs
  const { data: dbTDs } = await supabase
    .from('td_scores')
    .select('id, politician_name, party, constituency, member_code, member_uri');

  const withUri = dbTDs?.filter(td => td.member_uri).length;
  const withoutUri = dbTDs?.filter(td => !td.member_uri).length;
  
  console.log(`✅ Database: ${dbTDs?.length} TDs (${withUri} with URI, ${withoutUri} without)\n`);

  // Find current TDs without member_uri
  console.log('❌ CURRENT TDs MISSING MEMBER_URI:');
  console.log('═'.repeat(70));

  const missing: any[] = [];

  for (const apiMember of apiMembers) {
    // Find in database
    const dbMatch = dbTDs?.find(db => 
      db.politician_name.toLowerCase() === apiMember.fullName.toLowerCase() ||
      db.member_code === apiMember.memberCode
    );

    if (dbMatch && !dbMatch.member_uri) {
      missing.push({
        dbId: dbMatch.id,
        name: apiMember.fullName,
        party: apiMember.party,
        constituency: apiMember.constituency,
        memberCode: apiMember.memberCode,
        dbName: dbMatch.politician_name
      });
    }
  }

  missing.forEach((td, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. ${td.name.padEnd(40)} ${td.party || 'Independent'}`);
    console.log(`    DB ID: ${td.dbId}, Code: ${td.memberCode}`);
    console.log(`    Constituency: ${td.constituency}`);
    if (td.name !== td.dbName) {
      console.log(`    ⚠️  Name mismatch: DB has "${td.dbName}"`);
    }
    console.log('');
  });

  console.log('═'.repeat(70));
  console.log(`Total: ${missing.length} current TDs without member_uri\n`);

  if (missing.length > 0) {
    console.log('💾 GENERATING UPDATE SQL...\n');
    console.log('-- Copy and paste these UPDATE statements:');
    missing.forEach(td => {
      console.log(`UPDATE td_scores SET member_code = '${td.memberCode}', member_uri = '/ie/oireachtas/member/${td.memberCode}' WHERE id = ${td.dbId};`);
    });
  }
}

find7Missing().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

