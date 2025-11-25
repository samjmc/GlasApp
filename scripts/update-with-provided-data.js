import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Updates constituency data with the provided percentages
 * @param {string} constituencyName - The name of the constituency to update
 * @param {Object} partyData - Object containing party percentages
 */
async function updateConstituencyWithProvidedData(constituencyName, partyData) {
  try {
    // Get the file path
    const dataDir = path.join(__dirname, '..', 'data');
    const filePath = path.join(dataDir, 'constituencies.json');
    
    // Read existing data
    let allConstituencies = [];
    if (fs.existsSync(filePath)) {
      const rawData = fs.readFileSync(filePath, 'utf8');
      allConstituencies = JSON.parse(rawData);
    }
    
    // Find the constituency
    const existingIndex = allConstituencies.findIndex(c => c.name === constituencyName);
    
    if (existingIndex >= 0) {
      // For each party in the provided data
      for (const [partyName, percentage] of Object.entries(partyData)) {
        // Find the party in the constituency data
        const partyIndex = allConstituencies[existingIndex].parties.findIndex(
          p => p.name.toLowerCase().includes(partyName.toLowerCase())
        );
        
        if (partyIndex >= 0) {
          // Update existing party
          allConstituencies[existingIndex].parties[partyIndex].percent = percentage;
        } else {
          // Add new party with standard color
          const partyColor = getPartyColor(partyName);
          allConstituencies[existingIndex].parties.push({
            name: partyName,
            percent: percentage,
            seats: 0, // Set seats to 0 by default, can be updated later
            color: partyColor
          });
        }
      }
      
      // Update source
      allConstituencies[existingIndex].source = "User Provided";
      
      // Save updated data
      fs.writeFileSync(filePath, JSON.stringify(allConstituencies, null, 2));
      
      console.log(`Updated ${constituencyName} with provided data successfully.`);
    } else {
      console.error(`Constituency ${constituencyName} not found.`);
    }
  } catch (error) {
    console.error(`Error updating constituency with provided data:`, error);
    throw error;
  }
}

/**
 * Gets the standard color for a party
 * @param {string} partyName - The name of the party
 * @returns {string} - The hex color code
 */
function getPartyColor(partyName) {
  const partyColors = {
    "Fianna Fáil": "#66BB6A",
    "Fine Gael": "#2196F3",
    "Sinn Féin": "#4CAF50",
    "Green Party": "#8BC34A",
    "Labour Party": "#F44336",
    "Social Democrats": "#9C27B0",
    "People Before Profit": "#800000", // Maroon
    "Solidarity–People Before Profit": "#800000", // Maroon
    "Aontú": "#FF5300", // Orange
    "Independent": "#757575",
    "Independents 4 Change": "#607D8B",
    "Independent Ireland": "#795548"
  };

  const colorKey = Object.keys(partyColors).find(key => 
    partyName.toLowerCase().includes(key.toLowerCase())
  );
  
  return colorKey ? partyColors[colorKey] : "#757575"; // Default gray for unknown parties
}

// Update Carlow-Kilkenny with data from user
const carlowKilkennyData = {
  "Fianna Fáil": 35.9,
  "Sinn Féin": 17.2,
  "Fine Gael": 23.6,
  "Social Democrats": 4.9,
  "Labour Party": 2.5,
  "Independent Ireland": 2.1,
  "People Before Profit–Solidarity": 3.4,
  "Aontú": 4.2,
  "Green Party": 1.3,
  "Other parties & independents": 4.9
};

// Run the update function
updateConstituencyWithProvidedData("Carlow–Kilkenny", carlowKilkennyData)
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });

export {
  updateConstituencyWithProvidedData
};