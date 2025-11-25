/**
 * Parse current party affiliations from Oireachtas API data
 * Only counts memberships where end date is null (current)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the JSON data
function loadOireachtasData() {
  const filePath = path.join(__dirname, '..', 'attached_assets', 'response_1749649626151.json');
  const rawData = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(rawData);
}

// Map party codes to our internal party IDs
function mapPartyCode(partyCode, partyName) {
  const mapping = {
    'Fine_Gael': 'ie-fg',
    'Fianna_Fáil': 'ie-ff',
    'Sinn_Féin': 'ie-sf',
    'Green_Party': 'ie-green',
    'Labour_Party': 'ie-labour',
    'Social_Democrats': 'ie-sd',
    'People_Before_Profit-Solidarity': 'ie-pbp',
    'Solidarity-People_Before_Profit': 'ie-pbp',
    'People_Before_Profit': 'ie-pbp',
    'Solidarity': 'ie-pbp',
    'Aontú': 'ie-aontu',
    'Independent_Ireland': 'ie-independent-ireland',
    'Irish_Freedom_Party': 'ie-irish-freedom',
    'Independent': 'ie-independent'
  };
  
  // Check for various PBP/Solidarity variations in party name
  if (partyName && (partyName.includes('People Before Profit') || partyName.includes('Solidarity'))) {
    return 'ie-pbp';
  }
  
  return mapping[partyCode] || 'ie-independent';
}

// Extract current TD data (only active memberships)
function extractCurrentTDData() {
  const data = loadOireachtasData();
  const currentTDs = [];
  
  data.results.forEach(result => {
    const member = result.member;
    
    // Check if member has current Dáil membership (34th Dáil)
    const currentMembership = member.memberships.find(membership => 
      membership.membership.house.houseNo === "34" && 
      membership.membership.dateRange.end === null
    );
    
    if (currentMembership) {
      // Find current party (where end date is null)
      const currentParty = currentMembership.membership.parties.find(party => 
        party.party.dateRange.end === null
      );
      
      if (currentParty) {
        const constituency = currentMembership.membership.represents?.[0]?.represent?.showAs || 'Unknown';
        
        currentTDs.push({
          name: member.fullName,
          constituency: constituency,
          partyCode: currentParty.party.partyCode,
          partyName: currentParty.party.showAs,
          mappedPartyId: mapPartyCode(currentParty.party.partyCode, currentParty.party.showAs)
        });
      }
    }
  });
  
  return currentTDs;
}

// Generate TD counts by party
function generateCurrentTDCounts() {
  const currentTDs = extractCurrentTDData();
  const partyCounts = {};
  
  currentTDs.forEach(td => {
    const partyId = td.mappedPartyId;
    partyCounts[partyId] = (partyCounts[partyId] || 0) + 1;
  });
  
  // Sort by count descending
  const sortedCounts = Object.entries(partyCounts)
    .sort(([,a], [,b]) => b - a)
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {});
  
  console.log(`Total current TDs found: ${currentTDs.length}`);
  console.log('\n=== CURRENT TD COUNTS BY PARTY ===');
  
  Object.entries(sortedCounts).forEach(([partyId, count]) => {
    const partyName = currentTDs.find(td => td.mappedPartyId === partyId)?.partyName || partyId;
    console.log(`${partyId}: ${count} TDs (${partyName})`);
  });
  
  console.log('\n=== CODE FOR EDUCATION PAGE ===');
  console.log('const tdCounts: Record<string, number> = {');
  Object.entries(sortedCounts).forEach(([partyId, count]) => {
    const partyName = currentTDs.find(td => td.mappedPartyId === partyId)?.partyName || partyId;
    console.log(`  '${partyId}': ${count}, // ${partyName}`);
  });
  console.log('};');
  
  // Show specific party breakdowns
  console.log('\n=== DETAILED PARTY BREAKDOWN ===');
  Object.entries(sortedCounts).forEach(([partyId, count]) => {
    const partyName = currentTDs.find(td => td.mappedPartyId === partyId)?.partyName || partyId;
    const partyMembers = currentTDs.filter(td => td.mappedPartyId === partyId);
    
    console.log(`\n${partyName} (${count} TDs):`);
    partyMembers.forEach(member => {
      console.log(`  - ${member.name} (${member.constituency})`);
    });
  });
  
  // Check for specific Aontú members
  console.log('\n=== AONTÚ SPECIFIC CHECK ===');
  const aontuMembers = currentTDs.filter(td => td.mappedPartyId === 'ie-aontu');
  console.log(`Aontú current TDs: ${aontuMembers.length}`);
  aontuMembers.forEach(member => {
    console.log(`  - ${member.name} (${member.constituency})`);
  });
  
  // Check for Peadar Tóibín specifically
  const toibinMember = currentTDs.find(td => td.name.includes('Peadar Tóibín'));
  if (toibinMember) {
    console.log(`\nPeadar Tóibín current party: ${toibinMember.partyName} (${toibinMember.mappedPartyId})`);
  } else {
    console.log('\nPeadar Tóibín not found in current TDs');
  }
}

// Run the analysis
generateCurrentTDCounts();