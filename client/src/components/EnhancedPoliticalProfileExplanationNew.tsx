import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { IdeologicalDimensions } from "@shared/quizTypes";
import PartyMatchResults from "./PartyMatchResults";

interface EnhancedPoliticalProfileExplanationProps {
  dimensions: IdeologicalDimensions;
  weights?: Record<string, number>;
}

// Type for API response
interface CompleteAnalysis {
  profile_analysis?: string;
  ideology?: string;
  description?: string;
  beliefs?: string[] | Record<string, any>;
  tensions?: string[];
  irish_parties?: Array<{
    party: string;
    alignment: string;
  }>;
  international_matches?: Array<{
    name: string;
    country: string;
    alignment: string;
  }>;
  issue_positions?: {
    housing?: string;
    healthcare?: string;
    environment?: string;
    [key: string]: string | undefined;
  };
}

const EnhancedPoliticalProfileExplanationNew: React.FC<EnhancedPoliticalProfileExplanationProps> = ({ 
  dimensions, 
  weights 
}) => {
  // Simple state for managing loading and data
  const [analysisData, setAnalysisData] = useState<CompleteAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<string>("all");
  
  // Function to fetch data
  const fetchAnalysisData = (dims: IdeologicalDimensions, wts: Record<string, number> = {}) => {
    setIsLoading(true);
    
    console.log("Fetching analysis with dimensions:", dims);
    console.log("Fetching analysis with weights:", wts);
    
    apiRequest({
      method: 'POST',
      path: '/api/enhanced-profile/complete-analysis',
      body: {
        dimensions: dims,
        weights: wts
      }
    })
    .then(response => {
      console.log("Analysis data received:", response.data);
      setAnalysisData(response.data);
      setIsLoading(false);
      setIsError(false);
    })
    .catch(err => {
      console.error("Error loading analysis:", err);
      setIsError(true);
      setErrorMessage(err.message || "Failed to load analysis");
      setIsLoading(false);
    });
  };
  
  // Initial data load
  useEffect(() => {
    fetchAnalysisData(dimensions, weights || {});
  }, []);
  
  // Listen for regenerate events
  useEffect(() => {
    const handleRegenerate = (event: CustomEvent) => {
      console.log("Enhanced Profile: Received regenerate event with weights:", event.detail?.weights);
      
      if (event.detail?.weights) {
        fetchAnalysisData(dimensions, event.detail.weights);
      }
    };
    
    window.addEventListener('regenerate-analysis', handleRegenerate as EventListener);
    
    return () => {
      window.removeEventListener('regenerate-analysis', handleRegenerate as EventListener);
    };
  }, [dimensions]);
  
  // Show loading state
  if (isLoading) {
    return (
      <Card className="w-full" data-enhanced-profile-container="true">
        <CardHeader>
          <CardTitle>Enhanced Political Analysis</CardTitle>
          <CardDescription>
            Generating your AI-powered political profile analysis...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-4 w-[85%]" />
          <Skeleton className="h-4 w-[80%]" />
        </CardContent>
      </Card>
    );
  }
  
  // Show error state
  if (isError) {
    return (
      <Card className="w-full" data-enhanced-profile-container="true">
        <CardHeader>
          <CardTitle>Enhanced Political Analysis</CardTitle>
          <CardDescription>
            There was an error generating your political profile analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-red-500 mb-4">
            {errorMessage || "Something went wrong. Please try again."}
          </p>
          <Button onClick={() => fetchAnalysisData(dimensions, weights || {})}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  // Show results if we have data
  if (analysisData) {
    // Extract the data fields we need, handling different possible data formats
    const ideology = analysisData.ideology || 
      (typeof analysisData.description === 'string' ? analysisData.description?.split('.')[0] : "Progressive Left");
    
    const profileAnalysis = analysisData.profile_analysis || 
      (typeof analysisData.description === 'string' ? analysisData.description : 
      "Your political orientation leans towards progressive values with an emphasis on social equality.");
    
    // Handle different formats for beliefs data
    let beliefs: string[] = [];
    if (Array.isArray(analysisData.beliefs)) {
      beliefs = analysisData.beliefs;
    } else if (analysisData.beliefs && typeof analysisData.beliefs === 'object') {
      beliefs = Object.values(analysisData.beliefs).map(v => typeof v === 'string' ? v : JSON.stringify(v));
    } else if (typeof analysisData.description === 'string') {
      // Extract key points from description if no beliefs provided
      const sentences = analysisData.description.split('.');
      beliefs = sentences.slice(1, 4).map(s => s.trim()).filter(s => s.length > 20);
    }
    
    const tensions = Array.isArray(analysisData.tensions) ? analysisData.tensions : [];
    const issuePositions = analysisData.issue_positions || {};
    const irishParties = Array.isArray(analysisData.irish_parties) ? analysisData.irish_parties : [];
    const internationalMatches = Array.isArray(analysisData.international_matches) ? 
      analysisData.international_matches : [];
    
    return (
      <Card className="w-full" data-enhanced-profile-container="true">
        <CardHeader>
          <CardTitle>Enhanced Political Analysis</CardTitle>
          <CardDescription>
            AI-powered insights into your multidimensional political profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="matches">Political Matches</TabsTrigger>
              <TabsTrigger value="policies">Policy Positions</TabsTrigger>
              <TabsTrigger value="beliefs">Beliefs & Tensions</TabsTrigger>
            </TabsList>
            
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 pt-4">
              <div className="space-y-4">
                {weights && Object.keys(weights).length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border mb-4">
                    <h4 className="text-base font-medium mb-2 flex items-center gap-2">
                      <span className="text-xl">⚖️</span> Dimension Weights Applied
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(weights).map(([dimension, weight]) => (
                        <div key={dimension} className="text-sm flex items-center gap-1">
                          <span className={`font-medium ${parseFloat(weight as any) > 1.5 ? 'text-green-600 dark:text-green-400' : parseFloat(weight as any) < 0.5 ? 'text-gray-400' : ''}`}>
                            {dimension.charAt(0).toUpperCase() + dimension.slice(1)}:
                          </span>
                          <span className={`${parseFloat(weight as any) > 1.5 ? 'text-green-600 dark:text-green-400 font-bold' : parseFloat(weight as any) < 0.5 ? 'text-gray-400' : ''}`}>
                            {weight}×
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2 italic">
                      Your analysis emphasizes dimensions with higher weights and de-emphasizes those with lower weights.
                    </p>
                  </div>
                )}
                <div>
                  <h4 className="text-base font-medium mb-3 flex items-center gap-2">
                    <span className="text-xl">🔍</span> Profile Summary
                  </h4>
                  {typeof profileAnalysis === 'string' ? (
                    <div className="text-gray-700 dark:text-gray-300 space-y-3">
                      {profileAnalysis.split('. ')
                        .filter(sentence => sentence.length > 10)
                        .slice(0, 4)
                        .map((sentence, i) => (
                          <p key={i} className="leading-relaxed">
                            {sentence.trim() + (sentence.endsWith('.') ? '' : '.')}
                          </p>
                        ))
                      }
                    </div>
                  ) : (
                    <p className="text-gray-700 dark:text-gray-300">
                      {profileAnalysis}
                    </p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="border rounded-lg p-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <span>💰</span> Economic Outlook
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {dimensions.economic > 3 
                        ? "Favors market-driven economics with limited regulation." 
                        : dimensions.economic < -3 
                        ? "Favors managed economics with robust social supports."
                        : "Takes a balanced approach to economic policies."}
                    </p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <span>🌍</span> Global Perspective
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {dimensions.globalism > 3 
                        ? "Prioritizes national interests over international cooperation." 
                        : dimensions.globalism < -3 
                        ? "Favors international cooperation and global governance."
                        : "Balances national interests with global cooperation."}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            {/* Matches Tab */}
            <TabsContent value="matches" className="space-y-6 pt-4">
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="text-xl">🏛️</span> Irish Political Parties
                </h3>
                
                {/* Party matches from database and OpenAI */}
                <PartyMatchResults dimensions={dimensions} />
              </div>
            </TabsContent>
            
            {/* Policy Positions Tab */}
            <TabsContent value="policies" className="pt-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Key Policy Positions</h3>
                  
                  {Object.keys(issuePositions).length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(issuePositions).map(([issue, position]) => (
                        <div key={issue} className="border rounded-lg p-3">
                          <h4 className="text-sm font-medium capitalize">{issue}</h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{position}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-500 italic">
                      Policy position data not available
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            {/* Beliefs & Tensions Tab */}
            <TabsContent value="beliefs" className="space-y-6 pt-4">
              <div>
                <h3 className="text-lg font-semibold mb-3">Core Beliefs</h3>
                
                {beliefs.length > 0 ? (
                  <div className="space-y-2">
                    {beliefs.map((belief, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-500 mt-1">•</span>
                        <p className="text-gray-700 dark:text-gray-300">{belief}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 italic">
                    Belief data not available
                  </div>
                )}
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3">Policy Tensions</h3>
                
                {tensions.length > 0 ? (
                  <div className="space-y-2">
                    {tensions.map((tension, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="text-orange-500 mt-1">•</span>
                        <p className="text-gray-700 dark:text-gray-300">{tension}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 italic">
                    Tension data not available
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

export default EnhancedPoliticalProfileExplanationNew;