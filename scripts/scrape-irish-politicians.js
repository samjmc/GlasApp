/**
 * Web scraping script for Irish politician data from official sources
 * Targets Oireachtas.ie and ElectionsIreland.org for comprehensive data
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Official Irish political data sources
const OIREACHTAS_MEMBERS_URL = 'https://www.oireachtas.ie/en/members/';
const ELECTIONS_IRELAND_URL = 'https://electionsireland.org/';
const HOUSES_OIREACHTAS_API = 'https://api.oireachtas.ie/v1/members';

/**
 * Scrape current TDs from Oireachtas.ie
 */
async function scrapeOireachtasTDs() {
  try {
    console.log('Scraping current TDs from Oireachtas.ie...');
    
    const response = await axios.get(`${OIREACHTAS_MEMBERS_URL}dail/`);
    const $ = cheerio.load(response.data);
    
    const tds = [];
    
    $('.member-card').each((i, element) => {
      const $card = $(element);
      const name = $card.find('.member-name').text().trim();
      const party = $card.find('.member-party').text().trim();
      const constituency = $card.find('.member-constituency').text().trim();
      const imageUrl = $card.find('.member-image img').attr('src');
      const profileUrl = $card.find('a').attr('href');
      
      if (name && constituency) {
        tds.push({
          name,
          party,
          constituency,
          imageUrl: imageUrl ? `https://www.oireachtas.ie${imageUrl}` : null,
          profileUrl: profileUrl ? `https://www.oireachtas.ie${profileUrl}` : null,
          type: 'TD',
          elected: true
        });
      }
    });
    
    console.log(`Found ${tds.length} current TDs`);
    return tds;
    
  } catch (error) {
    console.error('Error scraping Oireachtas TDs:', error.message);
    return [];
  }
}

/**
 * Scrape 2024 election results from ElectionsIreland.org
 */
async function scrapeElectionResults() {
  try {
    console.log('Scraping 2024 election results...');
    
    const response = await axios.get(`${ELECTIONS_IRELAND_URL}results/general/2024/`);
    const $ = cheerio.load(response.data);
    
    const candidates = [];
    
    // Find constituency links
    const constituencyLinks = [];
    $('a[href*="/constituency/"]').each((i, element) => {
      const href = $(element).attr('href');
      if (href && href.includes('2024')) {
        constituencyLinks.push(`${ELECTIONS_IRELAND_URL}${href}`);
      }
    });
    
    console.log(`Found ${constituencyLinks.length} constituency result pages`);
    
    // Scrape each constituency (limit to first few for testing)
    for (const link of constituencyLinks.slice(0, 5)) {
      try {
        const constResponse = await axios.get(link);
        const const$ = cheerio.load(constResponse.data);
        
        const constituency = const$('h1').text().trim();
        
        const$('.candidate-row, .result-row').each((i, element) => {
          const $row = const$(element);
          const name = $row.find('.candidate-name').text().trim();
          const party = $row.find('.party-name').text().trim();
          const votes = $row.find('.votes').text().trim();
          const elected = $row.hasClass('elected') || $row.find('.elected').length > 0;
          
          if (name && constituency) {
            candidates.push({
              name,
              party,
              constituency,
              votes: parseInt(votes.replace(/,/g, '')) || 0,
              elected,
              type: elected ? 'TD' : 'Candidate'
            });
          }
        });
        
        // Small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (constError) {
        console.error(`Error scraping constituency ${link}:`, constError.message);
      }
    }
    
    console.log(`Found ${candidates.length} candidates from election results`);
    return candidates;
    
  } catch (error) {
    console.error('Error scraping election results:', error.message);
    return [];
  }
}

/**
 * Use the official Oireachtas API
 */
async function fetchOireachtasAPI() {
  try {
    console.log('Fetching data from official Oireachtas API...');
    
    const response = await axios.get(HOUSES_OIREACHTAS_API, {
      params: {
        date_start: '2024-12-01',
        chamber_id: 'dail',
        house_no: '34',
        limit: 200
      }
    });
    
    const members = response.data.results || [];
    console.log(`Found ${members.length} members from API`);
    console.log('Sample member data:', JSON.stringify(members[0], null, 2));
    
    return members.map(member => {
      const memberData = member.member || member;
      const name = memberData.fullName || memberData.name || '';
      
      // Extract party from the most recent membership
      let party = '';
      let constituency = '';
      let imageUrl = memberData.image?.url || null;
      
      if (memberData.memberships && memberData.memberships.length > 0) {
        // Get the most recent membership (usually last in array)
        const latestMembership = memberData.memberships[memberData.memberships.length - 1];
        const membership = latestMembership.membership;
        
        // Extract party
        if (membership.parties && membership.parties.length > 0) {
          party = membership.parties[0].party.showAs || '';
        }
        
        // Extract constituency (for Dáil members)
        if (membership.represents && membership.represents.length > 0) {
          const represent = membership.represents[0].represent;
          if (represent.representType === 'constituency') {
            constituency = represent.showAs || '';
          }
        }
      }
      
      console.log(`Processing: ${name} - ${party} - ${constituency}`);
      
      return {
        name,
        party,
        constituency,
        imageUrl,
        type: 'TD',
        elected: true,
        apiData: member
      };
    }).filter(member => member.name && member.constituency);
    
  } catch (error) {
    console.error('Oireachtas API error:', error.message);
    console.log('You may need to check API endpoint or provide authentication if required');
    return [];
  }
}

/**
 * Get comprehensive constituency list
 */
async function getConstituencyList() {
  try {
    const response = await axios.get('https://www.oireachtas.ie/en/members/dail/');
    const $ = cheerio.load(response.data);
    
    const constituencies = new Set();
    $('.member-constituency').each((i, element) => {
      const constituency = $(element).text().trim();
      if (constituency) {
        constituencies.add(constituency);
      }
    });
    
    return Array.from(constituencies).sort();
  } catch (error) {
    console.error('Error getting constituencies:', error.message);
    return [];
  }
}

/**
 * Transform to politician format
 */
function transformToPolititianFormat(rawData) {
  const partyMapping = {
    'Fianna Fáil': 'ie-ff',
    'Fine Gael': 'ie-fg', 
    'Sinn Féin': 'ie-sf',
    'Labour Party': 'ie-labour',
    'Green Party': 'ie-green',
    'Social Democrats': 'ie-sd',
    'People Before Profit': 'ie-pbp',
    'Solidarity': 'ie-pbp',
    'Aontú': 'ie-aontu',
    'Independent Ireland': 'ie-independent-ireland',
    'Irish Freedom Party': 'ie-irish-freedom',
    'Independent': 'ie-independent',
    'Non-Party': 'ie-independent'
  };
  
  const partyPositions = {
    'ie-ff': { economic: 1, social: 1 },
    'ie-fg': { economic: 3, social: 0.5 },
    'ie-sf': { economic: -5, social: -2 },
    'ie-labour': { economic: -4, social: -3 },
    'ie-green': { economic: -2, social: -4 },
    'ie-sd': { economic: -3, social: -5 },
    'ie-pbp': { economic: -8, social: -7 },
    'ie-aontu': { economic: -2, social: 4 },
    'ie-independent-ireland': { economic: 0, social: 2 },
    'ie-irish-freedom': { economic: 2, social: 6 },
    'ie-independent': { economic: 0, social: 0 }
  };
  
  const partyId = partyMapping[rawData.party] || 'ie-independent';
  const positions = partyPositions[partyId] || { economic: 0, social: 0 };
  
  return {
    id: rawData.name.toLowerCase()
      .replace(/[áàâäã]/g, 'a')
      .replace(/[éèêë]/g, 'e') 
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòôöõ]/g, 'o')
      .replace(/[úùûü]/g, 'u')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, ''),
    name: rawData.name,
    partyId,
    title: rawData.elected ? 'TD' : 'Former Candidate',
    bio: `${rawData.name} ${rawData.elected ? 'represents' : 'ran in'} ${rawData.constituency} for ${rawData.party || 'Independent'}.`,
    imageUrl: rawData.imageUrl || 'https://via.placeholder.com/400x400/cccccc/666666?text=No+Photo',
    economic: positions.economic,
    social: positions.social,
    constituency: rawData.constituency,
    signature_policies: getDefaultPolicies(rawData.party),
    lastUpdated: new Date().toISOString()
  };
}

function getDefaultPolicies(party) {
  const policies = {
    'Fianna Fáil': ['Housing development', 'Healthcare investment', 'Economic growth'],
    'Fine Gael': ['Economic stability', 'Digital transformation', 'EU integration'],
    'Sinn Féin': ['Irish unity', 'Public housing', 'Healthcare reform'],
    'Labour Party': ['Workers rights', 'Social welfare', 'Education funding'],
    'Green Party': ['Climate action', 'Environmental protection', 'Sustainable transport'],
    'Social Democrats': ['Social justice', 'Public services', 'Democratic reform'],
    'People Before Profit': ['Workers rights', 'Anti-austerity', 'Public ownership'],
    'Aontú': ['Pro-life policies', 'Rural development', 'Family values']
  };
  
  return policies[party] || ['Local representation', 'Community development', 'Public service'];
}

/**
 * Main execution function
 */
async function runPoliticianImport() {
  try {
    console.log('Starting comprehensive Irish politician data import...');
    
    // Fetch from multiple sources
    const [oireachtasTDs, electionCandidates, apiMembers] = await Promise.all([
      scrapeOireachtasTDs(),
      scrapeElectionResults(),
      fetchOireachtasAPI()
    ]);
    
    // Combine and deduplicate
    const allPoliticians = new Map();
    
    // Process all sources
    [...apiMembers, ...oireachtasTDs, ...electionCandidates].forEach(politician => {
      if (politician.name && politician.constituency) {
        const transformed = transformToPolititianFormat(politician);
        allPoliticians.set(transformed.id, transformed);
      }
    });
    
    const finalList = Array.from(allPoliticians.values());
    
    console.log(`\nImport Summary:`);
    console.log(`- API Members: ${apiMembers.length}`);
    console.log(`- Scraped TDs: ${oireachtasTDs.length}`);
    console.log(`- Election Candidates: ${electionCandidates.length}`);
    console.log(`- Total Unique Politicians: ${finalList.length}`);
    
    // Update the politician data file
    await updatePoliticianFile(finalList);
    
    console.log('\nPolitician import completed successfully!');
    
    return finalList;
    
  } catch (error) {
    console.error('Import failed:', error);
  }
}

async function updatePoliticianFile(politicians) {
  const filePath = path.join(__dirname, '../shared/politicianData.ts');
  
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
}

// Imported politician database - ${new Date().toLocaleDateString()}
export const politicians: Politician[] = ${JSON.stringify(politicians, null, 2)};
`;

  await fs.writeFile(filePath, content, 'utf8');
  console.log('Updated politicianData.ts file');
}

// Run the script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPoliticianImport().catch(console.error);
}

export { runPoliticianImport };