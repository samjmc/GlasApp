/**
 * Debug Unmatched TDs
 * Shows which TDs from the API aren't matching in our database
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000,
  headers: {
    'User-Agent': 'GlasPolitics/1.0',
    'Accept': 'application/json'
  }
});

async function debugUnmatched() {
  console.log('🔍 DEBUGGING UNMATCHED TDs');
  console.log('═'.repeat(70));
  console.log('Finding which TDs from questions arent matching our database\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Get our TDs
  const { data: dbTDs } = await supabase
    .from('td_scores')
    .select('id, politician_name, member_code, member_uri');

  console.log(`📊 Database has ${dbTDs?.length} TDs`);
  console.log(`   - ${dbTDs?.filter(td => td.member_uri).length} with member_uri`);
  console.log(`   - ${dbTDs?.filter(td => !td.member_uri).length} without member_uri\n`);

  // Create lookup
  const tdLookup = new Map<string, any>();
  dbTDs?.forEach(td => {
    if (td.member_uri) tdLookup.set(td.member_uri, td);
    if (td.member_code) {
      tdLookup.set(`/ie/oireachtas/member/${td.member_code}`, td);
      tdLookup.set(`/ie/oireachtas/member/id/${td.member_code}`, td);
      tdLookup.set(`https://data.oireachtas.ie/ie/oireachtas/member/id/${td.member_code}`, td);
      tdLookup.set(`https://data.oireachtas.ie/ie/oireachtas/member/${td.member_code}`, td);
    }
  });

  // Fetch recent questions
  console.log('📥 Fetching recent questions...');
  const response = await apiClient.get('/questions', {
    params: {
      date_start: '2025-10-19',
      limit: 500
    }
  });

  const questions = response.data.results || [];
  console.log(`✅ Fetched ${questions.length} questions\n`);

  // Track unique unmatched members
  const unmatchedMembers = new Map<string, any>();

  for (const result of questions) {
    const q = result.question;
    const memberUri = q.by?.uri;
    const memberName = q.by?.showAs;
    const memberCode = q.by?.memberCode;

    if (!memberUri) continue;

    const td = tdLookup.get(memberUri);

    if (!td && memberUri) {
      if (!unmatchedMembers.has(memberUri)) {
        unmatchedMembers.set(memberUri, {
          name: memberName,
          uri: memberUri,
          code: memberCode,
          count: 1
        });
      } else {
        unmatchedMembers.get(memberUri)!.count++;
      }
    }
  }

  console.log('❌ UNMATCHED TDs FROM API:');
  console.log('═'.repeat(70));
  
  const sorted = Array.from(unmatchedMembers.values())
    .sort((a, b) => b.count - a.count);

  sorted.forEach((member, i) => {
    console.log(`${(i + 1).toString().padStart(3)}. ${member.name.padEnd(35)} (${member.count} questions)`);
    console.log(`     URI: ${member.uri}`);
    console.log(`     Code: ${member.code}`);
    
    // Check if exists in DB without member_uri
    const dbMatch = dbTDs?.find(td => 
      td.politician_name.toLowerCase() === member.name.toLowerCase()
    );
    
    if (dbMatch) {
      console.log(`     ⚠️  EXISTS IN DB but missing member_uri (ID: ${dbMatch.id})`);
    } else {
      console.log(`     ❌ NOT IN DATABASE AT ALL`);
    }
    console.log('');
  });

  console.log('═'.repeat(70));
  console.log(`Total unique unmatched TDs: ${unmatchedMembers.size}`);
  console.log('═'.repeat(70));
  
  // Summary
  console.log('\n📊 SUMMARY:');
  const inDbNoUri = sorted.filter(m => 
    dbTDs?.some(td => td.politician_name.toLowerCase() === m.name.toLowerCase())
  ).length;
  const notInDb = sorted.filter(m => 
    !dbTDs?.some(td => td.politician_name.toLowerCase() === m.name.toLowerCase())
  ).length;
  
  console.log(`   In database but missing member_uri: ${inDbNoUri}`);
  console.log(`   Not in database at all: ${notInDb}`);
  console.log('');
  console.log('💡 FIX:');
  console.log('   Run the member matching script again to populate member_uri');
  console.log('   for the TDs that are in the database but missing URIs');
}

debugUnmatched().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

