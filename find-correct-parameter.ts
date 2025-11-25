/**
 * FIND THE CORRECT MEMBER FILTER PARAMETER
 */

import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000
});

async function findCorrectParameter() {
  console.log('🔍 FINDING CORRECT MEMBER FILTER PARAMETER');
  console.log('═══════════════════════════════════════════\n');

  const memberCode = 'Mary-Lou-McDonald.D.2011-03-09';
  const memberName = 'Mary Lou McDonald';
  const pId = 'MaryLouMcDonald';
  
  // Try every possible parameter variation
  const paramVariations = [
    { name: 'member', value: memberCode },
    { name: 'member_id', value: memberCode },
    { name: 'member_code', value: memberCode },
    { name: 'memberId', value: memberCode },
    { name: 'memberCode', value: memberCode },
    { name: 'by', value: memberCode },
    { name: 'asked_by', value: memberCode },
    { name: 'member', value: pId },
    { name: 'member_id', value: pId },
    { name: 'member', value: memberName },
    { name: 'member_id', value: memberName }
  ];

  for (const param of paramVariations) {
    try {
      const params: any = {
        date_start: '2024-10-01',
        date_end: '2024-10-31',
        limit: 5
      };
      params[param.name] = param.value;

      const resp = await api.get('/questions', { params });
      const results = resp.data.results || [];
      
      const authors = results.map((r: any) => r.question.by?.showAs);
      const allMaryLou = authors.every((a: string) => a?.includes('McDonald'));
      
      console.log(`${allMaryLou ? '✅' : '❌'} ${param.name}="${param.value.substring(0, 20)}..."`);
      console.log(`   Results: ${results.length}, Authors: ${[...new Set(authors)].join(', ')}\n`);
      
      if (allMaryLou && results.length > 0) {
        console.log('   🎉 THIS PARAMETER WORKS!\n');
      }
    } catch (e: any) {
      console.log(`❌ ${param.name}: Error\n`);
    }
  }

  console.log('═══════════════════════════════════════════\n');
  console.log('🤔 Alternative Approach:');
  console.log('If NO parameter works, we need to:');
  console.log('1. Get ALL questions for a date range');
  console.log('2. Filter by TD name client-side');
  console.log('3. This is slower but will work\n');
}

findCorrectParameter();



