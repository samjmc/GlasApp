// Define the structure for constituency stories
export interface ConstituencyStory {
  historicalFact?: string;
  politicalTrend?: string;
  notablePoliticians?: string[];
  keyIssues?: string[];
  economicFocus?: string;
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

import { getCachedStory, cacheStory } from './storyCacheService';

/**
 * Gets or generates a constituency story, using server-side API with caching
 * @param constituencyName - The name of the constituency
 * @param parties - The party data for the constituency
 * @returns A promise that resolves to a ConstituencyStory object
 */
export async function getConstituencyStory(
  constituencyName: string,
  parties: Array<{ name: string; percent: number; seats: number }>
): Promise<ConstituencyStory> {
  try {
    // First check for a client-side cached story
    const cachedStory = getCachedStory(constituencyName);
    if (cachedStory) {
      console.log(`Using client-side cached story for ${constituencyName}`);
      return cachedStory;
    }
    
    // Call the server API which handles caching on the backend
    console.log(`Fetching story for ${constituencyName} from server`);
    const response = await fetch(`/api/constituency/story/${constituencyName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parties }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch story: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.data) {
      // Cache the story on the client side for faster future access
      cacheStory(constituencyName, result.data);
      return result.data;
    } else {
      throw new Error('Invalid response format from server');
    }
  } catch (error) {
    console.error(`Error getting story for ${constituencyName}:`, error);
    return getFallbackStory(constituencyName);
  }
}