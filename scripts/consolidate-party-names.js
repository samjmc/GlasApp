import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths
const DATA_DIR = path.join(__dirname, '../data');
const CONSTITUENCIES_PATH = path.join(DATA_DIR, 'constituencies.json');

// Define party name mappings for consolidation
const partyNameMappings = {
  // Labour variants
  'Labour': 'Labour Party',
  'The Labour Party': 'Labour Party',
  
  // Independent variants
  'Independent': 'Independents',
  'Independent candidate': 'Independents',
  'Independent candidates': 'Independents',
  
  // People Before Profit variants
  'People Before Profit': 'People Before Profit / Solidarity',
  'Solidarity–People Before Profit': 'People Before Profit / Solidarity',
  'Solidarity - People Before Profit': 'People Before Profit / Solidarity',
  'People Before Profit Alliance': 'People Before Profit / Solidarity',
  'Solidarity': 'People Before Profit / Solidarity',
  
  // Sinn Féin variants
  'Sinn Fein': 'Sinn Féin',
  'SF': 'Sinn Féin',
  
  // Fine Gael variants
  'Fine Gael Party': 'Fine Gael',
  'FG': 'Fine Gael',
  
  // Fianna Fáil variants
  'Fianna Fail': 'Fianna Fáil',
  'FF': 'Fianna Fáil',
  
  // Green Party variants
  'Green': 'Green Party',
  'Greens': 'Green Party',
  'The Green Party': 'Green Party',
  
  // Social Democrats variants
  'Social Democrat': 'Social Democrats',
  'SocDems': 'Social Democrats',
  
  // Aontú variants
  'Aontu': 'Aontú'
};

// Party color mapping to ensure consistent colors
const partyColors = {
  'Fianna Fáil': '#66BB6A',
  'Fine Gael': '#2196F3',
  'Sinn Féin': '#4CAF50',
  'Green Party': '#8BC34A',
  'Labour Party': '#F44336',
  'Social Democrats': '#9C27B0',
  'People Before Profit / Solidarity': '#800000', // Maroon
  'Aontú': '#FF5300', // Orange
  'Independents': '#757575',
  'Independents 4 Change': '#607D8B',
  'Independent Ireland': '#795548'
};

/**
 * Load constituency data from file
 */
function loadConstituencyData() {
  try {
    if (fs.existsSync(CONSTITUENCIES_PATH)) {
      const data = fs.readFileSync(CONSTITUENCIES_PATH, 'utf8');
      return JSON.parse(data);
    } else {
      console.error('Constituencies data file not found!');
      return [];
    }
  } catch (error) {
    console.error('Error loading constituency data:', error);
    return [];
  }
}

/**
 * Save constituency data to file
 */
function saveConstituencyData(data) {
  try {
    fs.writeFileSync(CONSTITUENCIES_PATH, JSON.stringify(data, null, 2));
    console.log('Constituency data saved successfully!');
  } catch (error) {
    console.error('Error saving constituency data:', error);
  }
}

/**
 * Consolidate party names in constituency data
 */
function consolidatePartyNames() {
  // Load constituency data
  const constituencies = loadConstituencyData();
  console.log(`Loaded ${constituencies.length} constituencies`);
  
  if (constituencies.length === 0) {
    console.error('No constituencies found. Please ensure the data file exists and is valid.');
    return;
  }
  
  // Process each constituency
  const consolidatedConstituencies = constituencies.map(constituency => {
    // Skip if no parties data
    if (!constituency.parties || !Array.isArray(constituency.parties)) {
      return constituency;
    }
    
    // Group parties by their consolidated names
    const partyGroups = {};
    
    constituency.parties.forEach(party => {
      // Skip if no name
      if (!party.name) return;
      
      // Get the consolidated name
      const consolidatedName = partyNameMappings[party.name] || party.name;
      
      // Initialize the group if it doesn't exist
      if (!partyGroups[consolidatedName]) {
        partyGroups[consolidatedName] = {
          name: consolidatedName,
          color: partyColors[consolidatedName] || party.color || '#757575',
          percent: 0,
          seats: 0
        };
      }
      
      // Add the party's data to the group
      partyGroups[consolidatedName].percent += (party.percent || 0);
      partyGroups[consolidatedName].seats += (party.seats || 0);
    });
    
    // Convert groups back to array and sort by percentage
    const consolidatedParties = Object.values(partyGroups)
      .sort((a, b) => b.percent - a.percent);
    
    // Create updated constituency object
    return {
      ...constituency,
      parties: consolidatedParties
    };
  });
  
  // Save consolidated data
  saveConstituencyData(consolidatedConstituencies);
  console.log('Party names consolidated successfully!');
}

// Run the consolidation
consolidatePartyNames();