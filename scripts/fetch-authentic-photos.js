/**
 * Script to fetch authentic politician photos from official Oireachtas API
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

async function fetchOireachtasMembers() {
  try {
    console.log('Fetching current members from Oireachtas API...');
    const response = await fetch('https://api.oireachtas.ie/v1/members?chamber_id=dail&limit=200&date_start=2020-01-01');
    
    if (!response.ok) {
      throw new Error(`API response not ok: ${response.status}`);
    }
    
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Failed to fetch from Oireachtas API:', error);
    return [];
  }
}

function normalizeNameForMatching(name) {
  return name
    .toLowerCase()
    .replace(/[áàâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/[^a-z\s]/g, '')
    .trim();
}

function findBestImageUrl(member) {
  // Try to construct the most reliable image URL from the member data
  if (member.member && member.member.uri) {
    const memberUri = member.member.uri;
    // Extract member ID from URI
    const memberIdMatch = memberUri.match(/\/members\/id\/(\d+)/);
    if (memberIdMatch) {
      const memberId = memberIdMatch[1];
      return `https://data.oireachtas.ie/ie/oireachtas/member/id/${memberId}/image/large`;
    }
  }
  
  // Alternative approach using member code
  if (member.member && member.member.memberCode) {
    const memberCode = member.member.memberCode;
    return `https://www.oireachtas.ie/en/members/member/${memberCode}/image/`;
  }
  
  return null;
}

async function updatePoliticianPhotos() {
  console.log('Loading politician data...');
  const politicians = loadPoliticianData();
  
  console.log('Fetching official member data...');
  const oireachtasMembers = await fetchOireachtasMembers();
  
  let matchedCount = 0;
  let updatedCount = 0;
  
  console.log(`Matching ${politicians.length} politicians with ${oireachtasMembers.length} API records...`);
  
  politicians.forEach(politician => {
    const normalizedPoliticianName = normalizeNameForMatching(politician.name);
    
    // Find matching member in API data
    const matchingMember = oireachtasMembers.find(member => {
      if (!member.member) return false;
      
      const memberName = `${member.member.firstName || ''} ${member.member.lastName || ''}`.trim();
      const normalizedMemberName = normalizeNameForMatching(memberName);
      
      return normalizedMemberName === normalizedPoliticianName;
    });
    
    if (matchingMember) {
      matchedCount++;
      const imageUrl = findBestImageUrl(matchingMember);
      
      if (imageUrl && imageUrl !== politician.imageUrl) {
        politician.imageUrl = imageUrl;
        updatedCount++;
        console.log(`Updated photo for ${politician.name}: ${imageUrl}`);
      }
    } else {
      // For unmatched politicians, use a consistent fallback approach
      if (!politician.imageUrl || politician.imageUrl.includes('placeholder') || politician.imageUrl.includes('via.placeholder')) {
        politician.imageUrl = "";  // Empty string will show initials
      }
    }
  });
  
  console.log(`\nMatched ${matchedCount} politicians with API data`);
  console.log(`Updated ${updatedCount} photo URLs`);
  
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
  console.log(`\nUpdated politician data file with ${politicians.length} politicians`);
}

// Run the photo update
try {
  const updatedPoliticians = await updatePoliticianPhotos();
  writePoliticianData(updatedPoliticians);
  console.log('✅ Authentic photo URLs updated successfully');
} catch (error) {
  console.error('Error updating photo URLs:', error);
  process.exit(1);
}