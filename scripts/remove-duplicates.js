/**
 * Script to remove duplicates from the politician database
 * Keeps the first occurrence of each unique politician based on ID
 */

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
  
  const arrayString = arrayMatch[1];
  try {
    return eval(arrayString);
  } catch (error) {
    console.error('Failed to parse politician data:', error);
    throw error;
  }
}

function removeDuplicates() {
  console.log('Loading politician data...');
  const politicians = loadPoliticianData();
  console.log(`Total politicians before deduplication: ${politicians.length}`);
  
  // Track seen IDs and keep only the first occurrence
  const seenIds = new Set();
  const uniquePoliticians = [];
  const duplicatesRemoved = [];
  
  for (const politician of politicians) {
    if (!seenIds.has(politician.id)) {
      seenIds.add(politician.id);
      uniquePoliticians.push(politician);
    } else {
      duplicatesRemoved.push(politician);
    }
  }
  
  console.log(`Total politicians after deduplication: ${uniquePoliticians.length}`);
  console.log(`Duplicates removed: ${duplicatesRemoved.length}`);
  
  // Show which duplicates were removed
  if (duplicatesRemoved.length > 0) {
    console.log('\nDuplicates removed:');
    duplicatesRemoved.forEach(p => {
      console.log(`  - ${p.name} (${p.constituency}) - ID: ${p.id}`);
    });
  }
  
  return uniquePoliticians;
}

function writePoliticianData(politicians) {
  const filePath = path.join(__dirname, '..', 'shared', 'politicianData.ts');
  
  // Generate the TypeScript file content
  const content = `import { politicalParties } from './data';

export interface Politician {
  id: string;
  name: string;
  partyId: string;
  title: string;
  bio: string;
  imageUrl: string;
  economic: number;
  social: number;
  signature_policies: string[];
  constituency?: string;
  lastUpdated?: string;
  currentlyElected?: boolean;
}

export const politicians: Politician[] = [
${politicians.map(p => `  {
    id: "${p.id}",
    name: "${p.name}",
    partyId: "${p.partyId}",
    title: "${p.title}",
    bio: "${p.bio.replace(/"/g, '\\"')}",
    imageUrl: "${p.imageUrl}",
    economic: ${p.economic},
    social: ${p.social},
    signature_policies: [${p.signature_policies.map(policy => `"${policy.replace(/"/g, '\\"')}"`).join(', ')}],
    constituency: "${p.constituency || ''}",
    lastUpdated: "${p.lastUpdated || ''}",
    currentlyElected: ${p.currentlyElected || false}
  }`).join(',\n')}
];
`;
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`\nUpdated politician data file with ${politicians.length} unique politicians`);
}

// Run the deduplication
try {
  const uniquePoliticians = removeDuplicates();
  writePoliticianData(uniquePoliticians);
  console.log('\n✅ Deduplication completed successfully');
} catch (error) {
  console.error('Error during deduplication:', error);
  process.exit(1);
}