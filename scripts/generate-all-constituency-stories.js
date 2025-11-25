import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize OpenAI with the latest SDK
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Define paths
const DATA_DIR = path.join(__dirname, '../data');
const CONSTITUENCIES_PATH = path.join(DATA_DIR, 'constituencies.json');
const STORIES_CACHE_PATH = path.join(DATA_DIR, 'constituency-stories-cache.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load existing cache if available
let storiesCache = {};
if (fs.existsSync(STORIES_CACHE_PATH)) {
  try {
    storiesCache = JSON.parse(fs.readFileSync(STORIES_CACHE_PATH, 'utf8'));
    console.log(`Loaded ${Object.keys(storiesCache).length} existing cached stories`);
  } catch (error) {
    console.error('Error loading stories cache:', error);
  }
}

// Load constituency data
async function loadConstituencyData() {
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
 * Generates a story for a constituency using OpenAI
 * @param constituencyName - The name of the constituency
 * @param parties - The party data for the constituency
 * @returns A promise that resolves to a constituency story object
 */
async function generateConstituencyStory(constituencyName, parties) {
  console.log(`Generating story for ${constituencyName}...`);
  
  try {
    // Create a description of the current political landscape based on party data
    const partyDescription = parties
      .sort((a, b) => b.percent - a.percent)
      .map(party => `${party.name}: ${party.percent}% of votes, ${party.seats || 0} seats`)
      .join('; ');

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        {
          role: "system",
          content: "You are a political analyst specializing in Irish politics and election analysis. Provide concise, accurate information about Irish constituencies."
        },
        {
          role: "user",
          content: `Generate a brief political analysis for the ${constituencyName} constituency in Ireland.
          
          Current party breakdown: ${partyDescription}
          
          Please return your response in JSON format with the following structure:
          {
            "historicalFact": "A brief historical fact about this constituency",
            "politicalTrend": "A short analysis of the voting trends in this constituency",
            "notablePoliticians": ["2-3 notable politicians from this constituency"],
            "keyIssues": ["3-4 key political issues in this constituency"],
            "economicFocus": "The main economic activities or focus of this area"
          }
          
          Keep each field brief - maximum 1-2 sentences for text fields and 2-4 items for arrays.`
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    // Parse and return the JSON response
    if (response.choices[0].message.content) {
      return JSON.parse(response.choices[0].message.content);
    }
    
    throw new Error('No valid content in response');
  } catch (error) {
    console.error(`Error generating story for ${constituencyName}:`, error);
    return getFallbackStory(constituencyName);
  }
}

// Helper function to get a fallback story if API fails
function getFallbackStory(constituencyName) {
  return {
    historicalFact: `${constituencyName} has a rich electoral history in Irish politics.`,
    politicalTrend: "The constituency shows typical Irish voting patterns across elections.",
    notablePoliticians: ["Local representatives"],
    keyIssues: ["Local development", "Infrastructure", "Public services"],
    economicFocus: "Mixed economy with various sectors represented."
  };
}

// Main function to generate all stories
async function generateAllStories() {
  try {
    // Load constituency data
    const constituencies = await loadConstituencyData();
    console.log(`Loaded ${constituencies.length} constituencies`);
    
    if (constituencies.length === 0) {
      console.error('No constituencies found. Please ensure the data file exists and is valid.');
      return;
    }
    
    // Generate stories for each constituency with a delay to avoid rate limiting
    let newStoriesCount = 0;
    
    for (let i = 0; i < constituencies.length; i++) {
      const constituency = constituencies[i];
      const constituencyName = constituency.name;
      
      // Skip if already in cache
      if (storiesCache[constituencyName]) {
        console.log(`Skipping ${constituencyName} - already in cache`);
        continue;
      }
      
      try {
        // Generate new story
        const story = await generateConstituencyStory(constituencyName, constituency.parties || []);
        
        // Add to cache
        storiesCache[constituencyName] = story;
        newStoriesCount++;
        
        // Save cache after each new story to avoid losing data in case of errors
        fs.writeFileSync(STORIES_CACHE_PATH, JSON.stringify(storiesCache, null, 2));
        console.log(`Saved story for ${constituencyName}`);
        
        // Add a delay between requests to avoid rate limiting
        if (i < constituencies.length - 1) {
          console.log('Waiting before next request...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Failed to generate story for ${constituencyName}:`, error);
      }
    }
    
    console.log(`Successfully generated ${newStoriesCount} new stories`);
    console.log(`Total stories in cache: ${Object.keys(storiesCache).length}`);
  } catch (error) {
    console.error('Error generating constituency stories:', error);
  }
}

// Run the main function
generateAllStories()
  .then(() => {
    console.log('All done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error in main process:', err);
    process.exit(1);
  });