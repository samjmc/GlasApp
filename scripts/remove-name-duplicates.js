/**
 * Script to remove remaining name duplicates
 * Keeps the version with proper apostrophes/formatting
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadPoliticianData() {
  const filePath = path.join(__dirname, '..', 'shared', 'politicianData.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  
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

function removeDuplicateNames() {
  console.log('Loading politician data...');
  const politicians = loadPoliticianData();
  console.log(`Total politicians before name deduplication: ${politicians.length}`);
  
  // Define preferred IDs to keep (with proper apostrophes)
  const preferredIds = new Set([
    'jennifer-murnane-o-connor',
    'james-o-connor', 
    'charlie-mcconalogue',
    'cian-o-callaghan',
    'jim-o-callaghan',
    'darragh-o-brien',
    'louise-o-reilly',
    'roderic-o-gorman',
    'willie-o-dea',
    'kieran-o-donnell',
    'richard-o-donoghue',
    'patrick-o-donovan',
    'darren-o-rourke'
  ]);
  
  // IDs to remove (without apostrophes or with -current suffix)
  const idsToRemove = new Set([
    'jennifer-murnane-oconnor',
    'james-oconnor',
    'charlie-mcconalogue-current',
    'cian-ocallaghan-current',
    'jim-ocallaghan',
    'darragh-obrien',
    'louise-oreilly',
    'roderic-ogorman',
    'willie-odea',
    'kieran-odonnell',
    'richard-odonoghue',
    'patrick-odonovan',
    'darren-orourke'
  ]);
  
  const uniquePoliticians = politicians.filter(politician => {
    return !idsToRemove.has(politician.id);
  });
  
  const removedCount = politicians.length - uniquePoliticians.length;
  console.log(`Total politicians after name deduplication: ${uniquePoliticians.length}`);
  console.log(`Name duplicates removed: ${removedCount}`);
  
  // Show which duplicates were removed
  const removed = politicians.filter(p => idsToRemove.has(p.id));
  if (removed.length > 0) {
    console.log('\nName duplicates removed:');
    removed.forEach(p => {
      console.log(`  - ${p.name} (${p.constituency}) - ID: ${p.id}`);
    });
  }
  
  return uniquePoliticians;
}

function writePoliticianData(politicians) {
  const filePath = path.join(__dirname, '..', 'shared', 'politicianData.ts');
  
  const escapeString = (str) => {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  };
  
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
    id: "${escapeString(p.id)}",
    name: "${escapeString(p.name)}",
    partyId: "${escapeString(p.partyId)}",
    title: "${escapeString(p.title)}",
    bio: "${escapeString(p.bio)}",
    imageUrl: "${escapeString(p.imageUrl)}",
    economic: ${p.economic || 0},
    social: ${p.social || 0},
    signature_policies: [${(p.signature_policies || []).map(policy => `"${escapeString(policy)}"`).join(', ')}],
    constituency: "${escapeString(p.constituency || '')}",
    lastUpdated: "${escapeString(p.lastUpdated || '')}",
    currentlyElected: ${p.currentlyElected || false}
  }`).join(',\n')}
];
`;
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`\nUpdated politician data file with ${politicians.length} unique politicians`);
}

// Run the final deduplication
try {
  const uniquePoliticians = removeDuplicateNames();
  writePoliticianData(uniquePoliticians);
  console.log('\n✅ Final deduplication completed successfully');
} catch (error) {
  console.error('Error during final deduplication:', error);
  process.exit(1);
}