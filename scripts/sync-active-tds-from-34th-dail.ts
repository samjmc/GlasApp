/**
 * Sync Active TDs from 34th Dáil
 * Marks exactly the 174 current TDs as active, all others as inactive
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

async function syncActiveTDs() {
  console.log('🔄 SYNCING ACTIVE TDs WITH 34TH DÁIL');
  console.log('═'.repeat(70));

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Get all members of 34th Dáil from API
  const apiUrl = 'https://api.oireachtas.ie/v1/members?chamber_id=/ie/oireachtas/house/dail/34&limit=200';
  const response = await fetch(apiUrl);
  const data = await response.json();
  
  const current34thDail = data.results.map((r: any) => ({
    name: r.member.fullName.trim(),
    code: r.member.memberCode,
    uri: r.member.uri
  }));

  console.log(`✅ Found ${current34thDail.length} TDs in 34th Dáil\n`);

  // Step 1: Mark ALL TDs as inactive first
  console.log('Step 1: Marking all TDs as inactive...');
  const { error: deactivateError } = await supabase
    .from('td_scores')
    .update({ is_active: false })
    .gte('id', 0);

  if (deactivateError) {
    console.error('❌ Failed to deactivate:', deactivateError);
    return;
  }
  console.log('✅ All TDs marked inactive\n');

  // Step 2: Activate and update the 174 current TDs
  console.log('Step 2: Activating 174 current TDs...');
  console.log('─'.repeat(70));

  let activated = 0;
  let notFound = 0;
  let created = 0;

  for (const apiMember of current34thDail) {
    // Try to find in database by member_code or name
    const { data: existing } = await supabase
      .from('td_scores')
      .select('id, politician_name, member_code')
      .or(`member_code.eq.${apiMember.code},politician_name.ilike.${apiMember.name}`)
      .limit(1)
      .single();

    if (existing) {
      // Update existing TD
      const { error: updateError } = await supabase
        .from('td_scores')
        .update({
          is_active: true,
          member_code: apiMember.code,
          member_uri: apiMember.uri
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error(`❌ ${apiMember.name}: ${updateError.message}`);
      } else {
        activated++;
        if (activated % 20 === 0) {
          console.log(`   Progress: ${activated}/${current34thDail.length}`);
        }
      }
    } else {
      // Create new TD
      const { error: insertError } = await supabase
        .from('td_scores')
        .insert({
          politician_name: apiMember.name,
          member_code: apiMember.code,
          member_uri: apiMember.uri,
          is_active: true,
          overall_elo: 1500,
          transparency_elo: 1500,
          effectiveness_elo: 1500,
          integrity_elo: 1500,
          consistency_elo: 1500,
          constituency_service_elo: 1500
        });

      if (insertError) {
        console.error(`❌ ${apiMember.name} (NEW): ${insertError.message}`);
        notFound++;
      } else {
        console.log(`✨ Created new TD: ${apiMember.name}`);
        created++;
        activated++;
      }
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ SYNC COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Activated existing: ${activated - created}`);
  console.log(`Created new: ${created}`);
  console.log(`Not found: ${notFound}`);
  console.log('═'.repeat(70));

  // Verify final count
  const { count } = await supabase
    .from('td_scores')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  console.log(`\n✅ Final active TD count: ${count}`);
  console.log(`🎯 Target (34th Dáil): 174`);
  console.log(`${count === 174 ? '✅ MATCH!' : '⚠️  Mismatch - needs investigation'}`);
}

syncActiveTDs().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});




