/**
 * Test TDs with different activity levels
 */

import { OireachtasAPIService } from './server/services/oireachtasAPIService';

async function testDiverseActivity() {
  console.log('🧪 TESTING DIVERSE ACTIVITY LEVELS');
  console.log('═══════════════════════════════════════════\n');

  // Test very different TDs
  const testNames = [
    'Mary Lou McDonald',  // Party leader (very active)
    'Michael Healy-Rae',  // Independent (might be different)
    'Catherine Connolly', // Independent (different activity)
    'Garret Ahearn',      // Newer TD (should have less)
    'Ciarán Ahern'        // Very new (elected 2024)
  ];

  const members = await OireachtasAPIService.getCurrentDailMembers();
  console.log(`✅ Found ${members.length} members\n`);

  for (const name of testNames) {
    const member = members.find(m => m.fullName === name);
    
    if (!member) {
      console.log(`❌ ${name} - Not found\n`);
      continue;
    }

    console.log(`📊 ${name}`);
    console.log('─'.repeat(50));
    console.log(`   Party: ${member.party || 'Unknown'}`);
    console.log(`   Constituency: ${member.constituency || 'Unknown'}`);
    console.log(`   Member Since: ${member.dateRange.start}\n`);

    const activity = await OireachtasAPIService.getCompleteMemberActivity(member);
    
    console.log(`   Questions (2024-now): ${activity.questionsAsked}`);
    console.log(`   ├─ Oral: ${activity.oralQuestions}`);
    console.log(`   └─ Written: ${activity.writtenQuestions}`);
    console.log(`   Debates: ${activity.debates}`);
    console.log(`   Votes: ${activity.votes}`);
    console.log(`   Last Active: ${activity.lastActive}\n`);
  }

  console.log('═══════════════════════════════════════════');
  console.log('💡 ANALYSIS:');
  console.log('═══════════════════════════════════════════\n');
  console.log('If numbers vary by TD:');
  console.log('  ✅ System is working correctly');
  console.log('  ✅ Each TD has their real activity level\n');
  console.log('If all numbers are identical:');
  console.log('  ⚠️  API might be returning same data for everyone');
  console.log('  ⚠️  Need to investigate query parameters further\n');
}

testDiverseActivity();



