/**
 * Quick test with 3 diverse TDs
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

const testTDs = ['Mary Lou McDonald', 'Paschal Donohoe', 'Eamon Ryan'];

async function quickTest() {
  console.log('🧪 QUICK TEST - 3 Sample TDs');
  console.log('═══════════════════════════════════════════\n');

  // Get all members
  const members = await OireachtasAPIService.getCurrentDailMembers();
  console.log(`✅ Fetched ${members.length} members\n`);

  // Get full data for committees
  const fullDataResponse = await axios.get('https://api.oireachtas.ie/v1/members', {
    params: { date_start: '2020-01-01', house: 'dail', limit: 250 }
  });
  const fullMembers = new Map();
  fullDataResponse.data?.results?.forEach((r: any) => {
    fullMembers.set(r.member.fullName, r.member);
  });

  for (const tdName of testTDs) {
    console.log(`\n📊 ${tdName}`);
    console.log('─'.repeat(50));
    
    const member = members.find(m => m.fullName === tdName);
    if (!member) {
      console.log('❌ Not found in members list');
      continue;
    }

    // Get activity
    const activity = await OireachtasAPIService.getCompleteMemberActivity(member);
    
    // Get committees
    const fullMember = fullMembers.get(member.fullName);
    const committees = fullMember ? extractCommitteeMemberships(fullMember) : [];

    console.log(`✅ Party: ${member.party || 'Unknown'}`);
    console.log(`✅ Constituency: ${member.constituency || 'Unknown'}`);
    console.log(`✅ Questions: ${activity.questionsAsked} (${activity.oralQuestions} oral, ${activity.writtenQuestions} written)`);
    console.log(`✅ Debates: ${activity.debates}`);
    console.log(`✅ Votes: ${activity.votes}`);
    console.log(`✅ Committees: ${committees.length}`);
    
    if (committees.length > 0) {
      committees.forEach(c => console.log(`   - ${c.name} (${c.role})`));
    }

    // Update database
    await supabase
      .from('td_scores')
      .update({
        party: member.party,
        constituency: member.constituency,
        questions_asked: activity.questionsAsked,
        oral_questions: activity.oralQuestions,
        written_questions: activity.writtenQuestions,
        committee_memberships: committees,
        votes_cast: activity.votes,
        last_updated: new Date().toISOString()
      })
      .eq('politician_name', member.fullName);
  }

  console.log('\n✅ Test complete!');
}

quickTest();



