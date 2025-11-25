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

// Get the constituency name from command line arguments
const constituencyName = process.argv[2];

if (!constituencyName) {
  console.error("Please provide a constituency name as an argument");
  process.exit(1);
}

async function getConstituencyData(constituencyName) {
  try {
    console.log(`Fetching data for ${constituencyName}...`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Using cheaper model
      messages: [
        {
          role: "system",
          content: "You are a political data analyst with expertise in Irish politics and electoral results."
        },
        {
          role: "user",
          content: `
            Generate accurate electoral data for the ${constituencyName} constituency in Ireland for the most recent general election.
            Include ALL political parties that ran candidates, with vote counts, percentages, and seats won.
            
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
            
            Important: Include only parties that ran candidates in this constituency. If a party didn't run a candidate, do not include it.
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

async function updateSingleConstituency() {
  try {
    // Read existing data
    const dataFilePath = path.join(__dirname, '../data/constituencies.json');
    const existingData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
    
    // Get updated data
    const newData = await getConstituencyData(constituencyName);
    
    if (newData) {
      // Find the constituency in the existing data
      const index = existingData.findIndex(c => c.name === constituencyName);
      
      if (index !== -1) {
        // Keep the existing Irish name, seats, turnout, economic/social scores, and issues
        const metadata = existingData[index];
        
        // Update parties data
        existingData[index].parties = newData.parties.map(party => ({
          ...party,
          color: getPartyColor(party.name)
        }));
        
        // Write updated data back to file
        fs.writeFileSync(dataFilePath, JSON.stringify(existingData, null, 2));
        console.log(`Updated ${constituencyName} successfully.`);
      } else {
        console.warn(`Could not find ${constituencyName} in existing data.`);
      }
    }
  } catch (error) {
    console.error("Error updating constituency data:", error);
  }
}

// Run the update
updateSingleConstituency().catch(console.error);