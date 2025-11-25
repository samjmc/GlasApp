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

// List of all 43 Irish constituencies
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

// Smaller batch to process first (constituencies with significant smaller party presence)
const priorityConstituencies = [
  "Meath West", "Dublin South-Central", "Cork South-Central", "Dublin Bay North",
  "Dublin Central", "Dublin Rathdown"
];

async function getConstituencyData(constituencyName) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Using cheaper model as requested
      messages: [
        {
          role: "system",
          content: "You are a political data analyst with expertise in Irish politics and electoral results."
        },
        {
          role: "user",
          content: `
            Please provide accurate electoral data for the ${constituencyName} constituency in Ireland,
            focusing on the performance of all political parties including smaller ones like Aontú
            and People Before Profit. I need the following information in JSON format:
            
            1. The percentage of first preference votes received by each party in the last election
            2. The total votes received by each party
            3. The number of seats they won
            
            Include data for: Fianna Fáil, Fine Gael, Sinn Féin, Green Party, Labour, 
            Social Democrats, Aontú, People Before Profit, and Independents.
            
            Return only the JSON object without any additional text. The JSON should have this structure:
            {
              "name": "${constituencyName}",
              "parties": [
                {
                  "name": "Party Name",
                  "votes": number,
                  "seats": number,
                  "percent": number
                },
                ...
              ]
            }
          `
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error(`Error fetching data for ${constituencyName} from OpenAI:`, error);
    return null;
  }
}

async function updateAllConstituencies() {
  try {
    // Read existing data
    const dataFilePath = path.join(__dirname, '../data/constituencies.json');
    const existingData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
    
    // First update priority constituencies
    console.log("Starting with priority constituencies...");
    for (const constituency of priorityConstituencies) {
      console.log(`Fetching data for ${constituency}...`);
      const newData = await getConstituencyData(constituency);
      
      if (newData) {
        // Find constituency index
        const index = existingData.findIndex(c => c.name === constituency);
        
        if (index !== -1) {
          // Keep the existing Irish name, seats, turnout, economic/social scores, and issues
          const existing = existingData[index];
          
          // Update with new party data 
          existingData[index] = {
            ...existing,
            parties: newData.parties.map(party => ({
              ...party,
              color: getPartyColor(party.name)
            }))
          };
          
          console.log(`Updated ${constituency} successfully.`);
        } else {
          console.log(`Could not find ${constituency} in existing data.`);
        }
      }
      
      // Brief pause to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Write updated data back to file
    fs.writeFileSync(dataFilePath, JSON.stringify(existingData, null, 2));
    console.log("All priority constituencies updated successfully");
    
    // Return whether we should continue with the rest
    return true;
  } catch (error) {
    console.error("Error updating constituencies:", error);
    return false;
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
    "Independents": "#CCCCCC",
    "Solidarity–People Before Profit": "#800000", // In case the API returns this variation
    "Independent": "#CCCCCC",
    "Workers' Party": "#CC0000",
    "Irish Freedom Party": "#0066CC",
    "National Party": "#000066",
    "Right to Change": "#FF9900",
    "Irish Democratic Party": "#009966"
  };
  
  return partyColors[party] || "#CCCCCC";
}

// Run the update
updateAllConstituencies().catch(console.error);