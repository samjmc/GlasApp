import { apiRequest } from "@/lib/queryClient";

/**
 * Represents an insight generated for a user
 */
export interface Insight {
  title: string;
  description: string;
  type: string;
  tags?: string[];
  icon?: React.ReactNode;
}

/**
 * Parameters for requesting personalized insights
 */
export interface PersonalizedInsightsParams {
  userId?: number;
  constituencyName: string;
  userEconomicScore?: number;
  userSocialScore?: number;
}

/**
 * Fetches personalized insights based on user political position and constituency
 */
export const getPersonalizedInsights = async (
  params: PersonalizedInsightsParams
): Promise<Insight[]> => {
  try {
    const response = await apiRequest({
      path: '/api/personalized-insights',
      method: 'POST',
      body: params
    });
    
    if (response?.success && Array.isArray(response.data)) {
      return response.data;
    }
    
    throw new Error(response?.message || 'Failed to get personalized insights');
  } catch (error) {
    console.error('Error fetching personalized insights:', error);
    throw error;
  }
};