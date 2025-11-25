import React, { useState, useEffect } from "react";
import { IdeologicalDimensions } from "@shared/quizTypes";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface PartyMatch {
  party: string;
  abbreviation: string;
  matchPercentage: number;
  matchReason: string;
  color: string;
}

interface PartyMatchesResponse {
  topParties: PartyMatch[];
  bottomParties: PartyMatch[];
}

interface PartyMatchResultsProps {
  dimensions: IdeologicalDimensions;
  weights?: Record<string, number>;
}

// Create a unique key for this component instance to identify it for event listening
const instanceId = Date.now().toString();

const PartyMatchResultsNew: React.FC<PartyMatchResultsProps> = ({ dimensions, weights }) => {
  // State for managing data
  const [matchesData, setMatchesData] = useState<PartyMatchesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Function to fetch party match data directly
  const fetchPartyMatches = async (dims: IdeologicalDimensions, wts: Record<string, number> = {}) => {
    setIsLoading(true);
    setIsError(false);
    
    console.log("DIRECT FETCH - Party matches with dimensions:", dims);
    console.log("DIRECT FETCH - Using weights:", wts);
    
    try {
      const response = await fetch('/api/party-match/party-matches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dimensions: dims,
          weights: wts
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Party matches API response:", data);
      
      if (data.success && data.data) {
        // Handle various possible response formats
        let processedData: PartyMatchesResponse = {
          topParties: [],
          bottomParties: []
        };
        
        // New API response format with top and bottom parties
        if (data.data.topParties && Array.isArray(data.data.topParties)) {
          console.log("Found top and bottom party matches:", data.data);
          processedData = {
            topParties: data.data.topParties,
            bottomParties: data.data.bottomParties || []
          };
        }
        // For backward compatibility with old API format
        else if (data.data.parties && Array.isArray(data.data.parties)) {
          processedData = {
            topParties: data.data.parties,
            bottomParties: []
          };
        }
        // If data contains a result array
        else if (data.data.result && Array.isArray(data.data.result)) {
          processedData = {
            topParties: data.data.result,
            bottomParties: []
          };
        }
        
        setMatchesData(processedData);
      } else {
        throw new Error("Invalid API response format");
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error("Error loading party matches:", err);
      setIsError(true);
      setErrorMessage(err instanceof Error ? err.message : "Unknown error occurred");
      setIsLoading(false);
    }
  };
  
  // Initial data load
  useEffect(() => {
    console.log("Initial load - fetching party matches");
    fetchPartyMatches(dimensions, weights || {});
  }, []);
  
  // REMOVED: Automatic updates when weights change through props
  // We now only update when explicitly told to via the regenerate event
  
  // Listen for regenerate events from parent components
  useEffect(() => {
    const handleRegenerate = (event: any) => {
      console.log("PartyMatchResultsNew: Received regenerate event", event.detail);
      
      // IMPORTANT: Always fully refresh on regenerate events, even if details are missing
      // Force a refresh by temporarily resetting state
      setIsLoading(true);
      setMatchesData(null);
      
      // Use provided weights if available, otherwise use current weights prop
      const weightsToUse = event.detail?.weights || weights || {};
      console.log("Regenerating party matches with weights:", weightsToUse);
      
      // Slight delay to ensure clean state refresh and visual feedback
      setTimeout(() => {
        fetchPartyMatches(dimensions, weightsToUse);
      }, 100);
    };
    
    window.addEventListener('regenerate-analysis', handleRegenerate);
    
    // Also listen for specific party match refresh events
    window.addEventListener('refresh-party-matches', (event: any) => {
      console.log("Received explicit refresh-party-matches event");
      setIsLoading(true);
      setMatchesData(null);
      
      setTimeout(() => {
        fetchPartyMatches(dimensions, weights || {});
      }, 100);
    });
    
    return () => {
      window.removeEventListener('regenerate-analysis', handleRegenerate);
      window.removeEventListener('refresh-party-matches', (e) => handleRegenerate(e));
    };
  }, [dimensions, weights]);
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6" data-party-match-container="true">
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/3 mb-2" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    );
  }
  
  // Show error state
  if (isError) {
    return (
      <div className="space-y-3 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg" data-party-match-container="true">
        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">Error Loading Party Matches</h3>
        <p className="text-red-500 dark:text-red-400 text-sm">
          {errorMessage || "Could not load party matches. Please try again."}
        </p>
        <button 
          className="px-3 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 rounded text-red-600 dark:text-red-300 text-sm"
          onClick={() => fetchPartyMatches(dimensions, weights || {})}
        >
          Try Again
        </button>
      </div>
    );
  }
  
  // Render party matches if we have data
  if (matchesData) {
    const { topParties = [], bottomParties = [] } = matchesData;
    
    // Apply a contrast boost to the percentages to make differences more visible
    const boostContrast = (percentage: number): number => {
      // Apply math.pow to create a non-linear curve that exaggerates small differences
      // Higher power (2+) = greater contrast boost
      const contrastPower = 1.8; 
      
      // Normalize percentage to 0-1 range
      const normalizedValue = percentage / 100;
      
      // Apply power function for contrast boosting
      return Math.pow(normalizedValue, contrastPower) * 100;
    };
    
    // Get the highest match percentage for scaling
    const highestMatch = Math.max(
      ...topParties.map(party => party.matchPercentage || 0), 
      1
    );
    
    // Function to calculate visual width based on boosted contrast
    const getBarWidth = (percentage: number) => {
      // Normalize relative to highest match, then boost contrast
      const normalizedPercentage = (percentage / highestMatch) * 100;
      return boostContrast(normalizedPercentage);
    };
    
    return (
      <div className="space-y-6" data-party-match-container="true">
        {/* Top Matches */}
        <div className="space-y-4">
          <h3 className="text-md font-semibold flex items-center gap-2">
            <span className="text-green-600 dark:text-green-500">▲</span> Top Party Matches
          </h3>
          
          {topParties.length > 0 ? (
            <div className="space-y-4">
              {topParties.slice(0, 3).map((party, index) => (
                <div key={party.party + index} className="relative">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: party.color || '#888' }}
                      />
                      <span className="font-medium">
                        {party.party}
                        <span className="text-gray-500 dark:text-gray-400 ml-1">
                          ({party.abbreviation})
                        </span>
                      </span>
                    </div>
                    <Badge 
                      variant={index === 0 ? "default" : "outline"}
                      className={index === 0 ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      {party.matchPercentage.toFixed(1)}%
                    </Badge>
                  </div>
                  
                  <Progress 
                    value={getBarWidth(party.matchPercentage)} 
                    className="h-2 bg-gray-100 dark:bg-gray-800"
                    // Custom color based on the party's color
                    style={{
                      '--progress-background': party.color || '#888',
                    } as React.CSSProperties}
                  />
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5">
                    {party.matchReason}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm italic">
              No party matches found.
            </p>
          )}
        </div>
        
        {/* Bottom Matches */}
        {bottomParties.length > 0 && (
          <div className="space-y-4 pt-2 border-t dark:border-gray-800">
            <h3 className="text-md font-semibold flex items-center gap-2 pt-2">
              <span className="text-red-600 dark:text-red-500">▼</span> Least Aligned
            </h3>
            
            <div className="space-y-4">
              {bottomParties.slice(0, 3).map((party, index) => (
                <div key={party.party + index} className="relative">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: party.color || '#888' }}
                      />
                      <span className="font-medium">
                        {party.party}
                        <span className="text-gray-500 dark:text-gray-400 ml-1">
                          ({party.abbreviation})
                        </span>
                      </span>
                    </div>
                    <Badge variant="outline">
                      {party.matchPercentage.toFixed(1)}%
                    </Badge>
                  </div>
                  
                  <Progress 
                    value={getBarWidth(party.matchPercentage)} 
                    className="h-2 bg-gray-100 dark:bg-gray-800"
                    // Custom color based on the party's color with lower opacity
                    style={{
                      '--progress-background': party.color || '#888',
                      opacity: 0.6
                    } as React.CSSProperties}
                  />
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5">
                    {party.matchReason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Fallback (should not happen with the states above)
  return null;
};

export default PartyMatchResultsNew;