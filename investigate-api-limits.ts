/**
 * INVESTIGATE API LIMITS & SUSPICIOUS DATA
 * Why are all TDs showing exactly 500 questions?
 */

import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000,
  headers: {
    'User-Agent': 'GlasPolitics/1.0',
    'Accept': 'application/json'
  }
});

async function investigate() {
  console.log('🔍 INVESTIGATING SUSPICIOUS 500 QUESTION COUNT');
  console.log('═══════════════════════════════════════════\n');

  // Test different limits
  console.log('1️⃣  Testing API Limits');
  console.log('───────────────────────────────────────────');
  
  const limits = [50, 100, 500, 1000, 5000];
  
  for (const limit of limits) {
    try {
      const response = await apiClient.get('/questions', {
        params: {
          date_start: '2020-01-01',
          limit: limit
        }
      });
      
      const count = response.data.results?.length || 0;
      const hasMore = response.data.head?.counts;
      
      console.log(`   Limit ${limit}: Got ${count} results`);
      console.log(`   Total available: ${hasMore?.questionCount || 'Unknown'}`);
      console.log(`   Hit limit: ${count === limit ? 'YES ⚠️' : 'No'}\n`);
    } catch (error: any) {
      console.log(`   Limit ${limit}: ERROR - ${error.message}\n`);
    }
  }

  // Check pagination support
  console.log('2️⃣  Checking Pagination Support');
  console.log('───────────────────────────────────────────');
  
  try {
    const response = await apiClient.get('/questions', {
      params: {
        date_start: '2024-01-01',
        limit: 10
      }
    });
    
    console.log('Response headers:', Object.keys(response.headers));
    console.log('Response data structure:', Object.keys(response.data));
    
    if (response.data.head) {
      console.log('Head data:', JSON.stringify(response.data.head, null, 2));
    }
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }
  console.log('');

  // Test specific TD with different date ranges
  console.log('3️⃣  Testing Mary Lou McDonald - Different Date Ranges');
  console.log('───────────────────────────────────────────');
  
  const dateRanges = [
    { name: 'All time', start: '2011-01-01', end: '2025-12-31' },
    { name: 'Current term', start: '2020-06-01', end: '2025-12-31' },
    { name: '2024 only', start: '2024-01-01', end: '2024-12-31' },
    { name: '2023 only', start: '2023-01-01', end: '2023-12-31' }
  ];

  for (const range of dateRanges) {
    try {
      const response = await apiClient.get('/questions', {
        params: {
          member: 'Mary-Lou-McDonald.D.2011-03-09',
          date_start: range.start,
          date_end: range.end,
          limit: 5000
        }
      });
      
      const count = response.data.results?.length || 0;
      console.log(`   ${range.name}: ${count} questions`);
    } catch (error: any) {
      console.log(`   ${range.name}: ERROR`);
    }
  }
  console.log('');

  // Check if we're hitting limit consistently
  console.log('4️⃣  Testing Multiple TDs for Limit Pattern');
  console.log('───────────────────────────────────────────');
  
  const testTDs = [
    'Mary-Lou-McDonald.D.2011-03-09',
    'Simon-Harris.D.2011-03-09',
    'Paschal-Donohoe.D.2002-06-06'
  ];

  for (const memberCode of testTDs) {
    try {
      const response = await apiClient.get('/questions', {
        params: {
          member: memberCode,
          date_start: '2020-01-01',
          limit: 600  // Try 600 instead of 500
        }
      });
      
      const count = response.data.results?.length || 0;
      const totalAvailable = response.data.head?.counts?.questionCount;
      
      console.log(`   ${memberCode.split('.')[0]}:`);
      console.log(`     Retrieved: ${count}`);
      console.log(`     Total available: ${totalAvailable || 'Unknown'}`);
      console.log(`     Hit limit: ${count === 500 || count === 600 ? 'YES ⚠️' : 'No'}\n`);
    } catch (error: any) {
      console.log(`   ${memberCode}: ERROR\n`);
    }
  }

  console.log('═══════════════════════════════════════════');
  console.log('💡 FINDINGS:');
  console.log('═══════════════════════════════════════════\n');
  console.log('If all TDs show exactly 500 questions:');
  console.log('→ We are hitting the API limit (500 per request)');
  console.log('→ Need to use pagination or multiple date range queries');
  console.log('→ Total count is in response.data.head.counts.questionCount\n');
  
  console.log('Solutions:');
  console.log('1. Split queries by year (2020, 2021, 2022, 2023, 2024)');
  console.log('2. Use offset/skip parameters if supported');
  console.log('3. Accept 500 limit and show "500+" for very active TDs\n');
}

investigate();



