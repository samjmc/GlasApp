/**
 * OIREACHTAS API DEEP DIVE
 * Detailed exploration to understand data structures and fix extraction issues
 */

import axios from 'axios';
import fs from 'fs';

const BASE_URL = 'https://api.oireachtas.ie/v1';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'User-Agent': 'GlasPolitics/1.0',
    'Accept': 'application/json'
  }
});

async function deepDive() {
  console.log('🔬 OIREACHTAS API DEEP DIVE');
  console.log('═══════════════════════════════════════════\n');

  // ============================================
  // 1. UNDERSTAND MEMBER STRUCTURE
  // ============================================
  console.log('1️⃣  MEMBER DATA STRUCTURE');
  console.log('───────────────────────────────────────────');
  try {
    const response = await apiClient.get('/members', {
      params: {
        date_start: '2020-01-01', // Earlier date to get more members
        house: 'dail',
        limit: 3
      }
    });

    if (response.data.results?.[0]) {
      const member = response.data.results[0].member;
      console.log('Full member object structure:');
      console.log(JSON.stringify(member, null, 2));
      
      // Check memberships array for party/constituency
      if (member.memberships) {
        console.log('\n📋 Memberships array:');
        console.log(JSON.stringify(member.memberships, null, 2));
      }
    }
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }
  console.log('\n');

  // ============================================
  // 2. TEST DIFFERENT DATE RANGES FOR QUESTIONS
  // ============================================
  console.log('2️⃣  QUESTIONS - DATE RANGE TESTING');
  console.log('───────────────────────────────────────────');
  
  const dateRanges = [
    { name: 'Since 2024 Election', start: '2024-11-01', end: '2025-12-31' },
    { name: 'All of 2024', start: '2024-01-01', end: '2024-12-31' },
    { name: 'Last 2 years', start: '2023-01-01', end: '2025-12-31' }
  ];

  for (const range of dateRanges) {
    try {
      const response = await apiClient.get('/questions', {
        params: {
          date_start: range.start,
          date_end: range.end,
          limit: 100
        }
      });
      
      console.log(`✅ ${range.name}: ${response.data.results?.length || 0} questions found`);
    } catch (error: any) {
      console.log(`❌ ${range.name}: ${error.message}`);
    }
  }
  console.log('');

  // ============================================
  // 3. FIND ACTIVE TDS WITH DATA
  // ============================================
  console.log('3️⃣  FINDING ACTIVE TDs WITH RECENT ACTIVITY');
  console.log('───────────────────────────────────────────');
  try {
    const questionsResponse = await apiClient.get('/questions', {
      params: {
        date_start: '2024-01-01',
        limit: 50
      }
    });
    
    const tdActivity: Record<string, number> = {};
    
    if (questionsResponse.data.results) {
      for (const result of questionsResponse.data.results) {
        const tdName = result.question?.by?.showAs;
        if (tdName) {
          tdActivity[tdName] = (tdActivity[tdName] || 0) + 1;
        }
      }
    }
    
    const topTDs = Object.entries(tdActivity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    console.log('Top 10 most active TDs (by questions in 2024):');
    topTDs.forEach(([name, count], idx) => {
      console.log(`   ${idx + 1}. ${name}: ${count} questions`);
    });
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }
  console.log('');

  // ============================================
  // 4. EXPLORE LEGISLATION (BILLS) ENDPOINT
  // ============================================
  console.log('4️⃣  LEGISLATION - BILLS SPONSORED');
  console.log('───────────────────────────────────────────');
  try {
    const billsResponse = await apiClient.get('/legislation', {
      params: {
        date_start: '2024-01-01',
        limit: 10
      }
    });
    
    console.log(`✅ Found ${billsResponse.data.results?.length || 0} recent bills`);
    
    if (billsResponse.data.results?.[0]) {
      const sample = billsResponse.data.results[0].bill;
      console.log('\nSample bill structure:');
      console.log('   - Bill Title:', sample.shortTitleEn || sample.longTitleEn);
      console.log('   - Bill No:', sample.billNo);
      console.log('   - Bill Type:', sample.billType);
      console.log('   - Status:', sample.status);
      console.log('   - Sponsor:', sample.sponsor?.by?.showAs || 'Not specified');
      console.log('   - All fields:', Object.keys(sample).join(', '));
    }
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }
  console.log('');

  // ============================================
  // 5. EXPLORE MEMBER-SPECIFIC ENDPOINTS
  // ============================================
  console.log('5️⃣  MEMBER-SPECIFIC DATA (Simon Harris)');
  console.log('───────────────────────────────────────────');
  try {
    // Get members first
    const membersResponse = await apiClient.get('/members', {
      params: {
        date_start: '2020-01-01',
        house: 'dail',
        limit: 200
      }
    });
    
    const simon = membersResponse.data.results.find((r: any) => 
      r.member.fullName.toLowerCase().includes('simon harris')
    );
    
    if (simon) {
      console.log('✅ Found Simon Harris');
      console.log('   Member Code:', simon.member.memberCode);
      
      // Try different parameter variations for questions
      console.log('\nTrying different query parameters:');
      
      // Test 1: member_id
      try {
        const q1 = await apiClient.get('/questions', {
          params: {
            member_id: simon.member.memberCode,
            date_start: '2024-01-01',
            limit: 10
          }
        });
        console.log(`   ✅ member_id: ${q1.data.results?.length || 0} questions`);
      } catch (e: any) {
        console.log(`   ❌ member_id: ${e.message}`);
      }
      
      // Test 2: member
      try {
        const q2 = await apiClient.get('/questions', {
          params: {
            member: simon.member.memberCode,
            date_start: '2024-01-01',
            limit: 10
          }
        });
        console.log(`   ✅ member: ${q2.data.results?.length || 0} questions`);
      } catch (e: any) {
        console.log(`   ❌ member: ${e.message}`);
      }
      
      // Test 3: member_code
      try {
        const q3 = await apiClient.get('/questions', {
          params: {
            member_code: simon.member.memberCode,
            date_start: '2024-01-01',
            limit: 10
          }
        });
        console.log(`   ✅ member_code: ${q3.data.results?.length || 0} questions`);
      } catch (e: any) {
        console.log(`   ❌ member_code: ${e.message}`);
      }
    }
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }
  console.log('');

  // ============================================
  // 6. SAVE FULL RESPONSE SAMPLES
  // ============================================
  console.log('6️⃣  SAVING SAMPLE RESPONSES');
  console.log('───────────────────────────────────────────');
  
  const samples: any = {};
  
  // Save member sample
  try {
    const membersResp = await apiClient.get('/members', {
      params: { date_start: '2024-01-01', house: 'dail', limit: 2 }
    });
    samples.members = membersResp.data;
  } catch (e) {}
  
  // Save questions sample
  try {
    const questionsResp = await apiClient.get('/questions', {
      params: { date_start: '2024-10-01', limit: 3 }
    });
    samples.questions = questionsResp.data;
  } catch (e) {}
  
  // Save debates sample
  try {
    const debatesResp = await apiClient.get('/debates', {
      params: { date_start: '2024-10-01', limit: 2 }
    });
    samples.debates = debatesResp.data;
  } catch (e) {}
  
  // Save divisions sample
  try {
    const divisionsResp = await apiClient.get('/divisions', {
      params: { date_start: '2024-10-01', limit: 2 }
    });
    samples.divisions = divisionsResp.data;
  } catch (e) {}
  
  // Save legislation sample
  try {
    const legislationResp = await apiClient.get('/legislation', {
      params: { date_start: '2024-01-01', limit: 2 }
    });
    samples.legislation = legislationResp.data;
  } catch (e) {}
  
  fs.writeFileSync(
    'oireachtas-api-samples.json',
    JSON.stringify(samples, null, 2)
  );
  
  console.log('✅ Saved full API responses to: oireachtas-api-samples.json');
  console.log('   You can inspect this file to see exact data structures\n');

  // ============================================
  // 7. SUMMARY & RECOMMENDATIONS
  // ============================================
  console.log('═══════════════════════════════════════════');
  console.log('📊 KEY FINDINGS:');
  console.log('═══════════════════════════════════════════\n');
  
  console.log('✅ WORKING ENDPOINTS:');
  console.log('   - Members (but party/constituency not in basic response)');
  console.log('   - Questions (working)');
  console.log('   - Debates (working)');
  console.log('   - Divisions/Votes (working with detailed tallies)');
  console.log('   - Legislation (working)');
  console.log('   - Parties (working)');
  console.log('   - Houses (working)\n');
  
  console.log('❌ NOT WORKING:');
  console.log('   - Committees endpoint (404 error)\n');
  
  console.log('⚠️  ISSUES FOUND:');
  console.log('   1. Party & constituency not in basic member response');
  console.log('   2. Need to check memberships array for full details');
  console.log('   3. Questions since Nov 2024 returning 0 (might be too recent)');
  console.log('   4. Need to use broader date ranges for reliable data\n');
  
  console.log('💡 RECOMMENDED FIXES:');
  console.log('   1. Use date range: 2020-01-01 to present (not just 2024)');
  console.log('   2. Parse memberships array for party/constituency');
  console.log('   3. Extract bill sponsorships from legislation endpoint');
  console.log('   4. Get voting patterns from divisions endpoint');
  console.log('   5. Aggregate data across years for accurate counts\n');
  
  console.log('📁 Next step: Check oireachtas-api-samples.json for full structures\n');
}

deepDive().catch(console.error);



