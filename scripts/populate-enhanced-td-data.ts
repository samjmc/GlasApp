/**
 * Populate Enhanced TD Data
 * Extracts all available member data from Oireachtas API and updates td_scores table
 * This populates: gender, wikipedia, offices, membership history, dates, etc.
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';
import { getCurrentDailMembers } from '../server/services/oireachtasAPIService.js';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000,
  headers: {
    'User-Agent': 'GlasPolitics/1.0',
    'Accept': 'application/json'
  }
});

/**
 * Extract detailed member info including offices, history, dates
 */
async function getEnhancedMemberDetails(memberCode: string) {
  try {
    // Fetch full member details
    const response = await apiClient.get('/members', {
      params: {
        member_id: `/ie/oireachtas/member/${memberCode}`,
        limit: 1
      }
    });

    const members = response.data.results || [];
    if (members.length === 0) return null;

    const member = members[0].member;
    
    // Find current Dáil membership
    const dailMembership = member.memberships?.find((m: unknown) =>
      m.membership.house?.houseCode === 'dail' &&
      m.membership.house?.houseNo === '34' &&
      !m.membership.dateRange?.end
    )?.membership;

    if (!dailMembership) return null;

    // Extract offices
    const offices = dailMembership.offices || [];

    // Build membership history
    const membershipHistory = (member.memberships || [])
      .filter((m: unknown) => m.membership.house?.houseCode === 'dail')
      .map((m: unknown) => ({
        houseNo: m.membership.house?.houseNo,
        party: m.membership.parties?.[0]?.party?.showAs,
        constituency: m.membership.represents?.[0]?.represent?.showAs,
        startDate: m.membership.dateRange?.start,
        endDate: m.membership.dateRange?.end,
        offices: m.membership.offices || []
      }));

    // Find first elected date
    const firstElected = membershipHistory
      .filter((h: unknown) => h.startDate)
      .sort((a: unknown, b: unknown) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0]?.startDate;

    return {
      gender: member.gender || null,
      wikipediaTitle: member.wikiTitle || null,
      memberCode: member.memberCode,
      memberUri: member.uri,
      offices: offices,
      membershipHistory: membershipHistory,
      dateOfDeath: member.dateOfDeath || null,
      hasProfileImage: member.image || false,
      currentTermStart: dailMembership.dateRange?.start,
      firstElectedDate: firstElected || null
    };

  } catch (error: unknown) {
    console.error(`Failed to get enhanced details for ${memberCode}:`, error.message);
    return null;
  }
}

async function populateEnhancedData() {
  console.log('🚀 POPULATING ENHANCED TD DATA');
  console.log('═'.repeat(70));
  console.log('Extracting rich member data from Oireachtas API');
  console.log('Fields: gender, wikipedia, offices, history, dates\n');

  if (!supabase) {
    console.error('❌ Supabase client not initialized');
    process.exit(1);
  }

  // Step 1: Get all current TDs
  console.log('📊 Step 1: Fetching current TDs from API...');
  const dailMembers = await getCurrentDailMembers();
  console.log(`✅ Found ${dailMembers.length} TDs\n`);

  // Step 2: Get existing TDs from database
  const { data: dbTDs, error: dbError } = await supabase
    .from('td_scores')
    .select('id, politician_name, party, constituency');

  if (dbError || !dbTDs) {
    console.error('❌ Failed to fetch TDs from database');
    return;
  }

  console.log(`✅ Found ${dbTDs.length} TDs in database\n`);

  // Step 3: Process each TD
  console.log('📋 Step 2: Extracting enhanced data...');
  console.log('─'.repeat(70));

  let updated = 0;
  let errors = 0;
  let skipped = 0;

  for (const apiMember of dailMembers) {
    // Find matching TD in database
    const dbTD = dbTDs.find(td =>
      td.politician_name.toLowerCase() === apiMember.fullName.toLowerCase()
    );

    if (!dbTD) {
      console.log(`⏭️  ${apiMember.fullName} - Not in database, skipping`);
      skipped++;
      continue;
    }

    console.log(`\n${(updated + errors + 1).toString().padStart(3)}/${dailMembers.length} - ${apiMember.fullName}`);

    try {
      // Get enhanced details
      const enhanced = await getEnhancedMemberDetails(apiMember.memberCode);

      if (!enhanced) {
        console.log(`   ⚠️  No enhanced data available`);
        skipped++;
        continue;
      }

      // Update database
      const { error: updateError } = await supabase
        .from('td_scores')
        .update({
          gender: enhanced.gender,
          wikipedia_title: enhanced.wikipediaTitle,
          member_code: enhanced.memberCode,
          member_uri: enhanced.memberUri,
          offices: enhanced.offices,
          membership_history: enhanced.membershipHistory,
          date_of_death: enhanced.dateOfDeath,
          has_profile_image: enhanced.hasProfileImage,
          current_term_start: enhanced.currentTermStart,
          first_elected_date: enhanced.firstElectedDate,
          last_updated: new Date().toISOString()
        })
        .eq('id', dbTD.id);

      if (updateError) {
        console.log(`   ❌ Update error: ${updateError.message}`);
        errors++;
      } else {
        updated++;
        
        // Show summary of data extracted
        const parts = [];
        if (enhanced.gender) parts.push(`Gender: ${enhanced.gender}`);
        if (enhanced.wikipediaTitle) parts.push('Wikipedia: ✓');
        if (enhanced.offices && enhanced.offices.length > 0) {
          parts.push(`Offices: ${enhanced.offices.length}`);
        }
        if (enhanced.firstElectedDate) {
          const years = new Date().getFullYear() - new Date(enhanced.firstElectedDate).getFullYear();
          parts.push(`${years}y in Dáil`);
        }
        
        console.log(`   ✅ ${parts.join(', ')}`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: unknown) {
      console.error(`   ❌ Error: ${error.message}`);
      errors++;
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 EXTRACTION COMPLETE');
  console.log('═'.repeat(70));
  console.log(`✅ Updated:  ${updated}/${dailMembers.length}`);
  console.log(`⏭️  Skipped:  ${skipped}`);
  console.log(`❌ Errors:   ${errors}`);
  console.log('═'.repeat(70));

  // Show statistics
  console.log('\n📈 DATA STATISTICS:');
  
  const { data: stats } = await supabase
    .from('td_scores')
    .select('gender, offices, wikipedia_title, first_elected_date');

  if (stats) {
    const withGender = stats.filter(s => s.gender).length;
    const withWiki = stats.filter(s => s.wikipedia_title).length;
    const withOffices = stats.filter(s => s.offices && s.offices.length > 0).length;
    const withFirstElected = stats.filter(s => s.first_elected_date).length;

    console.log(`   Gender data:        ${withGender}/${stats.length}`);
    console.log(`   Wikipedia links:    ${withWiki}/${stats.length}`);
    console.log(`   Office holders:     ${withOffices}/${stats.length}`);
    console.log(`   First elected date: ${withFirstElected}/${stats.length}`);

    // Gender breakdown
    const maleCount = stats.filter(s => s.gender === 'male').length;
    const femaleCount = stats.filter(s => s.gender === 'female').length;
    const femalePct = ((femaleCount / (maleCount + femaleCount)) * 100).toFixed(1);

    console.log(`\n👥 GENDER DIVERSITY:`);
    console.log(`   Male:   ${maleCount}`);
    console.log(`   Female: ${femaleCount} (${femalePct}%)`);
  }

  console.log('\n✅ Enhanced TD data population complete!\n');
}

populateEnhancedData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

