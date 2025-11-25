/**
 * UPDATE ALL TDs FROM MEMBERS API
 * This WORKS - gets party, constituency, committees
 * Skips questions/debates (member filter doesn't work in API)
 * 
 * Run with: npx tsx update-tds-from-members-api.ts
 * Time: ~2 minutes
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://ospxqnxlotakujloltqy.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

function getCurrentDailMembership(member: any): any {
  if (!member.memberships) return null;
  
  return member.memberships.find((m: any) => 
    m.membership.house?.houseCode === 'dail' &&
    m.membership.dateRange?.end === null
  )?.membership;
}

function extractCommittees(member: any): any[] {
  const dailMembership = getCurrentDailMembership(member);
  if (!dailMembership?.committees) return [];
  
  return dailMembership.committees
    .filter((c: any) => c.mainStatus === 'Live')
    .map((c: any) => ({
      name: c.committeeName?.[0]?.nameEn || 'Unknown',
      nameIrish: c.committeeName?.[0]?.nameGa || '',
      role: c.role?.title || 'Member',
      type: c.committeeType?.[0] || '',
      code: c.committeeCode
    }));
}

async function updateFromMembersAPI() {
  console.log('🚀 UPDATING TDs FROM MEMBERS API');
  console.log('═══════════════════════════════════════════');
  console.log('Fetching party, constituency & committee data\n');

  try {
    // Get all current Dáil members
    console.log('1️⃣  Fetching from Oireachtas API...');
    const response = await axios.get('https://api.oireachtas.ie/v1/members', {
      params: {
        date_start: '2020-01-01',
        house: 'dail',
        limit: 500  // Increased to get all 173+ TDs
      }
    });

    const members = response.data.results || [];
    console.log(`✅ Found ${members.length} total members\n`);

    // Filter to only current 34th Dáil TDs (active membership)
    const currentTDs = members.filter((r: any) => {
      return r.member.memberships?.some((m: any) => {
        const house = m.membership.house;
        return house?.houseCode === 'dail' && 
               house?.houseNo === '34' &&  // Specifically 34th Dáil
               m.membership.dateRange?.end === null;
      });
    });

    console.log(`✅ Filtered to ${currentTDs.length} current 34th Dáil TDs (Target: 174)\n`);

    // Process each TD
    console.log('2️⃣  Updating database...');
    console.log('───────────────────────────────────────────\n');

    let updated = 0;
    let created = 0;
    let errors = 0;

    for (const result of currentTDs) {
      const member = result.member;
      const dailMembership = getCurrentDailMembership(member);
      
      if (!dailMembership) {
        console.log(`⚠️  ${member.fullName}: No active Dáil membership found`);
        continue;
      }
      
      const party = dailMembership.parties?.[0]?.party?.showAs || null;
      const constituency = dailMembership.represents?.[0]?.represent?.showAs || null;
      const committees = extractCommittees(member);

      try {
        // Check if TD exists
        const { data: existing } = await supabase
          .from('td_scores')
          .select('id')
          .eq('politician_name', member.fullName)
          .single();

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from('td_scores')
            .update({
              party,
              constituency,
              committee_memberships: committees,
              last_updated: new Date().toISOString()
            })
            .eq('politician_name', member.fullName);

          if (error) {
            console.log(`❌ ${member.fullName}: ${error.message}`);
            errors++;
          } else {
            console.log(`✅ ${member.fullName} - ${party || 'Unknown'} (${constituency || 'Unknown'}) - ${committees.length} committees`);
            updated++;
          }
        } else {
          // Create new
          const { error } = await supabase
            .from('td_scores')
            .insert({
              politician_name: member.fullName,
              party,
              constituency,
              committee_memberships: committees,
              overall_elo: 1500,
              last_updated: new Date().toISOString()
            });

          if (error) {
            console.log(`❌ ${member.fullName}: ${error.message}`);
            errors++;
          } else {
            console.log(`🆕 ${member.fullName} - ${party} (${constituency}) - CREATED`);
            created++;
          }
        }
      } catch (err: any) {
        console.log(`❌ ${member.fullName}: ${err.message}`);
        errors++;
      }
    }

    console.log('\n═══════════════════════════════════════════');
    console.log('✅ UPDATE COMPLETE!');
    console.log('═══════════════════════════════════════════\n');
    console.log(`Results:`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   🆕 Created: ${created}`);
    console.log(`   ❌ Errors: ${errors}\n`);
    console.log(`📊 Data Updated:`);
    console.log(`   ✅ Party affiliations (from memberships array)`);
    console.log(`   ✅ Constituencies (from represents array)`);
    console.log(`   ✅ Committee memberships & roles\n`);
    console.log(`🌐 View in browser:`);
    console.log(`   http://localhost:5000 → Rankings tab\n`);
    console.log(`⚠️  Note: Question/debate/vote counts NOT updated`);
    console.log(`   → API doesn't support member filtering`);
    console.log(`   → Need separate aggregation job for that\n`);

  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
  }
}

updateFromMembersAPI();

