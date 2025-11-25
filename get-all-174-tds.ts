/**
 * GET ALL 174 TDs
 * Test different approaches to get complete list
 */

import axios from 'axios';
import fs from 'fs';

const api = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000
});

async function getAllTDs() {
  console.log('🎯 GETTING ALL 174 TDs');
  console.log('═══════════════════════════════════════════\n');

  // Strategy: No limit, let API return everything
  console.log('1️⃣  Trying with no limit parameter');
  console.log('───────────────────────────────────────────');
  try {
    const resp = await api.get('/members', {
      params: {
        date_start: '2020-01-01',
        house: 'dail'
        // NO limit parameter - see what happens
      }
    });

    const allMembers = resp.data.results || [];
    console.log(`Total members returned: ${allMembers.length}`);
    
    // Filter to 34th Dáil
    const dail34 = allMembers.filter((r: any) => {
      return r.member.memberships?.some((m: any) => {
        const house = m.membership.house;
        return house?.houseCode === 'dail' && 
               house?.houseNo === '34' &&
               m.membership.dateRange?.end === null;
      });
    });

    console.log(`34th Dáil TDs: ${dail34.length}`);
    
    if (dail34.length === 174) {
      console.log('🎉 GOT ALL 174!\n');
      
      // Save to file for inspection
      fs.writeFileSync('all-174-tds.json', JSON.stringify(dail34.map((r: any) => ({
        name: r.member.fullName,
        memberCode: r.member.memberCode
      })), null, 2));
      console.log('✅ Saved list to: all-174-tds.json\n');
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}\n`);
  }

  // Strategy 2: Very high limit
  console.log('2️⃣  Trying with limit=500');
  console.log('───────────────────────────────────────────');
  try {
    const resp = await api.get('/members', {
      params: {
        date_start: '2020-01-01',
        house: 'dail',
        limit: 500
      }
    });

    const allMembers = resp.data.results || [];
    console.log(`Total members returned: ${allMembers.length}`);
    
    const dail34 = allMembers.filter((r: any) => {
      return r.member.memberships?.some((m: any) => {
        const house = m.membership.house;
        return house?.houseCode === 'dail' && 
               house?.houseNo === '34' &&
               m.membership.dateRange?.end === null;
      });
    });

    console.log(`34th Dáil TDs: ${dail34.length}\n`);
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}\n`);
  }

  // Strategy 3: Check if some TDs are marked as Seanad in one membership but Dáil in another
  console.log('3️⃣  Checking for TDs with multiple house memberships');
  console.log('───────────────────────────────────────────');
  try {
    const resp = await api.get('/members', {
      params: {
        date_start: '2020-01-01',
        limit: 400
      }
    });

    const allMembers = resp.data.results || [];
    
    // Find anyone with active 34th Dáil membership, regardless of other memberships
    const anyDail34 = allMembers.filter((r: any) => {
      return r.member.memberships?.some((m: any) => {
        const house = m.membership.house;
        return house?.houseCode === 'dail' && 
               house?.houseNo === '34' &&
               m.membership.dateRange?.end === null;
      });
    });

    console.log(`Total with any 34th Dáil membership: ${anyDail34.length}`);
    
    // Check how many also have Seanad membership
    const dualMembers = anyDail34.filter((r: any) => {
      const hasSeanad = r.member.memberships?.some((m: any) => {
        return m.membership.house?.houseCode === 'seanad' &&
               m.membership.dateRange?.end === null;
      });
      return hasSeanad;
    });

    console.log(`TDs who also have Seanad membership: ${dualMembers.length}`);
    if (dualMembers.length > 0) {
      console.log(`Examples:`, dualMembers.slice(0, 3).map((r: any) => r.member.fullName));
    }
    console.log('');
    
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}\n`);
  }

  // Strategy 4: Use chamber_id if it exists
  console.log('4️⃣  Testing chamber_id parameter');
  console.log('───────────────────────────────────────────');
  try {
    const resp = await api.get('/members', {
      params: {
        chamber_id: 'dail',
        chamber: '34',
        limit: 300
      }
    });

    const count = resp.data.results?.length || 0;
    console.log(`Results: ${count}\n`);
  } catch (error: any) {
    console.log(`❌ chamber_id not supported\n`);
  }

  console.log('═══════════════════════════════════════════');
  console.log('✅ RECOMMENDATION:');
  console.log('═══════════════════════════════════════════\n');
  console.log('Use: date_start=2020-01-01, limit=500');
  console.log('Filter: houseCode===dail && houseNo===34 && dateRange.end===null');
  console.log('Expected result: 163-174 TDs\n');
  console.log('If still missing TDs, they might be:');
  console.log('- Recently appointed (after our query date)');
  console.log('- Data not yet in API');
  console.log('- Need to query without house filter\n');
}

getAllTDs();


