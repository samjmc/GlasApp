import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { IdeologicalDimensions } from "@shared/quizTypes";
import { Skeleton } from "@/components/ui/skeleton";

interface PartyMatch {
  party: string;
  abbreviation: string;
  matchPercentage: number;
  matchReason: string;
  color: string;
}

// Define types for the new API response format
interface PartyMatchesResponse {
  topParties: PartyMatch[];
  bottomParties: PartyMatch[];
}

interface PartyMatchResultsProps {
  dimensions: IdeologicalDimensions;
  weights?: Record<string, number>;
}

const PartyMatchResults: React.FC<PartyMatchResultsProps> = ({ dimensions, weights }) => {
  // Create state for the active weights to use for party matching
  // This allows us to update weights immediately for party matching (which doesn't use OpenAI)
  // while still requiring explicit regeneration for OpenAI-based analysis
  const [activeWeights, setActiveWeights] = useState(weights);
  
  // Get access to the queryClient for manual refetching
  const queryClientHook = useQueryClient();
  
  // Update the activeWeights whenever weights prop changes
  // This will cause the query to automatically re-run, refreshing party matches
  useEffect(() => {
    console.log("Weight prop changed to:", weights);
    setActiveWeights(weights);
    
    // Force immediate refetch when weights change
    if (weights) {
      const currentKey = [
        '/api/party-match/party-matches', 
        JSON.stringify(dimensions),
        JSON.stringify(weights)
      ];
      
      // Invalidate and refetch for immediate UI update
      queryClientHook.invalidateQueries({ queryKey: currentKey });
      queryClientHook.refetchQueries({ queryKey: currentKey });
    }
  }, [weights, dimensions, queryClientHook]);
  
  // Listen for regenerate-analysis events - but check if it's only for analysis
  useEffect(() => {
    const handleRegenerate = (event: any) => {
      console.log("PartyMatchResults: Received regenerate event", event.detail);
      
      // Check if this is only for analysis components
      // If so, we don't need to do anything as party matches are real-time
      if (event.detail?.onlyAnalysis) {
        console.log("Ignoring event as it's only for analysis components");
        return;
      }
      
      // Otherwise proceed with normal regeneration
      const newWeights = event.detail?.weights || weights;
      setActiveWeights(newWeights);
      
      // Force a refresh - this is critical to make the component update visually
      console.log("Triggering react-query cache invalidation...");
      
      // Invalidate and refetch to force a visual update
      const currentKey = [
        '/api/party-match/party-matches', 
        JSON.stringify(dimensions),
        JSON.stringify(newWeights)
      ];
      
      queryClientHook.invalidateQueries({ queryKey: currentKey });
      queryClientHook.refetchQueries({ queryKey: currentKey });
    };
    
    window.addEventListener('regenerate-analysis', handleRegenerate);
    
    return () => {
      window.removeEventListener('regenerate-analysis', handleRegenerate);
    };
  }, [dimensions, weights, queryClientHook]);
  
  // Log dimensions and weights to help with debugging
  useEffect(() => {
    console.log("PartyMatchResults - Using dimensions:", dimensions);
    console.log("PartyMatchResults - Using weights:", activeWeights);
  }, [dimensions, activeWeights]);
  
  // Create a stable query key that includes only active weights
  // This ensures party matching (non-OpenAI) updates immediately with weight changes
  // Check for valid dimensions and activeWeights to avoid undefined errors
  // This is crucial - the key must change when activeWeights change
  const queryKey = [
    '/api/party-match/party-matches', 
    JSON.stringify(dimensions || {}),
    JSON.stringify(activeWeights || {})
  ];
  
  // The party match endpoint doesn't use OpenAI, so it's ok to refetch when weights change
  const { data, isLoading, isError, error } = useQuery<PartyMatchesResponse>({
    queryKey,
    queryFn: async (): Promise<PartyMatchesResponse> => {
      try {
        console.log("Fetching party matches with dimensions:", dimensions);
        console.log("Using custom weights:", activeWeights);
        const response = await apiRequest({
          method: 'POST',
          path: '/api/party-match/party-matches',
          body: {
            dimensions,
            weights: activeWeights
          }
        });
        console.log("Party matches API response:", response);
        
        // Handle various possible response formats
        if (response && response.data) {
          // New API response format with top and bottom parties
          if (response.data.topParties && Array.isArray(response.data.topParties)) {
            console.log("Found top and bottom party matches:", response.data);
            return {
              topParties: response.data.topParties as PartyMatch[],
              bottomParties: (response.data.bottomParties as PartyMatch[]) || []
            };
          }
          
          // For backward compatibility with old API format
          if (response.data.parties && Array.isArray(response.data.parties)) {
            console.log("Found party matches in parties array (legacy format):", response.data.parties);
            return {
              topParties: response.data.parties as PartyMatch[],
              bottomParties: [] as PartyMatch[]
            };
          }
          
          // If data contains a result array (seen in other API responses)
          if (response.data.result && Array.isArray(response.data.result)) {
            console.log("Found party matches in result array:", response.data.result);
            return {
              topParties: response.data.result as PartyMatch[],
              bottomParties: [] as PartyMatch[]
            };
          }
          
          // If data is a single object that looks like a party match
          if (typeof response.data === 'object' && response.data.party && response.data.matchPercentage) {
            console.log("Found single party match, converting to array");
            return {
              topParties: [response.data as PartyMatch],
              bottomParties: [] as PartyMatch[]
            };
          }
          
          // If we can't identify a known format, log the structure for debugging
          console.log("Unknown data structure:", JSON.stringify(response.data));
          
          // Use fallback data based on dimensions for both top and bottom matches
          const topMatches = getFallbackMatches(dimensions);
          const bottomMatches = getFallbackLowMatches(dimensions);
          console.log("Using fallback matches:", { top: topMatches, bottom: bottomMatches });
          return {
            topParties: topMatches,
            bottomParties: bottomMatches
          };
        } else {
          throw new Error("Invalid API response format");
        }
      } catch (err) {
        console.error("Error fetching party matches:", err);
        throw err;
      }
    },
    enabled: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
  
  // Function to generate fallback matches based on dimensions
  const getFallbackMatches = (dims: IdeologicalDimensions): PartyMatch[] => {
    if (dims.economic < -3) {
      return [
        {
          party: "Sinn Féin",
          abbreviation: "SF",
          matchPercentage: 85,
          matchReason: "Strong alignment with your left-leaning economic views and progressive social values.",
          color: "#326760"
        },
        {
          party: "Social Democrats",
          abbreviation: "SD", 
          matchPercentage: 78,
          matchReason: "Matches your progressive social values and support for robust public services.",
          color: "#752F8B"
        },
        {
          party: "People Before Profit",
          abbreviation: "PBP",
          matchPercentage: 70,
          matchReason: "Aligns with your left-wing economic stance and progressive social outlook.",
          color: "#8B0000"
        }
      ];
    } else if (dims.economic > 3) {
      return [
        {
          party: "Fine Gael",
          abbreviation: "FG",
          matchPercentage: 82,
          matchReason: "Matches your market-oriented economic approach and center-right positioning.",
          color: "#0087DC"
        },
        {
          party: "Fianna Fáil",
          abbreviation: "FF",
          matchPercentage: 75,
          matchReason: "Aligns with your moderate center-right stance on economic and social issues.",
          color: "#01954B"
        },
        {
          party: "Irish Freedom Party",
          abbreviation: "IFP",
          matchPercentage: 67,
          matchReason: "Some alignment with your traditional social values and economic positions.",
          color: "#0066CC"
        }
      ];
    } else {
      return [
        {
          party: "Labour Party",
          abbreviation: "LP",
          matchPercentage: 75,
          matchReason: "Aligns with your balanced approach to economic and social issues.",
          color: "#E4003B"
        },
        {
          party: "Fianna Fáil",
          abbreviation: "FF",
          matchPercentage: 70,
          matchReason: "Matches your centrist, pragmatic approach to economic and social policies.",
          color: "#01954B"
        },
        {
          party: "Green Party",
          abbreviation: "GP",
          matchPercentage: 65,
          matchReason: "Aligns with your moderate environmental values and balanced social stance.",
          color: "#6AB023"
        }
      ];
    }
  };
  
  // Function to generate fallback low matches
  const getFallbackLowMatches = (dims: IdeologicalDimensions): PartyMatch[] => {
    if (dims.economic < -3) {
      return [
        {
          party: "Fine Gael",
          abbreviation: "FG",
          matchPercentage: 35,
          matchReason: "economic and social policies that focus on free market principles",
          color: "#0087DC"
        },
        {
          party: "Irish Freedom Party",
          abbreviation: "IFP",
          matchPercentage: 28,
          matchReason: "traditional social values and economic policies",
          color: "#0066CC"
        }
      ];
    } else if (dims.economic > 3) {
      return [
        {
          party: "People Before Profit",
          abbreviation: "PBP",
          matchPercentage: 32,
          matchReason: "left-wing economic policies and socialist principles",
          color: "#8B0000"
        },
        {
          party: "Sinn Féin",
          abbreviation: "SF",
          matchPercentage: 38,
          matchReason: "views on economic redistribution and social services",
          color: "#326760"
        }
      ];
    } else {
      return [
        {
          party: "Irish Freedom Party",
          abbreviation: "IFP",
          matchPercentage: 40,
          matchReason: "traditional social values and stance on globalism",
          color: "#0066CC"
        },
        {
          party: "People Before Profit",
          abbreviation: "PBP",
          matchPercentage: 42,
          matchReason: "radical economic policies and stance on authority",
          color: "#8B0000"
        }
      ];
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <Skeleton className="h-6 w-32" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
            <Skeleton className="mt-3 h-2.5 w-full rounded-full" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-1 h-4 w-[90%]" />
          </div>
        ))}
      </div>
    );
  }

  // Show error state
  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : "Failed to load party matches"}
        </p>
        <p className="mt-2 text-sm">Using pre-calculated matches instead</p>
        <div className="space-y-4 mt-4">
          {/* Fallback to simplified static matching based on dimensions */}
          {dimensions.economic < -3 ? (
            <>
              <PartyCard 
                name="Sinn Féin" 
                abbreviation="SF" 
                color="#326760" 
                matchPercentage={82} 
                reason="Aligns with your left-leaning economic views and progressive social policies"
              />
              <PartyCard 
                name="Social Democrats" 
                abbreviation="SD" 
                color="#752F8B" 
                matchPercentage={78} 
                reason="Matches your progressive social values and support for social welfare programs"
              />
            </>
          ) : dimensions.economic > 3 ? (
            <>
              <PartyCard 
                name="Fine Gael" 
                abbreviation="FG" 
                color="#0087DC" 
                matchPercentage={85} 
                reason="Aligns with your market-oriented economic views and conservative social values"
              />
              <PartyCard 
                name="Fianna Fáil" 
                abbreviation="FF" 
                color="#01954B" 
                matchPercentage={80} 
                reason="Matches your center-right economic stance and moderate nationalism"
              />
            </>
          ) : (
            <>
              <PartyCard 
                name="Labour Party" 
                abbreviation="LP" 
                color="#E4003B" 
                matchPercentage={75} 
                reason="Aligns with your balanced approach to economic and social issues"
              />
              <PartyCard 
                name="Green Party" 
                abbreviation="GP" 
                color="#6AB023" 
                matchPercentage={72} 
                reason="Matches your environmental concerns and moderate social values"
              />
            </>
          )}
        </div>
      </div>
    );
  }

  // If we have data, display the party matches
  if (data) {
    const { topParties, bottomParties } = data;
    
    return (
      <div className="space-y-8">
        {/* Top matches section */}
        <div>
          <h3 className="text-lg font-semibold mb-3 border-b pb-2">
            Closest Political Matches
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            For more accurate matches, adjust the dimension weightings in the 'Customize Weights' tab to prioritize issues that matter most to you.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-md mb-3 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Important note:</strong> These parties are the best match on paper based on ideological alignment. 
              Before making voting decisions, also consider each party's performance record and trustworthiness. 
              Check the <a href="/?tab=tds" className="underline hover:text-blue-600 dark:hover:text-blue-200">Rankings tab</a> to 
              view detailed performance metrics and party comparisons.
            </p>
          </div>
          <div className="space-y-4">
            {topParties && topParties.length > 0 ? (
              topParties.map((match, index) => (
                <PartyCard 
                  key={`top-${index}`}
                  name={match.party}
                  abbreviation={match.abbreviation}
                  color={match.color}
                  matchPercentage={match.matchPercentage}
                  reason={match.matchReason}
                />
              ))
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No top matches found.
              </p>
            )}
          </div>
        </div>
        
        {/* Bottom matches section - only show if there are any */}
        {bottomParties && bottomParties.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">
              Least Compatible Political Matches
            </h3>
            <div className="space-y-4">
              {bottomParties.map((match, index) => (
                <PartyCard 
                  key={`bottom-${index}`}
                  name={match.party}
                  abbreviation={match.abbreviation}
                  color={match.color}
                  matchPercentage={match.matchPercentage}
                  reason={match.matchReason}
                  isLowMatch={true}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // No data case
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        No party matches found. Please try again.
      </p>
    </div>
  );
};

// Helper component for displaying party cards
interface PartyCardProps {
  name: string;
  abbreviation: string;
  color: string;
  matchPercentage: number;
  reason: string;
  isLowMatch?: boolean;
}

const PartyCard: React.FC<PartyCardProps> = ({ 
  name, 
  abbreviation, 
  color, 
  matchPercentage, 
  reason,
  isLowMatch = false
}) => {
  return (
    <div className={`rounded-lg border p-4 ${isLowMatch ? 'border-gray-200 dark:border-gray-700' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: color || "#CCCCCC" }}
          >
            {abbreviation}
          </div>
          <h4 className="font-medium text-lg">{name}</h4>
        </div>
        <div className={`text-lg font-bold ${isLowMatch ? 'text-gray-500' : 'text-primary'}`}>
          {matchPercentage}%
        </div>
      </div>
      <div className="mt-3 w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
        <div 
          className={`h-2.5 rounded-full ${isLowMatch ? 'bg-gray-500' : 'bg-primary'}`}
          style={{ width: `${Math.max(20, matchPercentage)}%` }}
        ></div>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300 mt-3">
        {isLowMatch ? 
          `Your political views differ significantly from ${name}, particularly regarding ${reason.toLowerCase().includes('regarding') ? reason.split('regarding ')[1] : reason}` : 
          reason
        }
      </p>
      
      <div className="flex gap-2 mt-3">
        <a 
          href={`/education?party=${abbreviation}&tab=performance`} 
          className="inline-flex items-center justify-center px-3 py-1.5 text-xs rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 border border-blue-200 dark:border-blue-800"
        >
          View Performance
        </a>
        <a 
          href={`/education?party=${abbreviation}&tab=trustworthiness`} 
          className="inline-flex items-center justify-center px-3 py-1.5 text-xs rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-300 dark:hover:bg-amber-800 border border-amber-200 dark:border-amber-800"
        >
          Check Trustworthiness
        </a>
      </div>
    </div>
  );
};

export default PartyMatchResults;