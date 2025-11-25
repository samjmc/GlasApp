/**
 * Script to import all Irish politicians and candidates from official sources
 * Combines Electoral Commission data with Oireachtas API for complete coverage
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// API endpoints
const OIREACHTAS_API = 'https://api.oireachtas.ie/v1';
const ELECTORAL_COMMISSION_API = 'https://data.gov.ie/api/3/action';

/**
 * Fetch all current TDs from Oireachtas API
 */
async function fetchCurrentTDs() {
  try {
    console.log('Fetching current TDs from Oireachtas API...');
    const response = await axios.get(`${OIREACHTAS_API}/members`, {
      params: {
        date_start: '2024-11-01', // After 2024 election
        chamber_type: 'house',
        limit: 200
      }
    });
    
    return response.data.results || [];
  } catch (error) {
    console.error('Error fetching TDs:', error.message);
    return [];
  }
}

/**
 * Fetch election candidates from Electoral Commission data
 */
async function fetchElectionCandidates() {
  try {
    console.log('Fetching 2024 election candidates...');
    // Note: This would need the actual API endpoint for Irish electoral data
    // For now, we'll use a placeholder structure
    const response = await axios.get('https://data.gov.ie/api/3/action/package_search', {
      params: {
        q: 'general election 2024 candidates',
        rows: 1000
      }
    });
    
    return response.data.result?.results || [];
  } catch (error) {
    console.error('Error fetching candidates:', error.message);
    return [];
  }
}

/**
 * Scrape constituency and candidate data from ElectionsIreland.org
 */
async function scrapeElectionsIrelandData() {
  try {
    console.log('Scraping comprehensive candidate data...');
    // This would implement web scraping of ElectionsIreland.org
    // For structured data about all candidates
    
    // Placeholder for now - would need actual scraping implementation
    return [];
  } catch (error) {
    console.error('Error scraping data:', error.message);
    return [];
  }
}

/**
 * Get party ID mapping for Irish parties
 */
function getPartyMapping() {
  return {
    'Fianna Fáil': 'ie-ff',
    'Fine Gael': 'ie-fg',
    'Sinn Féin': 'ie-sf',
    'Labour Party': 'ie-labour',
    'Green Party': 'ie-green',
    'Social Democrats': 'ie-sd',
    'People Before Profit': 'ie-pbp',
    'Aontú': 'ie-aontu',
    'Independent Ireland': 'ie-independent-ireland',
    'Irish Freedom Party': 'ie-irish-freedom',
    'Independent': 'ie-independent'
  };
}

/**
 * Estimate political positions based on party affiliation
 */
function estimatePoliticalPosition(partyName) {
  const positions = {
    'Fianna Fáil': { economic: 1, social: 1 },
    'Fine Gael': { economic: 3, social: 0.5 },
    'Sinn Féin': { economic: -5, social: -2 },
    'Labour Party': { economic: -4, social: -3 },
    'Green Party': { economic: -2, social: -4 },
    'Social Democrats': { economic: -3, social: -5 },
    'People Before Profit': { economic: -8, social: -7 },
    'Aontú': { economic: -2, social: 4 },
    'Independent Ireland': { economic: 0, social: 2 },
    'Irish Freedom Party': { economic: 2, social: 6 },
    'Independent': { economic: 0, social: 0 }
  };
  
  return positions[partyName] || { economic: 0, social: 0 };
}

/**
 * Transform raw politician data to our format
 */
function transformPoliticianData(rawData, source = 'api') {
  const partyMapping = getPartyMapping();
  
  return {
    id: generatePoliticianId(rawData.name),
    name: rawData.name || rawData.fullName,
    partyId: partyMapping[rawData.party] || 'ie-independent',
    title: rawData.title || 'TD' || 'Candidate',
    bio: rawData.bio || `${rawData.name} is a ${rawData.party || 'Independent'} politician representing ${rawData.constituency}.`,
    imageUrl: rawData.imageUrl || rawData.photoUrl || getDefaultImage(),
    ...estimatePoliticalPosition(rawData.party),
    constituency: rawData.constituency,
    signature_policies: rawData.policies || generateDefaultPolicies(rawData.party),
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Generate politician ID from name
 */
function generatePoliticianId(name) {
  return name.toLowerCase()
    .replace(/[áàâäã]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôöõ]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Get default image placeholder
 */
function getDefaultImage() {
  return 'https://via.placeholder.com/400x400/cccccc/666666?text=No+Photo';
}

/**
 * Generate default policies based on party
 */
function generateDefaultPolicies(party) {
  const defaultPolicies = {
    'Fianna Fáil': ['Housing development', 'Healthcare investment', 'Economic growth'],
    'Fine Gael': ['Economic stability', 'Digital transformation', 'EU integration'],
    'Sinn Féin': ['Irish unity', 'Public housing', 'Healthcare reform'],
    'Labour Party': ['Workers rights', 'Social welfare', 'Education funding'],
    'Green Party': ['Climate action', 'Environmental protection', 'Sustainable transport'],
    'Social Democrats': ['Social justice', 'Public services', 'Democratic reform'],
    'People Before Profit': ['Workers rights', 'Anti-austerity', 'Public ownership'],
    'Aontú': ['Pro-life policies', 'Rural development', 'Family values'],
    'Independent Ireland': ['National sovereignty', 'Rural issues', 'Traditional values'],
    'Irish Freedom Party': ['National independence', 'Anti-immigration', 'Traditional values']
  };
  
  return defaultPolicies[party] || ['Local representation', 'Community development', 'Public service'];
}

/**
 * Main import function
 */
async function importAllPoliticians() {
  try {
    console.log('Starting comprehensive politician import...');
    
    // Fetch data from multiple sources
    const [currentTDs, electionCandidates, scrapedData] = await Promise.all([
      fetchCurrentTDs(),
      fetchElectionCandidates(),
      scrapeElectionsIrelandData()
    ]);
    
    console.log(`Found ${currentTDs.length} current TDs`);
    console.log(`Found ${electionCandidates.length} election candidates`);
    console.log(`Found ${scrapedData.length} additional candidates`);
    
    // Combine and deduplicate data
    const allCandidates = new Map();
    
    // Process current TDs (highest priority)
    currentTDs.forEach(td => {
      const politician = transformPoliticianData(td, 'oireachtas');
      allCandidates.set(politician.id, politician);
    });
    
    // Process election candidates
    electionCandidates.forEach(candidate => {
      const politician = transformPoliticianData(candidate, 'electoral');
      if (!allCandidates.has(politician.id)) {
        allCandidates.set(politician.id, politician);
      }
    });
    
    // Process scraped data
    scrapedData.forEach(candidate => {
      const politician = transformPoliticianData(candidate, 'scraped');
      if (!allCandidates.has(politician.id)) {
        allCandidates.set(politician.id, politician);
      }
    });
    
    const politicians = Array.from(allCandidates.values());
    console.log(`Total unique politicians: ${politicians.length}`);
    
    // Update the politician data file
    await updatePoliticianDataFile(politicians);
    
    console.log('Politician import completed successfully!');
    
  } catch (error) {
    console.error('Error during import:', error);
  }
}

/**
 * Update the politician data file
 */
async function updatePoliticianDataFile(politicians) {
  const filePath = path.join(__dirname, '../shared/politicianData.ts');
  
  const fileContent = `import { politicalParties } from './data';

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
}

// Comprehensive politician database - automatically imported
export const politicians: Politician[] = ${JSON.stringify(politicians, null, 2)};
`;

  await fs.writeFile(filePath, fileContent, 'utf8');
  console.log('Updated politicianData.ts with new data');
}

// Run the import
if (require.main === module) {
  importAllPoliticians().catch(console.error);
}

module.exports = {
  importAllPoliticians,
  fetchCurrentTDs,
  fetchElectionCandidates
};