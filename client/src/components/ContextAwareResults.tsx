import React, { useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { IdeologicalDimensions } from "@shared/quizTypes";

interface ContextAwareResultsProps {
  dimensions: IdeologicalDimensions;
  userLocation?: {
    constituency: string;
    county: string;
  };
}

// Types for the historical context with safer property typing
interface HistoricalAlignment {
  era?: string;
  period?: string;
  description?: string;
  alignment_score?: number; // 0-100
  key_similarities?: string[] | Record<string, any>; // Allow for both array and object
  key_differences?: string[] | Record<string, any>; // Allow for both array and object
}

// Types for regional analysis with safer property typing
interface RegionalAlignment {
  region?: string;
  alignment_score?: number; // 0-100
  description?: string;
  demographic_note?: string;
  voting_patterns?: string[] | Record<string, any>; // Allow for both array and object
}

// Types for issue-based analysis with safer property typing
interface IssueAnalysis {
  dimension?: keyof IdeologicalDimensions;
  score?: number;
  percentile?: number; // 0-100
  status?: "extreme" | "moderate" | "typical";
  description?: string;
  comparison?: string;
}

interface ContextAnalysisResponse {
  historical_alignments?: HistoricalAlignment[];
  regional_analysis?: RegionalAlignment[];
  issue_analysis?: IssueAnalysis[];
  trending_issues?: {
    issue?: string;
    likely_stance?: string;
    mainstream_stance?: string;
  }[];
}

const ContextAwareResults: React.FC<ContextAwareResultsProps> = ({ dimensions, userLocation }) => {
  // Store dimensions for initial load and manual regeneration
  const [storedDimensions, setStoredDimensions] = useState(dimensions);
  const [shouldFetch, setShouldFetch] = useState(true);
  
  // Only set dimensions on initial load
  useEffect(() => {
    if (!storedDimensions) {
      setStoredDimensions(dimensions);
    }
  }, []);
  
  // Only fetch context analysis when explicitly requested through regenerate button
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['/api/enhanced-profile/context-analysis'],
    queryFn: async () => {
      // Always use the most current dimension values from props, not stale state
      const currentDims = dimensions;
      
      // Log the exact parameters being sent to the API
      console.log('EXPLICIT REGENERATION - Context analysis with current dimensions:', currentDims);
      
      try {
        // Make the API request with the most up-to-date values
        const response = await apiRequest({
          method: 'POST',
          path: '/api/enhanced-profile/context-analysis',
          body: {
            dimensions: currentDims,
            userLocation
          }
        });
        
        if (!response || !response.data) {
          throw new Error("Invalid API response structure from context analysis");
        }
        
        console.log("Context analysis API response received successfully");
        return response.data as ContextAnalysisResponse;
      } catch (err) {
        console.error("Error fetching context analysis:", err);
        throw err;
      }
    },
    // Never auto-run this query - only manually triggered by regenerateAnalysis
    enabled: false,
    // Don't refetch automatically under any circumstances
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  
  // Function to regenerate analysis with current dimensions
  const regenerateAnalysis = () => {
    // First update the state with fresh values
    setStoredDimensions({...dimensions});
    
    // Don't wait for state updates to finish, use current values directly
    refetch().catch(err => {
      console.error("Failed to refetch context analysis:", err);
    });
  };
  
  // Add event listener for regenerate-analysis event to allow parent components
  // to trigger regeneration only when explicitly requested
  useEffect(() => {
    const handleRegenerate = (event: any) => {
      console.log("ContextAwareResults: Received regenerate event", event.detail);
      regenerateAnalysis();
    };
    
    // Add the event listener
    window.addEventListener('regenerate-analysis', handleRegenerate);
    
    // Cleanup when component unmounts
    return () => {
      window.removeEventListener('regenerate-analysis', handleRegenerate);
    };
  }, [dimensions]);

  // Show loading state
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Context-Aware Analysis</CardTitle>
          <CardDescription>
            Analyzing how your political profile compares across time, regions, and issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-4 w-[85%]" />
          <div className="space-y-2 mt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (isError) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Context-Aware Analysis</CardTitle>
          <CardDescription>
            There was an error generating your contextual analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">
            {error instanceof Error ? error.message : "An unknown error occurred"}
          </p>
          <Button 
            onClick={() => {
              // Force a refetch
              window.location.reload();
            }} 
            className="mt-4"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // If no data yet and not loading, still show a minimal loading indicator
  if (!data && !isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Context-Aware Analysis</CardTitle>
          <CardDescription>
            Generating your political profile analysis...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[90%]" />
          <div className="space-y-2 mt-4">
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Proceed with rendering results if we have data
  if (data) {
    console.log("Context analysis data:", data);
    
    const { historical_alignments = [], regional_analysis = [], issue_analysis = [], trending_issues = [] } = data;
    
    // Sort issues by extremity (highest percentile deviation from 50)
    const sortedIssues = Array.isArray(issue_analysis) ? 
      [...issue_analysis].sort((a, b) => 
        Math.abs((a.percentile ?? 50) - 50) > Math.abs((b.percentile ?? 50) - 50) ? -1 : 1
      ) : [];
    
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Context-Aware Analysis</CardTitle>
          <CardDescription>
            Your political profile in historical, regional, and issue-based contexts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="historical" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
              <TabsTrigger value="historical">Historical</TabsTrigger>
              <TabsTrigger value="regional">Regional</TabsTrigger>
              <TabsTrigger value="issues">Issues</TabsTrigger>
              <TabsTrigger value="trending">Trending</TabsTrigger>
            </TabsList>
            
            {/* Historical Context Tab */}
            <TabsContent value="historical" className="space-y-4 pt-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                See how your political orientation aligns with different historical eras around the world:
              </p>
              
              {Array.isArray(historical_alignments) && historical_alignments.map((alignment, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{alignment.era || 'Historical Era'}: {alignment.period || 'Time Period'}</h3>
                    <Badge variant={(alignment.alignment_score || 0) > 70 ? "default" : 
                                   (alignment.alignment_score || 0) > 50 ? "outline" : "secondary"}>
                      {(alignment.alignment_score || 0) > 70 ? "Strong" : 
                       (alignment.alignment_score || 0) > 50 ? "Moderate" : "Weak"} Alignment
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    {typeof alignment.description === 'string' ? alignment.description : JSON.stringify(alignment.description)}
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <h4 className="text-sm font-medium mb-1">Key Similarities</h4>
                      <ul className="list-disc pl-5 text-xs space-y-1">
                        {Array.isArray(alignment.key_similarities) ? 
                          alignment.key_similarities.map((similarity, i) => (
                            <li key={i}>{similarity}</li>
                          )) : 
                          typeof alignment.key_similarities === 'string' ?
                          <li>{alignment.key_similarities}</li> :
                          <li>Information not available</li>
                        }
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium mb-1">Key Differences</h4>
                      <ul className="list-disc pl-5 text-xs space-y-1">
                        {Array.isArray(alignment.key_differences) ? 
                          alignment.key_differences.map((difference, i) => (
                            <li key={i}>{difference}</li>
                          )) : 
                          typeof alignment.key_differences === 'string' ?
                          <li>{alignment.key_differences}</li> :
                          <li>Information not available</li>
                        }
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>
            
            {/* Regional Analysis Tab */}
            <TabsContent value="regional" className="space-y-4 pt-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                See which regions around the world have voters with political orientations closest to yours:
              </p>
              
              {Array.isArray(regional_analysis) && regional_analysis.map((region, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{region.region || 'Region'}</h3>
                    <Badge variant={(region.alignment_score || 0) > 70 ? "default" : 
                                    (region.alignment_score || 0) > 50 ? "outline" : "secondary"}>
                      {region.alignment_score || 0}% Alignment
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    {typeof region.description === 'string' ? region.description : JSON.stringify(region.description)}
                  </p>
                  
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                    <h4 className="text-sm font-medium mb-1">Demographics</h4>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">
                      {typeof region.demographic_note === 'string' ? region.demographic_note : JSON.stringify(region.demographic_note)}
                    </p>
                    
                    <h4 className="text-sm font-medium mb-1">Voting Patterns</h4>
                    <ul className="list-disc pl-5 text-xs space-y-1">
                      {Array.isArray(region.voting_patterns) ? 
                        region.voting_patterns.map((pattern, i) => (
                          <li key={i}>{typeof pattern === 'string' ? pattern : JSON.stringify(pattern)}</li>
                        )) :
                        typeof region.voting_patterns === 'string' ?
                        <li>{region.voting_patterns}</li> :
                        <li>Voting pattern information not available</li>
                      }
                    </ul>
                  </div>
                </div>
              ))}
              
              {userLocation && (
                <div className="mt-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">Your location:</span> {userLocation.constituency}, {userLocation.county}
                  </p>
                </div>
              )}
            </TabsContent>
            
            {/* Issue Analysis Tab */}
            <TabsContent value="issues" className="space-y-4 pt-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                See where your political positions are notably moderate or extreme compared to the average Irish voter:
              </p>
              
              {sortedIssues.map((issue, index) => {
                const isExtreme = issue.status === "extreme";
                const isModerate = issue.status === "moderate";
                const dimensionName = issue.dimension ? 
                  issue.dimension.charAt(0).toUpperCase() + issue.dimension.slice(1) : 
                  `Dimension ${index+1}`;
                
                return (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{dimensionName}</h3>
                      <Badge variant={isExtreme ? "destructive" : isModerate ? "outline" : "secondary"}>
                        {isExtreme ? "Notably Extreme" : isModerate ? "Notably Moderate" : "Typical"}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Your Score: {issue.score || 'N/A'}</span>
                      <span className="text-sm">Percentile: {issue.percentile ?? 'N/A'}%</span>
                    </div>
                    
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      {typeof issue.description === 'string' ? issue.description : JSON.stringify(issue.description)}
                    </p>
                    
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                      <p className="text-xs">
                        <span className="font-medium">Compared to average:</span> {typeof issue.comparison === 'string' ? issue.comparison : JSON.stringify(issue.comparison)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </TabsContent>
            
            {/* Trending Issues Tab */}
            <TabsContent value="trending" className="space-y-4 pt-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Based on your political profile, here's how you might approach current trending issues in Ireland:
              </p>
              
              {Array.isArray(trending_issues) && trending_issues.map((issue, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">{issue.issue || 'Current Issue'}</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium mb-1">Your Likely Stance</h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {typeof issue.likely_stance === 'string' ? issue.likely_stance : JSON.stringify(issue.likely_stance)}
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium mb-1">Mainstream Position</h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {typeof issue.mainstream_stance === 'string' ? issue.mainstream_stance : JSON.stringify(issue.mainstream_stance)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  }

  // Fallback UI (should never happen given the conditions above)
  return null;
};

export default ContextAwareResults;