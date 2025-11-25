/**
 * TEST ENHANCED OIREACHTAS DATA EXTRACTION
 * Tests the improved API service with a sample TD
 * Run with: npx tsx test-enhanced-extraction.ts
 */

import { createClient } from '@supabase/supabase-js';
import { OireachtasAPIService, extractCommitteeMemberships } from './server/services/oireachtasAPIService';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://ospxqnxlotakujloltqy.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function testEnhancedExtraction() {
  console.log('🧪 TESTING ENHANCED OIREACHTAS DATA EXTRACTION');
  console.log('═══════════════════════════════════════════\n');

  // Test TD: Simon Harris (prominent, should have lots of data)
  const testTDName = 'Simon Harris';
  
  console.log(`📊 Testing with: ${testTDName}`);
  console.log('───────────────────────────────────────────\n');

  try {
    // Step 1: Get all members (with fixed extraction)
    console.log('1️⃣  Fetching members from API...');
    const members = await OireachtasAPIService.getCurrentDailMembers();
    console.log(`✅ Found ${members.length} current Dáil members\n`);

    // Find our test TD
    const testMember = members.find(m => 
      m.fullName.toLowerCase().includes(testTDName.toLowerCase())
    );

    if (!testMember) {
      console.log(`❌ Could not find ${testTDName}`);
      console.log('Available members:', members.slice(0, 10).map(m => m.fullName));
      return;
    }

    console.log('✅ Found member:', testMember.fullName);
    console.log(`   Party: ${testMember.party || 'Unknown'}`);
    console.log(`   Constituency: ${testMember.constituency || 'Unknown'}`);
    console.log(`   Member Code: ${testMember.memberCode}\n`);

    // Step 2: Get parliamentary activity
    console.log('2️⃣  Fetching parliamentary activity...');
    const activity = await OireachtasAPIService.getCompleteMemberActivity(testMember);
    console.log('✅ Activity data:');
    console.log(`   Questions Asked: ${activity.questionsAsked}`);
    console.log(`   - Oral: ${activity.oralQuestions}`);
    console.log(`   - Written: ${activity.writtenQuestions}`);
    console.log(`   Debates: ${activity.debates}`);
    console.log(`   Votes Cast: ${activity.votes}`);
    console.log(`   Estimated Attendance: ${activity.estimatedAttendance}%`);
    console.log(`   Last Active: ${activity.lastActive || 'Unknown'}\n`);

    // Step 3: Get committees (requires full member object from API)
    console.log('3️⃣  Extracting committee memberships...');
    const fullMemberResponse = await fetch(
      `https://api.oireachtas.ie/v1/members?date_start=2020-01-01&house=dail&limit=250`
    );
    const fullData = await fullMemberResponse.json();
    const fullMember = fullData.results.find((r: any) => 
      r.member.fullName === testMember.fullName
    );
    
    if (fullMember) {
      const committees = extractCommitteeMemberships(fullMember.member);
      console.log(`✅ Committee Memberships: ${committees.length}`);
      committees.forEach(c => {
        console.log(`   - ${c.name}`);
        console.log(`     Role: ${c.role}, Type: ${c.type}`);
      });
    } else {
      console.log('⚠️  Could not get full member data for committees');
    }
    console.log('');

    // Step 4: Get bills sponsored
    console.log('4️⃣  Fetching bills sponsored...');
    const bills = await OireachtasAPIService.getMemberBills(testMember.fullName);
    console.log(`✅ Bills Sponsored: ${bills.length}`);
    bills.forEach(b => {
      console.log(`   - ${b.title} (${b.year})`);
      console.log(`     Status: ${b.status}, Type: ${b.type}`);
    });
    console.log('');

    // Step 5: Calculate voting attendance
    console.log('5️⃣  Calculating voting attendance...');
    const votingData = await OireachtasAPIService.calculateVotingAttendance(
      testMember.memberCode,
      '2024-01-01'
    );
    console.log(`✅ Voting Attendance: ${votingData.votingAttendance}%`);
    console.log(`   Votes Cast: ${votingData.votesCast}`);
    console.log(`   Total Votes: ${votingData.totalVotes}\n`);

    // Step 6: Update database with enhanced data
    console.log('6️⃣  Updating database...');
    
    const committees = fullMember ? extractCommitteeMemberships(fullMember.member) : [];
    
    const { error } = await supabase
      .from('td_scores')
      .update({
        party: testMember.party,
        constituency: testMember.constituency,
        questions_asked: activity.questionsAsked,
        oral_questions: activity.oralQuestions,
        written_questions: activity.writtenQuestions,
        committee_memberships: committees,
        bills_sponsored: bills.length,
        bills_details: bills,
        voting_attendance_pct: votingData.votingAttendance,
        votes_cast: votingData.votesCast,
        last_parliamentary_activity: activity.lastActive,
        last_updated: new Date().toISOString()
      })
      .eq('politician_name', testMember.fullName);

    if (error) {
      console.log('❌ Database update error:', error.message);
    } else {
      console.log(`✅ Database updated for ${testMember.fullName}\n`);
    }

    // Summary
    console.log('═══════════════════════════════════════════');
    console.log('✅ ENHANCED EXTRACTION TEST COMPLETE!');
    console.log('═══════════════════════════════════════════\n');
    
    console.log('📊 Data Extracted:');
    console.log(`   ✅ Party: ${testMember.party || 'Unknown'}`);
    console.log(`   ✅ Constituency: ${testMember.constituency || 'Unknown'}`);
    console.log(`   ✅ Questions: ${activity.questionsAsked} (${activity.oralQuestions} oral, ${activity.writtenQuestions} written)`);
    console.log(`   ✅ Debates: ${activity.debates}`);
    console.log(`   ✅ Votes: ${activity.votes}`);
    console.log(`   ✅ Committees: ${committees.length}`);
    console.log(`   ✅ Bills Sponsored: ${bills.length}`);
    console.log(`   ✅ Voting Attendance: ${votingData.votingAttendance}%`);
    console.log('');
    
    console.log('🎯 Next Steps:');
    console.log('1. Run for all TDs: npx tsx update-all-tds-enhanced.ts');
    console.log('2. View updated profile in browser');
    console.log('3. Check database for new data\n');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testEnhancedExtraction();



