/**
 * EXPLORE OIREACHTAS API
 * Tests different endpoints to see what data is available
 * Run with: npx tsx explore-oireachtas-api.ts
 */

import axios from 'axios';

const BASE_URL = 'https://api.oireachtas.ie/v1';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'User-Agent': 'GlasPolitics/1.0 (Research)',
    'Accept': 'application/json'
  }
});

async function exploreAPI() {
  console.log('🔍 EXPLORING OIREACHTAS API');
  console.log('═══════════════════════════════════════════\n');

  // ============================================
  // 1. MEMBERS ENDPOINT
  // ============================================
  console.log('1️⃣  MEMBERS ENDPOINT');
  console.log('───────────────────────────────────────────');
  try {
    const membersResponse = await apiClient.get('/members', {
      params: {
        date_start: '2024-11-01',
        house: 'dail',
        limit: 5
      }
    });
    
    console.log('✅ /members endpoint works!');
    console.log(`   Total results: ${membersResponse.data.results?.length || 0}`);
    if (membersResponse.data.results?.[0]) {
      const sample = membersResponse.data.results[0].member;
      console.log('   Sample member structure:');
      console.log('   - fullName:', sample.fullName);
      console.log('   - party:', sample.represent?.represent);
      console.log('   - constituency:', sample.represent?.representCode);
      console.log('   - memberCode:', sample.memberCode);
      console.log('   - Available fields:', Object.keys(sample).join(', '));
    }
  } catch (error: any) {
    console.log('❌ Members endpoint error:', error.message);
  }
  console.log('');

  // ============================================
  // 2. QUESTIONS ENDPOINT
  // ============================================
  console.log('2️⃣  QUESTIONS ENDPOINT');
  console.log('───────────────────────────────────────────');
  try {
    const questionsResponse = await apiClient.get('/questions', {
      params: {
        date_start: '2024-11-01',
        limit: 5
      }
    });
    
    console.log('✅ /questions endpoint works!');
    console.log(`   Total results: ${questionsResponse.data.results?.length || 0}`);
    if (questionsResponse.data.results?.[0]) {
      const sample = questionsResponse.data.results[0].question;
      console.log('   Sample question structure:');
      console.log('   - questionId:', sample.questionId);
      console.log('   - by:', sample.by?.showAs);
      console.log('   - questionType:', sample.questionType);
      console.log('   - date:', sample.date);
      console.log('   - subject:', sample.showAs || sample.subject);
      console.log('   - Available fields:', Object.keys(sample).join(', '));
    }
  } catch (error: any) {
    console.log('❌ Questions endpoint error:', error.message);
  }
  console.log('');

  // ============================================
  // 3. DEBATES ENDPOINT
  // ============================================
  console.log('3️⃣  DEBATES ENDPOINT');
  console.log('───────────────────────────────────────────');
  try {
    const debatesResponse = await apiClient.get('/debates', {
      params: {
        date_start: '2024-11-01',
        limit: 5
      }
    });
    
    console.log('✅ /debates endpoint works!');
    console.log(`   Total results: ${debatesResponse.data.results?.length || 0}`);
    if (debatesResponse.data.results?.[0]) {
      const sample = debatesResponse.data.results[0];
      console.log('   Sample debate structure:');
      console.log('   - Available fields:', Object.keys(sample).join(', '));
      if (sample.debate) {
        console.log('   - debateId:', sample.debate.debateId);
        console.log('   - date:', sample.debate.date);
        console.log('   - debateType:', sample.debate.debateType);
        console.log('   - showAs:', sample.debate.showAs);
      }
    }
  } catch (error: any) {
    console.log('❌ Debates endpoint error:', error.message);
  }
  console.log('');

  // ============================================
  // 4. DIVISIONS (Votes) ENDPOINT
  // ============================================
  console.log('4️⃣  DIVISIONS (Votes) ENDPOINT');
  console.log('───────────────────────────────────────────');
  try {
    const divisionsResponse = await apiClient.get('/divisions', {
      params: {
        date_start: '2024-11-01',
        limit: 5
      }
    });
    
    console.log('✅ /divisions endpoint works!');
    console.log(`   Total results: ${divisionsResponse.data.results?.length || 0}`);
    if (divisionsResponse.data.results?.[0]) {
      const sample = divisionsResponse.data.results[0];
      console.log('   Sample division structure:');
      console.log('   - Available fields:', Object.keys(sample).join(', '));
      if (sample.division) {
        console.log('   - divisionId:', sample.division.divisionId);
        console.log('   - date:', sample.division.date);
        console.log('   - subject:', sample.division.subject);
        console.log('   - tallies:', sample.division.tallies);
      }
    }
  } catch (error: any) {
    console.log('❌ Divisions endpoint error:', error.message);
  }
  console.log('');

  // ============================================
  // 5. BILLS/LEGISLATION ENDPOINT
  // ============================================
  console.log('5️⃣  LEGISLATION ENDPOINT');
  console.log('───────────────────────────────────────────');
  try {
    const legislationResponse = await apiClient.get('/legislation', {
      params: {
        date_start: '2024-01-01',
        limit: 5
      }
    });
    
    console.log('✅ /legislation endpoint works!');
    console.log(`   Total results: ${legislationResponse.data.results?.length || 0}`);
    if (legislationResponse.data.results?.[0]) {
      const sample = legislationResponse.data.results[0];
      console.log('   Sample legislation structure:');
      console.log('   - Available fields:', Object.keys(sample).join(', '));
      if (sample.bill) {
        console.log('   - billNo:', sample.bill.billNo);
        console.log('   - billType:', sample.bill.billType);
        console.log('   - sponsor:', sample.bill.sponsor);
        console.log('   - shortTitleEn:', sample.bill.shortTitleEn);
        console.log('   - status:', sample.bill.status);
      }
    }
  } catch (error: any) {
    console.log('❌ Legislation endpoint error:', error.message);
  }
  console.log('');

  // ============================================
  // 6. COMMITTEES ENDPOINT
  // ============================================
  console.log('6️⃣  COMMITTEES ENDPOINT');
  console.log('───────────────────────────────────────────');
  try {
    const committeesResponse = await apiClient.get('/committees', {
      params: {
        limit: 5
      }
    });
    
    console.log('✅ /committees endpoint works!');
    console.log(`   Total results: ${committeesResponse.data.results?.length || 0}`);
    if (committeesResponse.data.results?.[0]) {
      const sample = committeesResponse.data.results[0];
      console.log('   Sample committee structure:');
      console.log('   - Available fields:', Object.keys(sample).join(', '));
      if (sample.committee) {
        console.log('   - committeeCode:', sample.committee.committeeCode);
        console.log('   - showAs:', sample.committee.showAs);
      }
    }
  } catch (error: any) {
    console.log('❌ Committees endpoint error:', error.message);
  }
  console.log('');

  // ============================================
  // 7. HOUSES ENDPOINT
  // ============================================
  console.log('7️⃣  HOUSES ENDPOINT');
  console.log('───────────────────────────────────────────');
  try {
    const housesResponse = await apiClient.get('/houses');
    
    console.log('✅ /houses endpoint works!');
    console.log(`   Total results: ${housesResponse.data.results?.length || 0}`);
    if (housesResponse.data.results) {
      console.log('   Available houses:', housesResponse.data.results.map((r: any) => r.house?.showAs || r.house?.houseCode).join(', '));
    }
  } catch (error: any) {
    console.log('❌ Houses endpoint error:', error.message);
  }
  console.log('');

  // ============================================
  // 8. PARTIES ENDPOINT
  // ============================================
  console.log('8️⃣  PARTIES ENDPOINT');
  console.log('───────────────────────────────────────────');
  try {
    const partiesResponse = await apiClient.get('/parties', {
      params: {
        limit: 20
      }
    });
    
    console.log('✅ /parties endpoint works!');
    console.log(`   Total results: ${partiesResponse.data.results?.length || 0}`);
    if (partiesResponse.data.results) {
      console.log('   Irish parties found:');
      partiesResponse.data.results.forEach((r: any) => {
        const party = r.party;
        console.log(`   - ${party.showAs || party.partyCode}`);
      });
    }
  } catch (error: any) {
    console.log('❌ Parties endpoint error:', error.message);
  }
  console.log('');

  // ============================================
  // 9. TEST SPECIFIC MEMBER
  // ============================================
  console.log('9️⃣  TEST SPECIFIC MEMBER (Mary Lou McDonald)');
  console.log('───────────────────────────────────────────');
  try {
    const members = await apiClient.get('/members', {
      params: {
        date_start: '2024-11-01',
        house: 'dail',
        limit: 200
      }
    });
    
    const maryLou = members.data.results.find((r: any) => 
      r.member.fullName.toLowerCase().includes('mary lou')
    );
    
    if (maryLou) {
      console.log('✅ Found Mary Lou McDonald');
      console.log('   Full data available:');
      console.log('   - Full Name:', maryLou.member.fullName);
      console.log('   - Member Code:', maryLou.member.memberCode);
      console.log('   - Party:', maryLou.member.represent?.represent);
      console.log('   - Constituency:', maryLou.member.represent?.representCode);
      
      // Get her questions
      const questions = await apiClient.get('/questions', {
        params: {
          member_id: maryLou.member.memberCode,
          date_start: '2024-11-01',
          limit: 10
        }
      });
      
      console.log(`   - Questions asked (since Nov 2024): ${questions.data.results?.length || 0}`);
      
      // Get her debates
      const debates = await apiClient.get('/debates', {
        params: {
          member_id: maryLou.member.memberCode,
          date_start: '2024-11-01',
          limit: 10
        }
      });
      
      console.log(`   - Debates participated: ${debates.data.results?.length || 0}`);
      
      // Get her votes
      const votes = await apiClient.get('/divisions', {
        params: {
          member_id: maryLou.member.memberCode,
          date_start: '2024-11-01',
          limit: 10
        }
      });
      
      console.log(`   - Votes cast: ${votes.data.results?.length || 0}`);
    }
  } catch (error: any) {
    console.log('❌ Error testing member:', error.message);
  }
  console.log('');

  console.log('═══════════════════════════════════════════');
  console.log('✅ API EXPLORATION COMPLETE!');
  console.log('═══════════════════════════════════════════\n');
  
  console.log('📋 SUMMARY OF AVAILABLE DATA:');
  console.log('1. Members - Get all TDs with party & constituency');
  console.log('2. Questions - Parliamentary questions (oral & written)');
  console.log('3. Debates - Debate participation');
  console.log('4. Divisions - Voting record');
  console.log('5. Legislation - Bills sponsored & supported');
  console.log('6. Committees - Committee membership & activity');
  console.log('7. Parties - Political party information');
  console.log('8. Houses - Dáil & Seanad info\n');
  
  console.log('💡 RECOMMENDED DATA TO EXTRACT:');
  console.log('- ✅ Questions asked (already extracting)');
  console.log('- ✅ Debates participated (already extracting)');
  console.log('- ✅ Votes cast (already extracting)');
  console.log('- 🆕 Bills sponsored (NEW - shows legislative initiative)');
  console.log('- 🆕 Committee memberships (NEW - shows expertise areas)');
  console.log('- 🆕 Voting patterns (NEW - shows consistency)');
  console.log('- 🆕 Debate topics (NEW - shows focus areas)\n');
}

exploreAPI().catch(console.error);



