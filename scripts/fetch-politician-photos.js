/**
 * Script to fetch authentic politician photos from multiple official sources
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

function generateOireachtasPhotoUrls(politician) {
  // Generate multiple possible photo URLs for each politician
  const name = politician.name;
  const nameVariations = [
    name.replace(/\s+/g, '-'),
    name.replace(/\s+/g, '-').replace(/[áàâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i').replace(/[óòôö]/g, 'o').replace(/[úùûü]/g, 'u'),
    name.replace(/\s+/g, '-').replace(/'/g, '').replace(/'/g, ''),
    name.replace(/\s+/g, '-').toLowerCase(),
    name.split(' ').join('-').replace(/[^a-zA-Z0-9-]/g, '')
  ];

  const photoUrls = [];
  
  // Try various Oireachtas image URL patterns
  nameVariations.forEach(nameVariation => {
    photoUrls.push(`https://www.oireachtas.ie/en/members/member/${nameVariation}.D.2020-02-08/image/`);
    photoUrls.push(`https://www.oireachtas.ie/en/members/member/${nameVariation}.D.2016-02-26/image/`);
    photoUrls.push(`https://www.oireachtas.ie/en/members/member/${nameVariation}.D.2011-03-09/image/`);
    photoUrls.push(`https://www.oireachtas.ie/en/members/member/${nameVariation}/image/`);
    photoUrls.push(`https://data.oireachtas.ie/ie/oireachtas/member/dail/${nameVariation}/image/medium`);
    photoUrls.push(`https://data.oireachtas.ie/ie/oireachtas/member/dail/${nameVariation}/image/large`);
  });

  return photoUrls;
}

async function testImageUrl(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok && response.headers.get('content-type')?.startsWith('image/');
  } catch (error) {
    return false;
  }
}

async function findWorkingPhotoUrl(politician) {
  const possibleUrls = generateOireachtasPhotoUrls(politician);
  
  for (const url of possibleUrls) {
    const isWorking = await testImageUrl(url);
    if (isWorking) {
      console.log(`Found working photo for ${politician.name}: ${url}`);
      return url;
    }
  }
  
  return null;
}

async function updatePoliticianPhotos() {
  console.log('Loading politician data...');
  const politicians = loadPoliticianData();
  
  console.log(`Testing photo URLs for ${politicians.length} politicians...`);
  
  let updatedCount = 0;
  const batchSize = 5; // Process in small batches to avoid overwhelming servers
  
  for (let i = 0; i < politicians.length; i += batchSize) {
    const batch = politicians.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (politician) => {
      if (!politician.imageUrl || politician.imageUrl === "") {
        const workingUrl = await findWorkingPhotoUrl(politician);
        if (workingUrl) {
          politician.imageUrl = workingUrl;
          updatedCount++;
        }
      }
    }));
    
    // Small delay between batches
    if (i + batchSize < politicians.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Processed ${Math.min(i + batchSize, politicians.length)}/${politicians.length} politicians`);
  }
  
  console.log(`\nUpdated ${updatedCount} politician photo URLs`);
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

// Run the photo fetching
try {
  const updatedPoliticians = await updatePoliticianPhotos();
  writePoliticianData(updatedPoliticians);
  console.log('Authentic politician photos updated successfully');
} catch (error) {
  console.error('Error updating politician photos:', error);
  process.exit(1);
}