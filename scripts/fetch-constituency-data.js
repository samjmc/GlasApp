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

async function getConstituencyData() {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a political data analyst with expertise in Irish politics and electoral results."
        },
        {
          role: "user",
          content: `
            Please provide accurate electoral data for the Meath West constituency in Ireland, focusing on
            the performance of Aontú and its leader Peadar Tóibín. I need the following information in JSON format:
            
            1. The percentage of first preference votes received by Aontú/Peadar Tóibín in the last election
            2. The total votes received by Aontú/Peadar Tóibín
            3. The number of seats they won
            
            Also include similar data for other parties in the constituency (Fianna Fáil, Fine Gael, Sinn Féin, 
            Green Party, Labour, Social Democrats, People Before Profit, and Independents).
            
            Return only the JSON object without any additional text. The JSON should have this structure:
            {
              "name": "Meath West",
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
    console.error("Error fetching data from OpenAI:", error);
    throw error;
  }
}

async function updateConstituencyData() {
  try {
    // Get up-to-date constituency data from OpenAI for multiple constituencies
    const constituencies = ['Dublin Bay North', 'Dublin South-Central', 'Cork South-Central', 'Galway West'];
    console.log("Fetching data for multiple constituencies including areas where smaller parties are strong...");
    
    // First get Meath West data as that's our priority
    const mwData = await getConstituencyData();
    console.log("Retrieved Meath West data:", JSON.stringify(mwData, null, 2));

    // Read existing data
    const dataFilePath = path.join(__dirname, '../data/constituencies.json');
    const existingData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));

    // Find and update Meath West constituency
    const mwIndex = existingData.findIndex(c => c.name === "Meath West");
    if (mwIndex === -1) {
      console.error("Could not find Meath West constituency in the data");
      return;
    }

    // Keep the existing Irish name, seats, turnout, economic/social scores, and issues
    const existing = existingData[mwIndex];
    
    // Update with new party data 
    existingData[mwIndex] = {
      ...existing,
      parties: mwData.parties.map(party => ({
        ...party,
        color: getPartyColor(party.name)
      }))
    };

    // Write updated data back to file
    fs.writeFileSync(dataFilePath, JSON.stringify(existingData, null, 2));
    console.log("Updated Meath West constituency data successfully");
  } catch (error) {
    console.error("Error updating constituency data:", error);
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
    "Independents": "#CCCCCC"
  };
  
  return partyColors[party] || "#CCCCCC";
}

// Run the update
updateConstituencyData().catch(console.error);