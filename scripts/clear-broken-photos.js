/**
 * Script to clear broken photo URLs so politician cards show proper initials
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

function clearBrokenPhotoUrls() {
  console.log('Loading politician data...');
  const politicians = loadPoliticianData();
  console.log(`Processing ${politicians.length} politicians...`);
  
  let clearedCount = 0;
  
  politicians.forEach(politician => {
    // Clear broken or placeholder URLs
    if (politician.imageUrl && (
      politician.imageUrl.includes('placeholder') ||
      politician.imageUrl.includes('via.placeholder') ||
      politician.imageUrl.includes('oireachtas.ie') ||
      politician.imageUrl.includes('data.oireachtas.ie') ||
      politician.imageUrl === "https://images.oireachtas.ie/api/v1/image/" ||
      politician.imageUrl.endsWith('/image/') ||
      politician.imageUrl.endsWith('/')
    )) {
      politician.imageUrl = "";
      clearedCount++;
    }
  });
  
  console.log(`Cleared ${clearedCount} broken photo URLs`);
  return politicians;
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
  console.log(`Updated politician data file with ${politicians.length} politicians`);
}

// Run the cleanup
try {
  const cleanedPoliticians = clearBrokenPhotoUrls();
  writePoliticianData(cleanedPoliticians);
  console.log('Broken photo URLs cleared - politician cards will now show proper initials');
} catch (error) {
  console.error('Error clearing photo URLs:', error);
  process.exit(1);
}