/**
 * Calculate TD Rankings
 * Updates national, constituency, and party rankings based on overall_score
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

async function calculateTDRankings() {
  console.log('🏆 CALCULATING TD RANKINGS');
  console.log('═'.repeat(70));

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Get all active TDs with their scores
  const { data: tds, error } = await supabase
    .from('td_scores')
    .select('id, politician_name, overall_score, constituency, party')
    .eq('is_active', true)
    .order('overall_score', { ascending: false });

  if (error || !tds) {
    console.error('❌ Failed to fetch TDs:', error);
    return;
  }

  console.log(`✅ Loaded ${tds.length} active TDs\n`);

  // Calculate national rankings (sorted by overall_score descending)
  console.log('📊 Calculating national rankings...');
  const nationalRankings = new Map<number, number>();
  tds.forEach((td, index) => {
    nationalRankings.set(td.id, index + 1);
  });

  // Calculate constituency rankings
  console.log('📍 Calculating constituency rankings...');
  const constituencyGroups = new Map<string, any[]>();
  tds.forEach(td => {
    if (!constituencyGroups.has(td.constituency)) {
      constituencyGroups.set(td.constituency, []);
    }
    constituencyGroups.get(td.constituency)!.push(td);
  });

  const constituencyRankings = new Map<number, number>();
  for (const [constituency, constituencyTDs] of constituencyGroups) {
    constituencyTDs
      .sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0))
      .forEach((td, index) => {
        constituencyRankings.set(td.id, index + 1);
      });
  }

  // Calculate party rankings
  console.log('🏛️  Calculating party rankings...');
  const partyGroups = new Map<string, any[]>();
  tds.forEach(td => {
    if (!td.party) return;
    if (!partyGroups.has(td.party)) {
      partyGroups.set(td.party, []);
    }
    partyGroups.get(td.party)!.push(td);
  });

  const partyRankings = new Map<number, number>();
  for (const [party, partyTDs] of partyGroups) {
    partyTDs
      .sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0))
      .forEach((td, index) => {
        partyRankings.set(td.id, index + 1);
      });
  }

  // Update database
  console.log('\n💾 Updating rankings in database...');
  let updated = 0;
  let errors = 0;

  for (const td of tds) {
    const nationalRank = nationalRankings.get(td.id);
    const constituencyRank = constituencyRankings.get(td.id);
    const partyRank = partyRankings.get(td.id);

    const { error: updateError } = await supabase
      .from('td_scores')
      .update({
        national_rank: nationalRank,
        constituency_rank: constituencyRank,
        party_rank: partyRank
      })
      .eq('id', td.id);

    if (updateError) {
      console.error(`❌ ${td.politician_name}: ${updateError.message}`);
      errors++;
    } else {
      updated++;
      if (updated % 20 === 0) {
        console.log(`   Progress: ${updated}/${tds.length}`);
      }
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Updated: ${updated}/${tds.length}`);
  console.log(`Errors: ${errors}`);
  console.log('═'.repeat(70));

  // Show sample results
  console.log('\n📊 Top 10 National Rankings:');
  console.log('─'.repeat(70));
  
  const top10 = tds.slice(0, 10);
  for (let i = 0; i < top10.length; i++) {
    const td = top10[i];
    const natRank = i + 1;
    const constRank = constituencyRankings.get(td.id);
    const partyRank = partyRankings.get(td.id);
    
    console.log(`${natRank.toString().padStart(2)}. ${td.politician_name.padEnd(30)} ${td.overall_score}/100`);
    console.log(`    ${td.constituency.padEnd(25)} Const:#${constRank} Party:#${partyRank} (${td.party})`);
  }

  // Show Ged Nash specifically
  const gedNash = tds.find(t => t.politician_name.toLowerCase().includes('ged nash'));
  if (gedNash) {
    console.log('\n🎯 Ged Nash Rankings:');
    console.log('─'.repeat(70));
    console.log(`National: #${nationalRankings.get(gedNash.id)} / ${tds.length}`);
    console.log(`Constituency (${gedNash.constituency}): #${constituencyRankings.get(gedNash.id)} / ${constituencyGroups.get(gedNash.constituency)?.length || 0}`);
    console.log(`Party (${gedNash.party}): #${partyRankings.get(gedNash.id)} / ${partyGroups.get(gedNash.party)?.length || 0}`);
  }
}

calculateTDRankings().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});






























