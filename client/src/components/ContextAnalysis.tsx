import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { IdeologicalDimensions } from "@shared/quizTypes";

interface ContextAnalysisProps {
  dimensions: IdeologicalDimensions;
  userLocation?: string;
}

// Response type for the context analysis API
interface ContextAnalysisResponse {
  historical_alignments?: Array<{
    era?: string;
    movement?: string;
    period: string;
    alignment?: string;
    alignment_score?: number;
    description: string;
    key_similarities?: string[];
    key_differences?: string[];
  }>;
  regional_analysis?: Array<{
    region: string;
    alignment: string;
    description: string;
  }>;
  issue_analysis?: Array<{
    issue: string;
    stance: string;
    percentile?: number;
    description: string;
  }>;
  trending_issues?: Array<string | {
    issue: string;
    likely_stance?: string;
    mainstream_stance?: string;
    [key: string]: any;
  }>;
}

const ContextAnalysis: React.FC<ContextAnalysisProps> = ({ dimensions, userLocation }) => {
  // State for managing data
  const [analysisData, setAnalysisData] = useState<ContextAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Function to fetch data directly
  const fetchContextAnalysis = async (dims: IdeologicalDimensions) => {
    setIsLoading(true);
    setIsError(false);
    
    console.log("Context Analysis - Direct fetch with dimensions:", dims);
    
    try {
      const response = await fetch('/api/enhanced-profile/context-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dimensions: dims,
          userLocation
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Context analysis data received:", data);
      
      if (data.success && data.data) {
        setAnalysisData(data.data);
      } else {
        throw new Error("Invalid API response format");
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error("Error loading context analysis:", err);
      setIsError(true);
      setErrorMessage(err instanceof Error ? err.message : "Unknown error occurred");
      setIsLoading(false);
    }
  };
  
  // Initial data load and update when dimensions change
  useEffect(() => {
    console.log("Initial load - fetching context analysis data", dimensions);
    fetchContextAnalysis(dimensions);
  }, [dimensions]);
  
  // Listen for regenerate events
  useEffect(() => {
    const handleRegenerate = (event: any) => {
      console.log("Context Analysis: Received regenerate event", event.detail);
      console.log("EVENT DETAIL for context analysis:", JSON.stringify(event.detail));
      
      // Force immediate refresh on regenerate event
      setIsLoading(true);
      console.log("FORCE REGENERATING context analysis with current dimensions");
      
      // Small timeout to ensure loading state is shown
      setTimeout(() => {
        // Always regenerate with the current dimensions when weights change
        fetchContextAnalysis(dimensions);
      }, 100);
    };
    
    window.addEventListener('regenerate-analysis', handleRegenerate);
    
    return () => {
      window.removeEventListener('regenerate-analysis', handleRegenerate);
    };
  }, [dimensions]);
  
  // Show loading state
  if (isLoading) {
    return (
      <Card className="w-full" data-context-analysis-container="true">
        <CardHeader>
          <CardTitle>Context-Aware Analysis</CardTitle>
          <CardDescription>
            Your political profile in historical, regional, and issue-based contexts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-4 w-[85%]" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  // Show error state
  if (isError) {
    return (
      <Card className="w-full" data-context-analysis-container="true">
        <CardHeader>
          <CardTitle>Context-Aware Analysis</CardTitle>
          <CardDescription>
            There was an error generating your context-aware analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-red-500 mb-4">
            {errorMessage || "Something went wrong. Please try again."}
          </p>
          <Button onClick={() => fetchContextAnalysis(dimensions)}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  // Proceed with rendering results if we have data
  if (analysisData) {
    console.log("Context analysis data:", analysisData);
    
    const { historical_alignments = [], regional_analysis = [], issue_analysis = [], trending_issues = [] } = analysisData;
    
    // Sort issues by extremity (highest percentile deviation from 50)
    const sortedIssues = Array.isArray(issue_analysis)
      ? [...issue_analysis]
          .map((issue) => (typeof issue === "string" ? { description: issue } : { ...issue }))
          .sort((a, b) => {
            const aPercentile = ('percentile' in a && typeof a.percentile === 'number') ? a.percentile : 50;
            const bPercentile = ('percentile' in b && typeof b.percentile === 'number') ? b.percentile : 50;
            return Math.abs(aPercentile - 50) > Math.abs(bPercentile - 50) ? -1 : 1;
          })
          .map((issue, index) => {
            // Ensure each issue has a name - use dimensions if no issue name is provided
            if (!issue.issue) {
              const dimensionMap: Record<number, string> = {
                0: "Economic Policy",
                1: "Social Issues",
                2: "Cultural Identity",
                3: "International Relations",
                4: "Environmental Policy",
                5: "Government Authority",
                6: "Welfare Systems",
                7: "Political Decision-Making"
              };
              issue.issue = dimensionMap[index % 8] || `Political Issue ${index + 1}`;
            }
            return issue;
          })
      : [];
    
    return (
      <Card className="w-full max-w-full" data-context-analysis-container="true">
        <CardHeader>
          <CardTitle className="text-base">Context-Aware Analysis</CardTitle>
          <CardDescription className="text-xs">
            Your political profile in historical, regional, and issue-based contexts
          </CardDescription>
        </CardHeader>
        <CardContent className="w-full max-w-full">
          <Tabs defaultValue="historical" className="w-full max-w-full">
            <TabsList className="grid w-full grid-cols-3 mt-2 mb-4 text-xs">
              <TabsTrigger value="historical" className="text-xs">Historical</TabsTrigger>
              <TabsTrigger value="regional" className="text-xs">Regional</TabsTrigger>
              <TabsTrigger value="issues" className="text-xs">Issues</TabsTrigger>
            </TabsList>
            
            {/* Historical Context Tab */}
            <TabsContent value="historical" className="space-y-4 w-full">
              <div>
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <span className="text-lg">📚</span> Historical Alignments
                </h3>
                {historical_alignments.length > 0 ? (
                  <div className="space-y-4">
                    {historical_alignments.map((alignment, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 border-amber-200 dark:border-amber-800 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start">
                          <h4 className="text-sm font-medium">
                            {alignment.era || alignment.movement}
                          </h4>
                          <span className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded shadow-sm">
                            {alignment.period}
                          </span>
                        </div>
                        
                        {/* Alignment Score */}
                        {alignment.alignment_score !== undefined && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">Alignment:</span>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                <div 
                                  className="bg-gradient-to-r from-yellow-500 to-amber-500 h-2.5 rounded-full" 
                                  style={{ width: `${alignment.alignment_score}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-medium">{alignment.alignment_score}%</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Traditional Alignment Badge if exists */}
                        {alignment.alignment && (
                          <div className="mt-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium 
                              ${alignment.alignment === 'Strong' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                                alignment.alignment === 'Moderate' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 
                                  alignment.alignment === 'Weak' ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' : 
                                    'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'}`
                            }>
                              {alignment.alignment} alignment
                            </span>
                          </div>
                        )}
                        
                        <p className="mt-3 text-xs text-gray-700 dark:text-gray-300">
                          {alignment.description}
                        </p>
                        
                        {/* Key similarities and differences */}
                        {alignment.key_similarities && alignment.key_similarities.length > 0 && (
                          <div className="mt-3">
                            <h5 className="text-xs font-medium flex items-center gap-1">
                              <span className="text-green-600 dark:text-green-400">✓</span> Key Similarities
                            </h5>
                            <ul className="mt-1 space-y-1">
                              {alignment.key_similarities.map((item, idx) => (
                                <li key={idx} className="text-xs text-gray-700 dark:text-gray-300 pl-4 relative">
                                  <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {alignment.key_differences && alignment.key_differences.length > 0 && (
                          <div className="mt-2">
                            <h5 className="text-xs font-medium flex items-center gap-1">
                              <span className="text-orange-600 dark:text-orange-400">≠</span> Key Differences
                            </h5>
                            <ul className="mt-1 space-y-1">
                              {alignment.key_differences.map((item, idx) => (
                                <li key={idx} className="text-xs text-gray-700 dark:text-gray-300 pl-4 relative">
                                  <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">
                    Historical alignment data not available
                  </p>
                )}
              </div>
            </TabsContent>
            
            {/* Regional Context Tab */}
            <TabsContent value="regional" className="space-y-4">
              <div>
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <span className="text-lg text-blue-600 dark:text-blue-400">🗺️</span> Regional Analysis
                </h3>
                
                {regional_analysis.length > 0 ? (
                  <div className="space-y-4">
                    {regional_analysis.map((region, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-teal-50 dark:from-blue-950 dark:to-teal-950 border-blue-200 dark:border-blue-800 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start">
                          <h4 className="text-sm font-medium">{region.region}</h4>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium shadow-sm
                            ${region.alignment === 'Strong' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                              region.alignment === 'Moderate' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 
                                'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}`
                          }>
                            {region.alignment} alignment
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-700 dark:text-gray-300">
                          {region.description}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-6 text-center border border-blue-200 dark:border-blue-900">
                    <span className="text-4xl block mb-3">🌍</span>
                    <h4 className="text-base font-medium text-blue-700 dark:text-blue-300 mb-2">Regional Context</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                      Your profile suggests these regional alignments:
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="border border-blue-200 dark:border-blue-800 rounded-md p-3 bg-white dark:bg-gray-800">
                        <h5 className="font-medium text-xs mb-1">Ireland</h5>
                        <p className="text-xs">{dimensions.economic > 0 ? 
                          "Your views align with center-right voters in Dublin suburbs and rural towns" : 
                          "Your views align with urban center-left voters in major cities"}
                        </p>
                      </div>
                      <div className="border border-blue-200 dark:border-blue-800 rounded-md p-3 bg-white dark:bg-gray-800">
                        <h5 className="font-medium text-xs mb-1">Europe</h5>
                        <p className="text-xs">{dimensions.cultural > 0 ? 
                          "Your values match conservative and moderate voters in Central Europe" : 
                          "Your values align with progressives in Northern European countries"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {userLocation && (
                  <div className="mt-4 bg-blue-50 dark:bg-blue-900 p-3 rounded-lg">
                    <h4 className="font-medium text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
                      <span>📍</span> Your Location Context
                    </h4>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                      {`Based on your location (${userLocation}), your political profile would likely align with local ${
                        dimensions.economic < -2 ? "left-leaning" : 
                        dimensions.economic > 2 ? "right-leaning" : 
                        "centrist"
                      } political groups.`}
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
            
            {/* Issues Tab */}
            <TabsContent value="issues" className="space-y-4">
              <div>
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <span className="text-lg text-purple-600 dark:text-purple-400">📊</span> Issue Analysis
                </h3>
                
                {sortedIssues.length > 0 ? (
                  <div className="space-y-4">
                    {sortedIssues.map((issue, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 border-purple-200 dark:border-purple-800 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start">
                          <h4 className="text-sm font-medium">{issue.issue || `Issue ${index + 1}`}</h4>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium shadow-sm
                            ${issue.stance === 'Progressive' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 
                              issue.stance === 'Conservative' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
                                issue.stance === 'Centrist' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 
                                  'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}`
                          }>
                            {issue.stance || 'Moderate'}
                          </span>
                        </div>
                        
                        <div className="mt-2 text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm inline-block">
                          {'percentile' in issue && typeof issue.percentile === 'number'
                            ? `You hold stronger views on this issue than ~${issue.percentile}% of people`
                            : `Your stance on this issue is ${'stance' in issue ? issue.stance : 'moderate'}`}
                        </div>
                        
                        <p className="mt-3 text-xs text-gray-700 dark:text-gray-300">
                          {issue.description}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-6 text-center border border-purple-200 dark:border-purple-900">
                    <span className="text-4xl block mb-3">📋</span>
                    <h4 className="text-base font-medium text-purple-700 dark:text-purple-300 mb-2">Issue Positions</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                      Based on your profile, we can predict your stance on these key issues:
                    </p>
                    <div className="space-y-3">
                      <div className="border border-purple-200 dark:border-purple-800 rounded-md p-3 bg-white dark:bg-gray-800">
                        <h5 className="font-medium text-xs mb-1 flex items-center gap-1">
                          <span className="text-purple-500">•</span> Climate Change
                        </h5>
                        <p className="text-xs">{dimensions.environmental > 0 ? 
                          "Supportive of balanced approaches that protect business interests while addressing environmental concerns" : 
                          "Strongly favor aggressive climate action and strict environmental regulations"}
                        </p>
                      </div>
                      <div className="border border-purple-200 dark:border-purple-800 rounded-md p-3 bg-white dark:bg-gray-800">
                        <h5 className="font-medium text-xs mb-1 flex items-center gap-1">
                          <span className="text-purple-500">•</span> Immigration
                        </h5>
                        <p className="text-xs">{dimensions.globalism > 0 ? 
                          "Prefer controlled immigration with emphasis on national interests and integration" : 
                          "Support more open immigration policies with humanitarian considerations"}
                        </p>
                      </div>
                      <div className="border border-purple-200 dark:border-purple-800 rounded-md p-3 bg-white dark:bg-gray-800">
                        <h5 className="font-medium text-xs mb-1 flex items-center gap-1">
                          <span className="text-purple-500">•</span> Economic Policy
                        </h5>
                        <p className="text-xs">{dimensions.economic > 0 ? 
                          "Favor lower taxes and reduced business regulations to stimulate growth" : 
                          "Support progressive taxation and stronger oversight of markets"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {trending_issues.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium mb-2">Trending Issues You Should Follow</h4>
                    <div className="flex flex-wrap gap-2">
                      {trending_issues.map((issue, index) => (
                        <span key={index} className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">
                          {typeof issue === 'string' ? issue : 
                           (issue && typeof issue === 'object' && issue !== null && 'issue' in issue) ? 
                             String(issue.issue) : 
                             'Issue #' + (index + 1)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  }
  
  // Fallback (should not happen with the states above)
  return null;
};

export default ContextAnalysis;