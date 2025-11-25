/**
 * Script to check for duplicates in the politician database
 * Checks for duplicate names, IDs, and other potential data issues
 */

// Simple approach: use eval to load the data (safe since we control the file)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadPoliticianData() {
  const filePath = path.join(__dirname, '..', 'shared', 'politicianData.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Extract just the politicians array
  const arrayMatch = content.match(/export const politicians[^=]*=\s*(\[[\s\S]*?\n\]);/);
  if (!arrayMatch) {
    throw new Error('Could not find politicians array in file');
  }
  
  // Use eval to parse the TypeScript array (safe since we control the source)
  const arrayString = arrayMatch[1];
  try {
    return eval(arrayString);
  } catch (error) {
    console.error('Failed to parse politician data:', error);
    throw error;
  }
}

function checkForDuplicates() {
  console.log('Loading politician data...');
  const politicians = loadPoliticianData();
  console.log(`Total politicians: ${politicians.length}`);
  
  // Check for duplicate IDs
  const ids = politicians.map(p => p.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  
  if (duplicateIds.length > 0) {
    console.log('\n❌ DUPLICATE IDs FOUND:');
    duplicateIds.forEach(id => {
      const duplicates = politicians.filter(p => p.id === id);
      console.log(`  ID "${id}" appears ${duplicates.length} times:`);
      duplicates.forEach(p => console.log(`    - ${p.name} (${p.constituency})`));
    });
  } else {
    console.log('\n✅ No duplicate IDs found');
  }
  
  // Check for duplicate names
  const names = politicians.map(p => p.name);
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
  
  if (duplicateNames.length > 0) {
    console.log('\n❌ DUPLICATE NAMES FOUND:');
    [...new Set(duplicateNames)].forEach(name => {
      const duplicates = politicians.filter(p => p.name === name);
      console.log(`  Name "${name}" appears ${duplicates.length} times:`);
      duplicates.forEach(p => console.log(`    - ${p.id} (${p.constituency}, ${p.partyId})`));
    });
  } else {
    console.log('\n✅ No duplicate names found');
  }
  
  // Check for duplicate name-constituency combinations
  const nameConstituencyPairs = politicians.map(p => `${p.name}|${p.constituency}`);
  const duplicateNameConstituency = nameConstituencyPairs.filter((pair, index) => nameConstituencyPairs.indexOf(pair) !== index);
  
  if (duplicateNameConstituency.length > 0) {
    console.log('\n❌ DUPLICATE NAME-CONSTITUENCY COMBINATIONS FOUND:');
    [...new Set(duplicateNameConstituency)].forEach(pair => {
      const [name, constituency] = pair.split('|');
      const duplicates = politicians.filter(p => p.name === name && p.constituency === constituency);
      console.log(`  "${name}" in "${constituency}" appears ${duplicates.length} times:`);
      duplicates.forEach(p => console.log(`    - ${p.id} (${p.partyId})`));
    });
  } else {
    console.log('\n✅ No duplicate name-constituency combinations found');
  }
  
  // Check for missing required fields
  console.log('\n📊 CHECKING FOR MISSING FIELDS:');
  const missingFields = {
    name: politicians.filter(p => !p.name || p.name.trim() === '').length,
    id: politicians.filter(p => !p.id || p.id.trim() === '').length,
    partyId: politicians.filter(p => !p.partyId || p.partyId.trim() === '').length,
    constituency: politicians.filter(p => !p.constituency || p.constituency.trim() === '').length,
    bio: politicians.filter(p => !p.bio || p.bio.trim() === '').length,
    imageUrl: politicians.filter(p => !p.imageUrl || p.imageUrl.trim() === '').length
  };
  
  Object.entries(missingFields).forEach(([field, count]) => {
    if (count > 0) {
      console.log(`  ❌ ${count} politicians missing ${field}`);
    } else {
      console.log(`  ✅ All politicians have ${field}`);
    }
  });
  
  // Check for invalid party IDs
  const invalidPartyIds = politicians.filter(p => !p.partyId.startsWith('ie-'));
  if (invalidPartyIds.length > 0) {
    console.log('\n❌ INVALID PARTY IDs FOUND:');
    invalidPartyIds.forEach(p => {
      console.log(`  ${p.name}: "${p.partyId}" (should start with "ie-")`);
    });
  } else {
    console.log('\n✅ All party IDs are valid (start with "ie-")');
  }
  
  // Summary
  console.log('\n📋 SUMMARY:');
  console.log(`Total politicians: ${politicians.length}`);
  console.log(`Unique IDs: ${new Set(ids).size}`);
  console.log(`Unique names: ${new Set(names).size}`);
  console.log(`Currently elected: ${politicians.filter(p => p.currentlyElected).length}`);
  console.log(`Not currently elected: ${politicians.filter(p => !p.currentlyElected).length}`);
  
  // Check constituencies
  const constituencies = [...new Set(politicians.map(p => p.constituency).filter(Boolean))];
  console.log(`Total constituencies: ${constituencies.length}`);
  
  return {
    totalPoliticians: politicians.length,
    duplicateIds: duplicateIds.length,
    duplicateNames: duplicateNames.length,
    duplicateNameConstituency: duplicateNameConstituency.length,
    missingFields: Object.values(missingFields).reduce((sum, count) => sum + count, 0),
    invalidPartyIds: invalidPartyIds.length
  };
}

// Run the check
try {
  const results = checkForDuplicates();
  
  if (results.duplicateIds > 0 || results.duplicateNames > 0 || results.duplicateNameConstituency > 0) {
    console.log('\n⚠️  DUPLICATES DETECTED - Manual review required');
    process.exit(1);
  } else {
    console.log('\n✅ NO DUPLICATES FOUND - Database is clean');
    process.exit(0);
  }
} catch (error) {
  console.error('Error checking for duplicates:', error);
  process.exit(1);
}