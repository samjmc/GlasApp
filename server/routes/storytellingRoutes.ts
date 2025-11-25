import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { ConstituencyStory, getStoryFromCache, addStoryToCache } from './constituencyStoryCache';

// Initialize OpenAI client lazily
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required but not set. Storytelling features are disabled.');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
}

// Create router
const router = Router();

/**
 * Generates a story for a constituency using OpenAI
 * @param constituencyName - The name of the constituency
 * @param parties - The party data for the constituency
 * @returns A promise that resolves to a ConstituencyStory object
 */
async function generateConstituencyStory(
  constituencyName: string,
  parties: Array<{ name: string; percent: number; seats: number }>
): Promise<ConstituencyStory> {
  try {
    // Create a description of the current political landscape based on party data
    const partyDescription = parties
      .sort((a, b) => b.percent - a.percent)
      .map(party => `${party.name}: ${party.percent}% of votes, ${party.seats || 0} seats`)
      .join('; ');

    const response = await getOpenAIClient().chat.completions.create({
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
      return JSON.parse(response.choices[0].message.content) as ConstituencyStory;
    }
    
    // Return fallback if no valid content
    return getFallbackStory(constituencyName);
  } catch (error) {
    console.error('Error generating constituency story:', error);
    return getFallbackStory(constituencyName);
  }
}

// Helper function to get a fallback story if API fails
function getFallbackStory(constituencyName: string): ConstituencyStory {
  return {
    historicalFact: `${constituencyName} has a rich electoral history in Irish politics.`,
    politicalTrend: "The constituency shows typical Irish voting patterns across elections.",
    keyIssues: ["Local development", "Infrastructure", "Public services"],
    economicFocus: "Mixed economy with various sectors represented."
  };
}

// API endpoint to get constituency story
router.post('/:constituencyName', async (req: Request, res: Response) => {
  const { constituencyName } = req.params;
  const parties = req.body.parties || [];
  
  try {
    // First check if story is in cache
    const cachedStory = getStoryFromCache(constituencyName);
    if (cachedStory) {
      console.log(`Using cached story for ${constituencyName}`);
      return res.json({
        success: true,
        data: cachedStory
      });
    }
    
    // Generate new story if not in cache
    console.log(`Generating new story for ${constituencyName}`);
    const story = await generateConstituencyStory(constituencyName, parties);
    
    // Save to cache
    addStoryToCache(constituencyName, story);
    
    return res.json({
      success: true,
      data: story
    });
  } catch (error) {
    console.error(`Error getting story for ${constituencyName}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate constituency story',
      error: (error as Error).message
    });
  }
});

export default router;