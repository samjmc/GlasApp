/**
 * Script to parse active TDs from Oireachtas API response and update TD counts
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
    'Fianna_Fail': 'ie-ff',
    'Sinn_Fein': 'ie-sf',
    'Labour_Party': 'ie-labour',
    'Green_Party': 'ie-green',
    'Social_Democrats': 'ie-sd',
    'People_Before_Profit': 'ie-pbp',
    'Aontu': 'ie-aontu',
    'Independent_Ireland': 'ie-independent-ireland',
    'Irish_Freedom_Party': 'ie-irish-freedom',
    'Solidarity': 'ie-solidarity'
  };
  
  // First try exact party code match
  if (mapping[partyCode]) {
    return mapping[partyCode];
  }
  
  // Try name-based mapping for edge cases
  const nameMapping = {
    'Fine Gael': 'ie-fg',
    'Fianna Fáil': 'ie-ff',
    'Sinn Féin': 'ie-sf',
    'Labour Party': 'ie-labour',
    'Green Party': 'ie-green',
    'Social Democrats': 'ie-sd',
    'People Before Profit': 'ie-pbp',
    'Aontú': 'ie-aontu',
    'Independent Ireland': 'ie-independent-ireland',
    'Irish Freedom Party': 'ie-irish-freedom',
    'Solidarity': 'ie-solidarity'
  };
  
  return nameMapping[partyName] || 'ie-independent';
}

// Extract TD data from the JSON
function extractTDData() {
  const data = loadOireachtasData();
  const tdCounts = {};
  const tdDetails = [];

  console.log(`Total members found: ${data.head.counts.memberCount}`);

  data.results.forEach(result => {
    const member = result.member;
    const membership = member.memberships[0]?.membership;
    
    if (!membership) return;

    const party = membership.parties[0]?.party;
    const constituency = membership.represents[0]?.represent;
    
    if (party && constituency) {
      const partyId = mapPartyCode(party.partyCode, party.showAs);
      const tdInfo = {
        name: member.fullName,
        firstName: member.firstName,
        lastName: member.lastName,
        party: party.showAs,
        partyId: partyId,
        partyCode: party.partyCode,
        constituency: constituency.showAs,
        memberCode: member.memberCode
      };

      tdDetails.push(tdInfo);

      // Count TDs by party
      if (!tdCounts[partyId]) {
        tdCounts[partyId] = 0;
      }
      tdCounts[partyId]++;
    }
  });

  return { tdCounts, tdDetails };
}

// Generate updated TD counts for the application
function generateTDCounts() {
  const { tdCounts, tdDetails } = extractTDData();

  console.log('\n=== TD COUNTS BY PARTY ===');
  Object.entries(tdCounts)
    .sort(([,a], [,b]) => b - a)
    .forEach(([party, count]) => {
      console.log(`${party}: ${count} TDs`);
    });

  console.log('\n=== CODE FOR EDUCATION PAGE ===');
  console.log('// Updated TD counts from Oireachtas API (June 2025)');
  console.log('const tdCounts: Record<string, number> = {');
  Object.entries(tdCounts)
    .sort(([,a], [,b]) => b - a)
    .forEach(([party, count]) => {
      const partyName = tdDetails.find(td => td.partyId === party)?.party || party;
      console.log(`  '${party}': ${count}, // ${partyName}`);
    });
  console.log('};');

  console.log('\n=== PARTY BREAKDOWN ===');
  Object.entries(tdCounts)
    .sort(([,a], [,b]) => b - a)
    .forEach(([partyId, count]) => {
      const partyName = tdDetails.find(td => td.partyId === partyId)?.party || partyId;
      const members = tdDetails.filter(td => td.partyId === partyId);
      console.log(`\n${partyName} (${count} TDs):`);
      members.forEach(member => {
        console.log(`  - ${member.name} (${member.constituency})`);
      });
    });

  return { tdCounts, tdDetails };
}

// Run the script
generateTDCounts();