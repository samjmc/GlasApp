/**
 * UPDATE ALL TDs WITH ENHANCED OIREACHTAS DATA
 * Populates party, constituency, committees, bills, voting data for all TDs
 * Run with: npx tsx update-all-tds-enhanced.ts
 * 
 * Estimated time: 15-25 minutes (138 TDs * ~10 seconds each)
 */

import { createClient } from '@supabase/supabase-js';
import { OireachtasAPIService, extractCommitteeMemberships } from './server/services/oireachtasAPIService';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://ospxqnxlotakujloltqy.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function updateAllTDs() {
  console.log('🚀 UPDATING ALL TDs WITH ENHANCED DATA');
  console.log('═══════════════════════════════════════════');
  console.log('This will take approximately 15-25 minutes...\n');

  let updated = 0;
  let errors = 0;
  let skipped = 0;

  try {
    // Step 1: Get all current Dáil members
    console.log('1️⃣  Fetching all current Dáil members...');
    const members = await OireachtasAPIService.getCurrentDailMembers();
    console.log(`✅ Found ${members.length} current Dáil TDs\n`);

    // Step 2: Get full member data (with memberships for committees)
    console.log('2️⃣  Fetching full member data with committees...');
    const fullDataResponse = await axios.get('https://api.oireachtas.ie/v1/members', {
      params: {
        date_start: '2020-01-01',
        house: 'dail',
        limit: 250
      }
    });
    
    const fullMembers = new Map();
    if (fullDataResponse.data?.results) {
      for (const result of fullDataResponse.data.results) {
        fullMembers.set(result.member.fullName, result.member);
      }
    }
    console.log(`✅ Loaded full data for ${fullMembers.size} members\n`);

    // Step 3: Process each TD
    console.log('3️⃣  Processing TDs (this will take a while)...');
    console.log('───────────────────────────────────────────\n');

    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const progress = `[${i + 1}/${members.length}]`;
      
      try {
        console.log(`${progress} Processing ${member.fullName}...`);

        // Get parliamentary activity
        const activity = await OireachtasAPIService.getCompleteMemberActivity(member);
        
        // Get committees
        const fullMember = fullMembers.get(member.fullName);
        const committees = fullMember ? extractCommitteeMemberships(fullMember) : [];
        
        // Get bills (more expensive, skip for now or do selectively)
        // const bills = await OireachtasAPIService.getMemberBills(member.fullName);
        const bills: any[] = []; // TODO: Enable after testing
        
        // Get voting attendance (expensive, use cached activity.votes)
        const votingAttendance = activity.votes > 0 ? 
          Math.min(100, Math.round((activity.votes / 800) * 100)) : 0;  // Rough estimate
        
        // Update database
        const { error } = await supabase
          .from('td_scores')
          .update({
            party: member.party,
            constituency: member.constituency,
            questions_asked: activity.questionsAsked,
            oral_questions: activity.oralQuestions,
            written_questions: activity.writtenQuestions,
            committee_memberships: committees,
            bills_sponsored: bills.length,
            bills_details: bills,
            voting_attendance_pct: votingAttendance,
            votes_cast: activity.votes,
            last_parliamentary_activity: activity.lastActive,
            last_updated: new Date().toISOString()
          })
          .eq('politician_name', member.fullName);

        if (error) {
          console.log(`   ❌ Database error: ${error.message}`);
          errors++;
        } else {
          console.log(`   ✅ Updated - ${activity.questionsAsked} questions, ${committees.length} committees`);
          updated++;
        }

        // Rate limiting - don't overwhelm API
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between TDs

      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
        errors++;
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════');
    console.log('✅ UPDATE COMPLETE!');
    console.log('═══════════════════════════════════════════\n');
    console.log(`📊 Results:`);
    console.log(`   ✅ Successfully updated: ${updated} TDs`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   ⏭️  Skipped: ${skipped}\n`);
    
    console.log('🎯 What Was Updated:');
    console.log('   ✅ Party & Constituency (from memberships array)');
    console.log('   ✅ Questions asked (oral vs written breakdown)');
    console.log('   ✅ Committee memberships (name, role, type)');
    console.log('   ✅ Voting participation count');
    console.log('   ✅ Estimated voting attendance %');
    console.log('   ✅ Last parliamentary activity date\n');
    
    console.log('📈 Enhanced TD profiles now include:');
    console.log('   • Detailed question breakdown');
    console.log('   • Committee memberships & roles');
    console.log('   • Voting attendance metrics');
    console.log('   • More accurate party/constituency data\n');
    
    console.log('🌐 View in browser: http://localhost:5000');
    console.log('   Click Rankings tab → Click any TD name\n');

  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
  }
}

updateAllTDs();



