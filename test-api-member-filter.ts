/**
 * TEST IF MEMBER PARAMETER ACTUALLY FILTERS
 */

import axios from 'axios';

async function testMemberFilter() {
  console.log('🔍 TESTING IF MEMBER PARAMETER FILTERS CORRECTLY');
  console.log('═══════════════════════════════════════════\n');

  const api = axios.create({
    baseURL: 'https://api.oireachtas.ie/v1',
    timeout: 30000
  });

  // Test 1: No member filter (all questions)
  console.log('1️⃣  Query WITHOUT member filter');
  console.log('───────────────────────────────────────────');
  try {
    const resp = await api.get('/questions', {
      params: {
        date_start: '2025-10-01',
        date_end: '2025-10-31',
        limit: 10
      }
    });

    console.log(`   Results: ${resp.data.results?.length}`);
    console.log(`   Sample TDs who asked:`, resp.data.results?.slice(0, 3).map((r: any) => r.question?.by?.showAs));
    console.log('');
  } catch (e: any) {
    console.log(`   Error: ${e.message}\n`);
  }

  // Test 2: WITH member filter
  console.log('2️⃣  Query WITH member filter (Mary Lou)');
  console.log('───────────────────────────────────────────');
  try {
    const resp = await api.get('/questions', {
      params: {
        member: 'Mary-Lou-McDonald.D.2011-03-09',
        date_start: '2025-10-01',
        date_end: '2025-10-31',
        limit: 10
      }
    });

    console.log(`   Results: ${resp.data.results?.length}`);
    console.log(`   All from Mary Lou?`, resp.data.results?.every((r: any) => r.question?.by?.showAs?.includes('McDonald')));
    console.log(`   Sample:`, resp.data.results?.slice(0, 3).map((r: any) => r.question?.by?.showAs));
    console.log('');
  } catch (e: any) {
    console.log(`   Error: ${e.message}\n`);
  }

  // Test 3: Different member filter
  console.log('3️⃣  Query WITH member filter (Simon Harris)');
  console.log('───────────────────────────────────────────');
  try {
    const resp = await api.get('/questions', {
      params: {
        member: 'Simon-Harris.D.2011-03-09',
        date_start: '2025-10-01',
        date_end: '2025-10-31',
        limit: 10
      }
    });

    console.log(`   Results: ${resp.data.results?.length}`);
    console.log(`   All from Simon Harris?`, resp.data.results?.every((r: any) => r.question?.by?.showAs?.includes('Harris')));
    console.log(`   Sample:`, resp.data.results?.slice(0, 3).map((r: any) => r.question?.by?.showAs));
    console.log('');
  } catch (e: any) {
    console.log(`   Error: ${e.message}\n`);
  }

  // Test 4: Check actual question authors
  console.log('4️⃣  Direct Comparison - Same Date Range, Different Members');
  console.log('───────────────────────────────────────────');
  
  const members = [
    { name: 'Mary Lou', code: 'Mary-Lou-McDonald.D.2011-03-09' },
    { name: 'Simon Harris', code: 'Simon-Harris.D.2011-03-09' }
  ];

  for (const m of members) {
    try {
      const resp = await api.get('/questions', {
        params: {
          member: m.code,
          date_start: '2024-10-01',
          date_end: '2024-10-31',
          limit: 5
        }
      });

      const results = resp.data.results || [];
      console.log(`\n   ${m.name}:`);
      console.log(`     Retrieved: ${results.length} questions`);
      results.forEach((r: any, idx: number) => {
        console.log(`     ${idx + 1}. Asked by: ${r.question.by?.showAs}`);
        console.log(`        Date: ${r.question.date}`);
        console.log(`        Type: ${r.question.questionType}`);
      });
    } catch (e: any) {
      console.log(`\n   ${m.name}: Error`);
    }
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('💡 DIAGNOSIS:');
  console.log('═══════════════════════════════════════════\n');
  console.log('If questions show different authors per query:');
  console.log('  ✅ Member filter is working\n');
  console.log('If all questions show same authors:');
  console.log('  ❌ Member filter NOT working - API bug or wrong parameter\n');
}

testMemberFilter();



