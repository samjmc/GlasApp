/**
 * FIND MISSING TDs
 * We should have 174 but only found 138 - find the missing 36
 */

import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000
});

async function findMissingTDs() {
  console.log('🔍 FINDING MISSING 36 TDs');
  console.log('═══════════════════════════════════════════');
  console.log('Expected: 174 TDs');
  console.log('Found: 138 TDs');
  console.log('Missing: 36 TDs\n');

  // Try different query variations
  const queries = [
    {
      name: 'Current approach (2020-01-01)',
      params: { date_start: '2020-01-01', house: 'dail', limit: 300 }
    },
    {
      name: 'No date filter',
      params: { house: 'dail', limit: 300 }
    },
    {
      name: 'After 2024 election',
      params: { date_start: '2024-11-30', house: 'dail', limit: 300 }
    },
    {
      name: 'Very broad (2010+)',
      params: { date_start: '2010-01-01', house: 'dail', limit: 300 }
    }
  ];

  for (const query of queries) {
    console.log(`\n📊 Testing: ${query.name}`);
    console.log('───────────────────────────────────────────');
    
    try {
      const resp = await api.get('/members', { params: query.params });
      const allMembers = resp.data.results || [];
      
      // Filter to current Dáil members (34th Dáil)
      const currentDail = allMembers.filter((r: any) => {
        return r.member.memberships?.some((m: any) => {
          const house = m.membership.house;
          return house?.houseCode === 'dail' && 
                 house?.houseNo === '34' &&
                 m.membership.dateRange?.end === null;
        });
      });

      console.log(`Total members returned: ${allMembers.length}`);
      console.log(`34th Dáil (current, active): ${currentDail.length}`);
      
      if (currentDail.length > 0) {
        console.log(`Sample TDs:`, currentDail.slice(0, 5).map((r: any) => r.member.fullName));
      }
      
      if (currentDail.length === 174) {
        console.log('✅ FOUND ALL 174!');
      } else if (currentDail.length > 138) {
        console.log(`✅ Better! Found ${currentDail.length - 138} more TDs`);
      }
      
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  // Check what houses are being returned
  console.log('\n\n🏛️ HOUSE BREAKDOWN');
  console.log('───────────────────────────────────────────');
  try {
    const resp = await api.get('/members', {
      params: { date_start: '2024-11-30', limit: 300 }
    });

    const houseBreakdown: Record<string, number> = {};
    
    resp.data.results.forEach((r: any) => {
      r.member.memberships?.forEach((m: any) => {
        if (m.membership.dateRange?.end === null) {
          const house = m.membership.house?.showAs || 'Unknown';
          houseBreakdown[house] = (houseBreakdown[house] || 0) + 1;
        }
      });
    });

    console.log('Active memberships by house:');
    Object.entries(houseBreakdown).forEach(([house, count]) => {
      console.log(`   ${house}: ${count}`);
    });
    
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('💡 NEXT STEPS:');
  console.log('═══════════════════════════════════════════\n');
  console.log('1. Use the query that returns most TDs');
  console.log('2. Filter strictly for houseNo === "34"');
  console.log('3. Ensure dateRange.end === null (currently active)');
  console.log('4. Update extraction code\n');
}

findMissingTDs();


