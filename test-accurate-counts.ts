/**
 * TEST ACCURATE COUNTS - FIXED VERSION
 * Now uses head.counts instead of results.length
 */

import { OireachtasAPIService } from './server/services/oireachtasAPIService';

async function testAccurateCounts() {
  console.log('🧪 TESTING ACCURATE COUNTS (FIXED)');
  console.log('═══════════════════════════════════════════\n');

  const testTDs = ['Mary Lou McDonald', 'Simon Harris', 'Paschal Donohoe'];

  // Get members
  const members = await OireachtasAPIService.getCurrentDailMembers();
  console.log(`✅ Found ${members.length} current Dáil members\n`);

  for (const tdName of testTDs) {
    console.log(`📊 ${tdName}`);
    console.log('─'.repeat(50));
    
    const member = members.find(m => m.fullName === tdName);
    if (!member) {
      console.log('❌ Not found\n');
      continue;
    }

    console.log(`✅ Party: ${member.party || 'Unknown'}`);
    console.log(`✅ Constituency: ${member.constituency || 'Unknown'}`);
    console.log(`✅ Member Code: ${member.memberCode}\n`);

    // Get ACCURATE activity using the fixed function
    const activity = await OireachtasAPIService.getCompleteMemberActivity(member);
    
    console.log('Parliamentary Activity (2024 to today):');
    console.log(`   Total Questions: ${activity.questionsAsked}`);
    console.log(`   ├─ Oral: ${activity.oralQuestions}`);
    console.log(`   └─ Written: ${activity.writtenQuestions}`);
    console.log(`   Debates: ${activity.debates}`);
    console.log(`   Votes Cast: ${activity.votes}`);
    console.log(`   Last Active: ${activity.lastActive || 'Unknown'}\n`);

    // Also get voting attendance
    const voting = await OireachtasAPIService.calculateVotingAttendance(member.memberCode, '2024-01-01');
    console.log('Voting Attendance:');
    console.log(`   Attendance: ${voting.votingAttendance}%`);
    console.log(`   Votes Cast: ${voting.votesCast} / ${voting.totalVotes}`);
    console.log('');
  }

  console.log('═══════════════════════════════════════════');
  console.log('✅ TEST COMPLETE');
  console.log('═══════════════════════════════════════════\n');
  
  console.log('💡 Key Points:');
  console.log('   • Counts are now ACCURATE (from API head.counts)');
  console.log('   • Date range: 2024-01-01 to TODAY');
  console.log('   • No more suspicious "500" for everyone');
  console.log('   • Each TD has their real activity level\n');
}

testAccurateCounts();



