/**
 * Find Missing TDs
 * Compare API with database to find TDs we're missing
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

async function findMissingTDs() {
  console.log('🔍 FINDING MISSING TDs');
  console.log('═'.repeat(70));

  // Get API members
  const apiUrl = 'https://api.oireachtas.ie/v1/members?date_start=2024-11-29&chamber=dail&limit=200';
  const apiResponse = await fetch(apiUrl);
  const apiData = await apiResponse.json();
  
  const apiMembers = apiData.results.map((r: any) => ({
    name: r.member.fullName.trim(),
    code: r.member.memberCode,
    uri: r.member.uri
  }));

  console.log(`API members: ${apiMembers.length}`);

  // Get our database members
  const { data: dbMembers } = await supabase!
    .from('td_scores')
    .select('politician_name, member_code, is_active');

  console.log(`DB members (total): ${dbMembers?.length}`);
  console.log(`DB members (active): ${dbMembers?.filter(m => m.is_active).length}`);

  // Find members in API but not in our DB
  const missing: any[] = [];
  
  for (const apiMember of apiMembers) {
    const inDb = dbMembers?.find(db => 
      db.member_code === apiMember.code ||
      db.politician_name.toLowerCase().trim() === apiMember.name.toLowerCase().trim()
    );

    if (!inDb) {
      missing.push(apiMember);
    } else if (!inDb.is_active) {
      console.log(`⚠️  ${apiMember.name} - In DB but marked inactive`);
    }
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`MISSING TDs: ${missing.length}`);
  console.log('═'.repeat(70));

  if (missing.length > 0) {
    console.log('\nTDs in API but NOT in our database:');
    missing.forEach((m, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. ${m.name}`);
      console.log(`    Code: ${m.code}`);
    });
  }

  // Also find TDs in our DB marked active but NOT in API
  console.log(`\n${'═'.repeat(70)}`);
  const notInApi: any[] = [];
  
  for (const dbMember of (dbMembers || [])) {
    if (!dbMember.is_active) continue;
    
    const inApi = apiMembers.find(api => 
      api.code === dbMember.member_code ||
      api.name.toLowerCase().trim() === dbMember.politician_name.toLowerCase().trim()
    );

    if (!inApi) {
      notInApi.push(dbMember);
    }
  }

  console.log(`TDs marked ACTIVE in DB but NOT in API: ${notInApi.length}`);
  console.log('═'.repeat(70));

  if (notInApi.length > 0) {
    console.log('\nThese should probably be marked inactive:');
    notInApi.forEach((m, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. ${m.politician_name} (Code: ${m.member_code || 'NONE'})`);
    });
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log('SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Dáil seats: 174`);
  console.log(`Our active TDs: 169`);
  console.log(`Missing from DB: ${missing.length}`);
  console.log(`Incorrectly marked active: ${notInApi.length}`);
  console.log(`Net difference: ${missing.length - notInApi.length}`);
  console.log('═'.repeat(70));
}

findMissingTDs().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
