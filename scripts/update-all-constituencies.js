import OpenAI from "openai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name properly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// List of all Irish constituencies
const allConstituencies = [
  "Carlow–Kilkenny", "Cavan–Monaghan", "Clare", "Cork East", "Cork North-Central",
  "Cork North-West", "Cork South-Central", "Cork South-West", "Donegal", "Dublin Bay North",
  "Dublin Bay South", "Dublin Central", "Dublin Fingal", "Dublin Mid-West", "Dublin North-West",
  "Dublin Rathdown", "Dublin South-Central", "Dublin South-West", "Dublin West", "Dún Laoghaire",
  "Galway East", "Galway West", "Kerry", "Kildare North", "Kildare South", "Laois–Offaly",
  "Limerick City", "Limerick County", "Longford–Westmeath", "Louth", "Mayo", "Meath East", 
  "Meath West", "Roscommon–Galway", "Sligo-Leitrim", "Tipperary", "Waterford", "Wexford", 
  "Wicklow"
];

// Create a throttled version of data fetching to avoid rate limits
async function getConstituencyDataWithDelay(constituency, index) {
  // Add a delay based on index to avoid rate limits
  const delay = index * 1500; // 1.5 seconds between requests
  await new Promise(resolve => setTimeout(resolve, delay));
  
  return getConstituencyData(constituency);
}

async function getConstituencyData(constituencyName) {
  try {
    console.log(`Fetching data for ${constituencyName}...`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Using cheaper model as requested
      messages: [
        {
          role: "system",
          content: "You are a political data analyst with expertise in Irish politics and electoral results from the most recent general election."
        },
        {
          role: "user",
          content: `
            Generate accurate electoral data for the ${constituencyName} constituency in Ireland for the most recent general election.
            Include ALL political parties that ran candidates, with exact vote counts, percentages, and seats won.
            
            Make sure to include data for:
            - Fianna Fáil
            - Fine Gael
            - Sinn Féin 
            - Green Party
            - Labour
            - Social Democrats
            - Aontú (if they ran)
            - People Before Profit / Solidarity (if they ran)
            - Any other parties that ran candidates
            - Independents (combine all independent candidates)
            
            Return ONLY a JSON object with this structure:
            {
              "name": "${constituencyName}",
              "parties": [
                {
                  "name": "Party Name",
                  "votes": number,
                  "seats": number,
                  "percent": number (precise to one decimal place)
                }
              ]
            }
            
            Rules:
            1. Include ALL parties that ran candidates, omitting only those that didn't run anyone
            2. The vote percentages should add up to 100%
            3. The seat allocation should match the actual election results
            4. For "percent", use the percentage of first preference votes
          `
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2 // Lower temperature for more factual outputs
    });

    const data = JSON.parse(response.choices[0].message.content);
    return data;
  } catch (error) {
    console.error(`Error fetching data for ${constituencyName}:`, error.message);
    return null;
  }
}

// Helper function to get party colors
function getPartyColor(party) {
  const partyColors = {
    "Fianna Fáil": "#66BB66",
    "Fine Gael": "#6699FF",
    "Sinn Féin": "#326760",
    "Green Party": "#99CC33",
    "Labour": "#CC0000",
    "Social Democrats": "#752F8B",
    "Aontú": "#FF5300",
    "People Before Profit": "#800000",
    "People Before Profit–Solidarity": "#800000",
    "Solidarity–People Before Profit": "#800000",
    "Solidarity": "#800000",
    "Independents": "#CCCCCC",
    "Independent": "#CCCCCC",
    "Workers' Party": "#CC0000",
    "Irish Freedom Party": "#0066CC",
    "National Party": "#000066",
    "Right to Change": "#FF9900",
    "Irish Democratic Party": "#009966",
    "Independent Ireland": "#FF9900"
  };
  
  return partyColors[party] || "#CCCCCC";
}

async function updateAllConstituencyData() {
  try {
    // Read existing data
    const dataFilePath = path.join(__dirname, '../data/constituencies.json');
    const existingData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
    
    // Store the existing non-party data by constituency name
    const existingMetadata = {};
    existingData.forEach(constituency => {
      existingMetadata[constituency.name] = {
        nameIrish: constituency.nameIrish,
        seats: constituency.seats,
        turnout: constituency.turnout,
        economicScore: constituency.economicScore,
        socialScore: constituency.socialScore,
        issues: constituency.issues
      };
    });
    
    // Create a new array to hold all updated data
    const updatedData = [];
    
    // Process all constituencies
    console.log(`Starting to update ${allConstituencies.length} constituencies...`);
    
    // Process in smaller batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < allConstituencies.length; i += batchSize) {
      const batch = allConstituencies.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}...`);
      
      // Process each constituency in the batch
      const batchPromises = batch.map((constituency, index) => 
        getConstituencyDataWithDelay(constituency, index)
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Update data with the results
      batchResults.forEach(newData => {
        if (!newData) return; // Skip if there was an error
        
        const constituencyName = newData.name;
        const metadata = existingMetadata[constituencyName];
        
        if (!metadata) {
          console.warn(`Missing metadata for ${constituencyName}, using defaults`);
        }
        
        updatedData.push({
          name: constituencyName,
          nameIrish: metadata?.nameIrish || "",
          seats: metadata?.seats || newData.parties.reduce((sum, p) => sum + p.seats, 0),
          parties: newData.parties.map(party => ({
            ...party,
            color: getPartyColor(party.name)
          })),
          turnout: metadata?.turnout || 65.0,
          economicScore: metadata?.economicScore || 0,
          socialScore: metadata?.socialScore || 0,
          issues: metadata?.issues || {
            housing: { support: 70, opposition: 30 },
            healthcare: { support: 75, opposition: 25 },
            climate: { support: 60, opposition: 40 },
            economy: { support: 65, opposition: 35 },
            education: { support: 70, opposition: 30 },
            immigration: { support: 50, opposition: 50 }
          }
        });
        
        console.log(`Updated ${constituencyName} successfully.`);
      });
      
      // Wait between batches to avoid rate limits
      if (i + batchSize < allConstituencies.length) {
        console.log("Waiting before next batch...");
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Write updated data back to file
    fs.writeFileSync(dataFilePath, JSON.stringify(updatedData, null, 2));
    console.log(`Successfully updated ${updatedData.length} constituencies!`);
    
  } catch (error) {
    console.error("Error updating constituency data:", error);
  }
}

// Run the update
updateAllConstituencyData().catch(console.error);