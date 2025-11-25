/**
 * Update currentlyElected status based on authenticated Oireachtas API data
 * Mark only current 34th Dáil members as currently elected
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the current politician data
function loadPoliticianData() {
  const filePath = path.join(__dirname, '..', 'shared', 'politicianData.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Extract the politicians array
  const arrayStart = content.indexOf('export const politicians: Politician[] = [');
  const arrayEnd = content.lastIndexOf('];');
  
  if (arrayStart === -1 || arrayEnd === -1) {
    throw new Error('Could not find politicians array in file');
  }
  
  const arrayContent = content.substring(arrayStart + 'export const politicians: Politician[] = '.length, arrayEnd + 1);
  
  try {
    // Use eval to parse the array (dangerous but works for our controlled data)
    const politicians = eval(arrayContent);
    return { politicians, content, arrayStart, arrayEnd };
  } catch (error) {
    console.error('Error parsing politicians array:', error);
    throw error;
  }
}

// Load the authenticated Oireachtas data
function loadCurrentTDs() {
  const filePath = path.join(__dirname, '..', 'attached_assets', 'response_1749649626151.json');
  const rawData = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(rawData);
  
  const currentTDs = new Set();
  
  data.results.forEach(result => {
    const member = result.member;
    
    // Check if member has current Dáil membership (34th Dáil)
    const currentMembership = member.memberships.find(membership => 
      membership.membership.house.houseNo === "34" && 
      membership.membership.dateRange.end === null
    );
    
    if (currentMembership) {
      // Normalize name for matching
      const normalizedName = member.fullName
        .toLowerCase()
        .replace(/[áàâäã]/g, 'a')
        .replace(/[éèêë]/g, 'e')
        .replace(/[íìîï]/g, 'i')
        .replace(/[óòôöõ]/g, 'o')
        .replace(/[úùûü]/g, 'u')
        .replace(/[ç]/g, 'c')
        .replace(/[ñ]/g, 'n')
        .replace(/['']/g, '')
        .replace(/[.]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      currentTDs.add(normalizedName);
    }
  });
  
  return currentTDs;
}

// Normalize politician name for matching
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[áàâäã]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôöõ]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
    .replace(/['']/g, '')
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Update election status
function updateElectionStatus() {
  const { politicians, content, arrayStart, arrayEnd } = loadPoliticianData();
  const currentTDs = loadCurrentTDs();
  
  console.log(`Found ${currentTDs.size} current TDs in Oireachtas data`);
  console.log(`Found ${politicians.length} politicians in database`);
  
  let updatedCount = 0;
  let currentlyElectedCount = 0;
  
  // Update each politician's status
  const updatedPoliticians = politicians.map(politician => {
    const normalizedPoliticianName = normalizeName(politician.name);
    const isCurrentlyElected = currentTDs.has(normalizedPoliticianName);
    
    if (isCurrentlyElected !== politician.currentlyElected) {
      updatedCount++;
    }
    
    if (isCurrentlyElected) {
      currentlyElectedCount++;
    }
    
    return {
      ...politician,
      currentlyElected: isCurrentlyElected
    };
  });
  
  console.log(`Updated status for ${updatedCount} politicians`);
  console.log(`${currentlyElectedCount} politicians marked as currently elected`);
  
  // Check for duplicates among currently elected
  const currentNames = updatedPoliticians
    .filter(p => p.currentlyElected)
    .map(p => normalizeName(p.name));
  
  const duplicates = currentNames.filter((name, index) => currentNames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    console.log('\nWARNING: Found duplicate names among currently elected:');
    duplicates.forEach(name => console.log(`  - ${name}`));
  }
  
  // Generate new content
  const beforeArray = content.substring(0, arrayStart);
  const afterArray = content.substring(arrayEnd + 2);
  
  const newArrayContent = 'export const politicians: Politician[] = [\n' +
    updatedPoliticians.map(politician => {
      return `  {
    id: "${politician.id}",
    name: "${politician.name}",
    partyId: "${politician.partyId}",
    title: "${politician.title}",
    bio: "${politician.bio.replace(/"/g, '\\"')}",
    imageUrl: "${politician.imageUrl}",
    economic: ${politician.economic},
    social: ${politician.social},
    signature_policies: ${JSON.stringify(politician.signature_policies)},${politician.constituency ? `
    constituency: "${politician.constituency}",` : ''}${politician.lastUpdated ? `
    lastUpdated: "${politician.lastUpdated}",` : ''}
    currentlyElected: ${politician.currentlyElected}
  }`;
    }).join(',\n') + '\n];';
  
  const newContent = beforeArray + newArrayContent + afterArray;
  
  // Write back to file
  const outputPath = path.join(__dirname, '..', 'shared', 'politicianData.ts');
  fs.writeFileSync(outputPath, newContent, 'utf8');
  
  console.log(`\nUpdated ${outputPath}`);
  console.log(`Total politicians: ${politicians.length}`);
  console.log(`Currently elected: ${currentlyElectedCount}`);
  console.log(`Not currently elected: ${politicians.length - currentlyElectedCount}`);
  
  // Show breakdown by party for currently elected
  const partyBreakdown = {};
  updatedPoliticians
    .filter(p => p.currentlyElected)
    .forEach(p => {
      partyBreakdown[p.partyId] = (partyBreakdown[p.partyId] || 0) + 1;
    });
  
  console.log('\nCurrently elected by party:');
  Object.entries(partyBreakdown)
    .sort(([,a], [,b]) => b - a)
    .forEach(([party, count]) => {
      console.log(`  ${party}: ${count}`);
    });
}

// Run the update
updateElectionStatus();