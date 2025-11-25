import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize OpenAI with the latest SDK
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Uses OpenAI to analyze and extract election results from Wikipedia data
 * @param {string} constituencyName - The name of the constituency to analyze
 * @returns {Promise<Object>} - An object containing the parsed election results
 */
async function getWikipediaResults(constituencyName) {
  console.log(`Fetching Wikipedia data for ${constituencyName}...`);
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a political data analyst specializing in Irish elections. Your task is to extract the most recent election results for the requested constituency from Wikipedia. Return only the JSON data."
        },
        {
          role: "user",
          content: `Search Wikipedia for the most recent election results for the ${constituencyName} constituency in Ireland. Extract first-preference vote percentages for each party that ran candidates. Return the data in this JSON format:
          {
            "name": "${constituencyName}",
            "parties": [
              {
                "name": "[Party Name]",
                "percent": [vote percentage as number],
                "seats": [number of seats won, if available]
              },
              ...
            ],
            "turnout": [voter turnout percentage as number, if available],
            "source": "Wikipedia"
          }
          Include the following parties if they ran candidates: Fianna Fáil, Fine Gael, Sinn Féin, Green Party, Labour Party, Social Democrats, People Before Profit, Aontú, and any significant independents or other parties.`
        }
      ],
      temperature: 0.3, // Lower temperature for more factual responses
      response_format: { type: "json_object" } // Ensure we get properly formatted JSON back
    });

    const resultText = response.choices[0].message.content;
    
    // Parse the JSON directly since we're using response_format: { type: "json_object" }
    const data = JSON.parse(resultText);
    console.log(`Successfully extracted data for ${constituencyName} from Wikipedia`);
    
    return data;
  } catch (error) {
    console.error(`Error fetching Wikipedia data for ${constituencyName}:`, error);
    throw error;
  }
}

/**
 * Applies standard party colors to the results data
 * @param {Array} parties - The array of party results
 * @returns {Array} - The parties array with colors added
 */
function applyPartyColors(parties) {
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

  return parties.map(party => {
    const colorKey = Object.keys(partyColors).find(key => 
      party.name.includes(key)
    );
    
    return {
      ...party,
      color: colorKey ? partyColors[colorKey] : "#757575" // Default gray for unknown parties
    };
  });
}

/**
 * Updates a single constituency with data from Wikipedia
 * @param {string} constituencyName - The name of the constituency to update
 */
async function updateConstituencyWithWikipedia(constituencyName) {
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
    
    // Get fresh data from Wikipedia
    const wikiData = await getWikipediaResults(constituencyName);
    
    // Apply standard party colors
    wikiData.parties = applyPartyColors(wikiData.parties);
    
    // Find and update the constituency
    const existingIndex = allConstituencies.findIndex(c => c.name === constituencyName);
    
    if (existingIndex >= 0) {
      // Update existing record
      allConstituencies[existingIndex] = {
        ...allConstituencies[existingIndex],
        parties: wikiData.parties,
        turnout: wikiData.turnout || allConstituencies[existingIndex].turnout,
        source: "Wikipedia"
      };
    } else {
      // Add new record
      allConstituencies.push(wikiData);
    }
    
    // Save updated data
    fs.writeFileSync(filePath, JSON.stringify(allConstituencies, null, 2));
    
    console.log(`Updated ${constituencyName} with Wikipedia data successfully.`);
    return wikiData;
  } catch (error) {
    console.error(`Error updating constituency with Wikipedia data:`, error);
    throw error;
  }
}

// Allow running from command line with a constituency name argument
// In ES modules, we can check if this is the main module by comparing import.meta.url
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const constituencyName = process.argv[2];
  
  if (!constituencyName) {
    console.error('Please provide a constituency name as an argument');
    process.exit(1);
  }
  
  updateConstituencyWithWikipedia(constituencyName)
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

export {
  getWikipediaResults,
  updateConstituencyWithWikipedia
};