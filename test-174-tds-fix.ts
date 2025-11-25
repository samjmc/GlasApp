/**
 * Test: Verify we now get all 174 TDs with fixed API parameters
 */

import { getCurrentDailMembers } from './server/services/oireachtasAPIService.js';

async function testTDCount() {
  console.log('🧪 TESTING FIXED TD COUNT');
  console.log('═'.repeat(60));
  console.log('Expected: 174 TDs in 34th Dáil');
  console.log('Previous: 138 TDs (incorrect filtering)\n');

  console.log('📡 Fetching members with FIXED parameters:');
  console.log('   ✓ chamber: "dail"');
  console.log('   ✓ house_no: 34 (INTEGER - not string!)');
  console.log('   ✓ limit: 200\n');

  const members = await getCurrentDailMembers();

  console.log('─'.repeat(60));
  console.log(`\n✅ RESULT: ${members.length} TDs fetched`);
  
  if (members.length === 174) {
    console.log('🎉 SUCCESS! We now get all 174 TDs!\n');
  } else if (members.length > 138) {
    console.log(`✨ IMPROVEMENT! Up from 138 to ${members.length} TDs`);
    console.log(`⚠️  Still missing ${174 - members.length} TDs\n`);
  } else {
    console.log(`❌ ISSUE: We're getting ${members.length} TDs (expected 174)\n`);
  }

  // Party breakdown
  console.log('📊 PARTY BREAKDOWN:');
  console.log('─'.repeat(60));
  const partyCount: Record<string, number> = {};
  members.forEach(m => {
    const party = m.party || 'Independent';
    partyCount[party] = (partyCount[party] || 0) + 1;
  });

  Object.entries(partyCount)
    .sort(([, a], [, b]) => b - a)
    .forEach(([party, count]) => {
      console.log(`  ${party.padEnd(30)} ${count.toString().padStart(3)} TDs`);
    });

  // Constituency breakdown
  console.log('\n📍 SAMPLE CONSTITUENCIES:');
  console.log('─'.repeat(60));
  const constituencyCount: Record<string, number> = {};
  members.forEach(m => {
    const constituency = m.constituency || 'Unknown';
    constituencyCount[constituency] = (constituencyCount[constituency] || 0) + 1;
  });

  Object.entries(constituencyCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .forEach(([constituency, count]) => {
      console.log(`  ${constituency.padEnd(30)} ${count.toString().padStart(2)} TDs`);
    });

  // Sample TDs
  console.log('\n👥 SAMPLE TDs:');
  console.log('─'.repeat(60));
  members.slice(0, 10).forEach(m => {
    const party = (m.party || 'IND').substring(0, 15).padEnd(15);
    const constituency = (m.constituency || 'Unknown').substring(0, 25).padEnd(25);
    console.log(`  ${m.fullName.padEnd(30)} ${party} ${constituency}`);
  });

  // Active status check
  console.log('\n🔍 ACTIVE STATUS CHECK:');
  console.log('─'.repeat(60));
  const activeMembers = members.filter(m => !m.dateRange.end);
  const inactiveMembers = members.filter(m => m.dateRange.end);
  
  console.log(`  Currently Active:   ${activeMembers.length} TDs`);
  console.log(`  No longer active:   ${inactiveMembers.length} TDs`);
  
  if (inactiveMembers.length > 0) {
    console.log('\n  ⚠️  Inactive members (should be 0):');
    inactiveMembers.forEach(m => {
      console.log(`     • ${m.fullName} (ended: ${m.dateRange.end})`);
    });
  }

  console.log('\n' + '═'.repeat(60));
  
  if (members.length === 174 && inactiveMembers.length === 0) {
    console.log('✅ PERFECT! All 174 TDs fetched, all currently active!');
  } else {
    console.log('⚠️  Further investigation needed');
  }
  
  console.log('═'.repeat(60));
}

testTDCount().catch(console.error);

