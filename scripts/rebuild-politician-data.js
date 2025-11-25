/**
 * Script to rebuild politician data with proper escaping
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadAndFixPoliticianData() {
  const filePath = path.join(__dirname, '..', 'shared', 'politicianData.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Extract just the politicians array
  const arrayMatch = content.match(/export const politicians[^=]*=\s*(\[[\s\S]*?\n\]);/);
  if (!arrayMatch) {
    throw new Error('Could not find politicians array in file');
  }
  
  const arrayString = arrayMatch[1];
  
  // Parse with eval but handle quotes properly
  try {
    const politicians = eval(arrayString);
    
    // Fix any quote issues in names
    politicians.forEach(politician => {
      if (politician.name) {
        // Ensure proper escaping
        politician.name = politician.name.replace(/"/g, '\\"');
      }
      if (politician.bio) {
        // Ensure proper escaping in bio
        politician.bio = politician.bio.replace(/"/g, '\\"');
      }
    });
    
    return politicians;
  } catch (error) {
    console.error('Failed to parse politician data:', error);
    throw error;
  }
}

function writePoliticianData(politicians) {
  const filePath = path.join(__dirname, '..', 'shared', 'politicianData.ts');
  
  // Helper function to properly escape strings
  const escapeString = (str) => {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  };
  
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
  console.log(`Rebuilt politician data file with ${politicians.length} politicians`);
}

// Run the rebuild
try {
  const politicians = loadAndFixPoliticianData();
  writePoliticianData(politicians);
  console.log('✅ Politician data rebuilt successfully');
} catch (error) {
  console.error('Error rebuilding politician data:', error);
  
  // Fallback: just fix the specific quote issues manually
  const filePath = path.join(__dirname, '..', 'shared', 'politicianData.ts');
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Manual fixes for the three problematic names
  content = content.replace(/name: "Peter "Chap" Cleere"/g, 'name: "Peter \\"Chap\\" Cleere"');
  content = content.replace(/name: "Pat "the Cope" Gallagher"/g, 'name: "Pat \\"the Cope\\" Gallagher"');
  content = content.replace(/name: "Kevin "Boxer" Moran"/g, 'name: "Kevin \\"Boxer\\" Moran"');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Applied manual quote fixes');
}