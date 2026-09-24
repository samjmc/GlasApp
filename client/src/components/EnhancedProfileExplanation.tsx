import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { DIMENSION_POLES, IDEOLOGY_DIMENSIONS, type IdeologyVector } from "@shared/ideology";
import PartyMatchResults from "./PartyMatchResults";
import { RotateCcw, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { defaultWeights, type DimensionWeights } from "@/lib/ideologyApi";
import { DIMENSION_STYLE } from "@/lib/ideologyDisplay";
import { storeWeights } from "@/lib/quizStorage";

interface EnhancedProfileExplanationProps {
  dimensions: IdeologyVector;
  /** Match weights, 0..3 per dimension. Owned by the page so they survive tab switches. */
  weights: DimensionWeights;
  onWeightsChange: (weights: DimensionWeights) => void;
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

const EnhancedProfileExplanation: React.FC<EnhancedProfileExplanationProps> = ({
  dimensions,
  weights,
  onWeightsChange
}) => {
  // State for managing data
  const [analysisData, setAnalysisData] = useState<CompleteAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Access toast for notifications
  const { toast } = useToast();

  // Weight changes update the party matches immediately, not the OpenAI-based analysis
  const handleWeightChange = (dimensionId: keyof DimensionWeights, value: number[]) => {
    onWeightsChange({ ...weights, [dimensionId]: value[0] });
  };

  const resetWeights = () => {
    onWeightsChange(defaultWeights());
  };

  // Save weights to localStorage only (no regeneration needed)
  const saveWeights = () => {
    storeWeights(weights);

    // Show toast notification to confirm weights were saved
    toast({
      title: "Weights Saved",
      description: "Your dimension weights have been saved and will be used for future sessions.",
      duration: 3000
    });
    
    // No need to regenerate analysis as party matches already update in real-time
  };
  
  // Function to fetch data directly
  const fetchAnalysisData = async (dims: IdeologyVector, wts: Partial<DimensionWeights> = {}) => {
    setIsLoading(true);
    setIsError(false);
    
    console.log("Direct fetch - dimensions:", dims);
    console.log("Direct fetch - weights:", wts);
    
    try {
      const response = await fetch('/api/enhanced-profile/complete-analysis', {
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
      console.log("Analysis data received:", data);
      
      if (data.success && data.data) {
        setAnalysisData(data.data);
      } else {
        throw new Error("Invalid API response format");
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error("Error loading analysis:", err);
      setIsError(true);
      setErrorMessage(err instanceof Error ? err.message : "Unknown error occurred");
      setIsLoading(false);
    }
  };
  
  // Only load on initial mount - NOT when weights change
  useEffect(() => {
    console.log("Initial load - fetching analysis data");
    fetchAnalysisData(dimensions, weights || {});
  }, []); // Empty dependency array means this runs only once on mount
  
  // Listen for regenerate events
  useEffect(() => {
    const handleRegenerate = (event: Event) => {
      const detail = (event as CustomEvent<{ weights?: Record<string, number> }>).detail;
      console.log("EnhancedProfileExplanation: Received regenerate event", detail);
      
      // For debugging - show exactly what weights we received
      console.log("EVENT DETAIL:", JSON.stringify(detail));
      
      // Always force a refresh with the weights from the event
      // This ensures the component updates when the Save and Regenerate button is clicked
      if (detail?.weights) {
        // Show loading state immediately
        setIsLoading(true);
        console.log("FORCE REGENERATING Enhanced Profile with weights:", detail.weights);
        
        // Wait a brief moment to ensure UI shows loading state
        setTimeout(() => {
          fetchAnalysisData(dimensions, detail.weights);
        }, 100);
      }
    };
    
    // Add both event listeners to catch all possible regeneration events
    window.addEventListener('regenerate-analysis', handleRegenerate);
    
    return () => {
      window.removeEventListener('regenerate-analysis', handleRegenerate);
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
      <Card className="w-full max-w-none" data-enhanced-profile-container="true">
        <CardHeader className="pb-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <span className="text-indigo-600 dark:text-indigo-400 text-xl">🔮</span> 
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
              Enhanced Political Analysis
            </span>
          </CardTitle>
          <CardDescription className="text-gray-700 dark:text-gray-300">
            AI-powered insights into your multidimensional political profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mt-2 mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="matches">Political Matches</TabsTrigger>
              <TabsTrigger value="policies">Policy Positions</TabsTrigger>
              <TabsTrigger value="beliefs">Beliefs & Tensions</TabsTrigger>
            </TabsList>
            
            {/* Overview Tab */}
            <TabsContent value="overview" className="pt-2">
              <div className="space-y-2">
                <div>
                  <h4 className="text-base font-medium mb-2 flex items-center gap-2">
                    <span className="text-xl">🔍</span> Profile Summary
                  </h4>
                  {typeof profileAnalysis === 'string' ? (
                    <div className="text-gray-700 dark:text-gray-300 space-y-1 text-sm">
                      {profileAnalysis.split('. ')
                        .filter(sentence => sentence.length > 10)
                        .slice(0, 3)
                        .map((sentence, i) => (
                          <p key={i} className="leading-relaxed">
                            {sentence.trim() + (sentence.endsWith('.') ? '' : '.')}
                          </p>
                        ))
                      }
                    </div>
                  ) : (
                    <p className="text-gray-700 dark:text-gray-300 text-sm">
                      {profileAnalysis}
                    </p>
                  )}
                </div>
                
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <div className="border rounded-lg p-2">
                    <h4 className="text-xs font-medium flex items-center gap-1">
                      <span>💰</span> Economics
                    </h4>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                      {dimensions.economic > 3 
                        ? "Market-driven with limited regulation" 
                        : dimensions.economic < -3 
                        ? "Managed with social supports"
                        : "Balanced approach"}
                    </p>
                  </div>
                  <div className="border rounded-lg p-2">
                    <h4 className="text-xs font-medium flex items-center gap-1">
                      <span>🌍</span> Global View
                    </h4>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                      {dimensions.globalism > 3 
                        ? "Prioritizes national interests" 
                        : dimensions.globalism < -3 
                        ? "Favors global cooperation"
                        : "Balanced perspective"}
                    </p>
                  </div>
                  <div className="border rounded-lg p-2">
                    <h4 className="text-xs font-medium flex items-center gap-1">
                      <span>🏛️</span> Culture
                    </h4>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                      {dimensions.cultural > 3 
                        ? "Traditional values focused" 
                        : dimensions.cultural < -3 
                        ? "Progressive and diverse"
                        : "Mix of perspectives"}
                    </p>
                  </div>
                  <div className="border rounded-lg p-2">
                    <h4 className="text-xs font-medium flex items-center gap-1">
                      <span>🌱</span> Environment
                    </h4>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                      {dimensions.environmental > 3 
                        ? "Development priority" 
                        : dimensions.environmental < -3 
                        ? "Ecological protection"
                        : "Balanced policy"}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            {/* Matches Tab */}
            <TabsContent value="matches" className="space-y-6 pt-4">
              <div className="space-y-6">
                {/* Create sub-tabs for Weights and Party Matches */}
                <Tabs defaultValue="parties" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="parties">Party Matches</TabsTrigger>
                    <TabsTrigger value="weights">Customize Weights</TabsTrigger>
                  </TabsList>
                  
                  {/* Party Matches Sub-Tab */}
                  <TabsContent value="parties" className="pt-4">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <span className="text-xl">🏛️</span> Irish Political Parties
                        </h3>
                        
                        {/* Add a small summary of active weights */}
                        <div className="text-sm bg-gray-50 dark:bg-gray-800 rounded-lg py-1 px-3 flex items-center gap-1">
                          <span className="text-xs">⚖️</span>
                          <span>
                            {IDEOLOGY_DIMENSIONS.some(d => weights[d] !== 1)
                              ? "Custom weights applied" 
                              : "Default weights"}
                          </span>
                        </div>
                      </div>
                      
                      {/* Party matches from database and OpenAI - now with weights */}
                      <PartyMatchResults dimensions={dimensions} weights={weights} />
                    </div>
                  </TabsContent>
                  
                  {/* Weights Customization Sub-Tab */}
                  <TabsContent value="weights" className="pt-4">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
                      <h4 className="text-base font-medium mb-2 flex items-center gap-2">
                        <span className="text-xl">⚖️</span> Customize Dimension Weights
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Adjust the importance of each dimension when calculating your political party matches.
                        Higher values give more weight to a dimension, lower values reduce its importance.
                      </p>
                      
                      <div className="space-y-3">
                        {IDEOLOGY_DIMENSIONS.map((dim) => (
                          <div key={dim} className="space-y-1">
                            <div className="flex justify-between items-center">
                              <div className="flex flex-col">
                                <div className="flex items-center">
                                  <span className="mr-2 text-xl">{DIMENSION_STYLE[dim].icon}</span>
                                  <span className="font-medium">{DIMENSION_POLES[dim].label}</span>
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-7">
                                  {DIMENSION_POLES[dim].negative} vs. {DIMENSION_POLES[dim].positive}
                                </span>
                              </div>
                              <span className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                {weights[dim].toFixed(1)}×
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-xs">0×</span>
                              <Slider
                                value={[weights[dim]]}
                                min={0}
                                max={3}
                                step={0.1}
                                onValueChange={(value) => handleWeightChange(dim, value)}
                                className="flex-grow"
                              />
                              <span className="text-xs">3.0×</span>
                            </div>

                            <p className="text-xs text-muted-foreground">
                              {weights[dim] < 0.5 ? (
                                "This dimension will have minimal impact on your match results."
                              ) : weights[dim] > 2 ? (
                                "This dimension will have a major impact on your match results."
                              ) : (
                                "This dimension has standard weighting in your match results."
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex justify-between mt-6">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={resetWeights}
                          className="flex items-center gap-2"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Reset to Default
                        </Button>
                        
                        <Button 
                          size="sm"
                          onClick={saveWeights}
                          className="flex items-center gap-2"
                        >
                          <Save className="h-4 w-4" />
                          Save Weights
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </TabsContent>
            
            {/* Policy Positions Tab */}
            <TabsContent value="policies" className="pt-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <span className="text-xl text-green-600 dark:text-green-400">📜</span> Key Policy Positions
                  </h3>
                  
                  {Object.keys(issuePositions).length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {Object.entries(issuePositions).map(([issue, position]) => (
                        <div 
                          key={issue} 
                          className="border border-green-200 dark:border-green-800 rounded-lg p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <h4 className="text-sm font-medium capitalize flex items-center gap-2">
                            <span className="text-green-600 dark:text-green-400">
                              {issue === 'environment' ? '🌿' : 
                               issue === 'healthcare' ? '🏥' : 
                               issue === 'housing' ? '🏠' : 
                               issue === 'economy' ? '💰' : 
                               issue === 'education' ? '🎓' : 
                               issue === 'immigration' ? '🌐' : 
                               issue === 'security' ? '🛡️' : '📋'}
                            </span>
                            {issue.charAt(0).toUpperCase() + issue.slice(1)}
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{position}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-green-50 dark:bg-green-950 rounded-lg p-6 text-center border border-green-200 dark:border-green-900">
                      <span className="text-4xl block mb-3">📊</span>
                      <h4 className="text-lg font-medium text-green-700 dark:text-green-300 mb-2">Policy Analysis</h4>
                      <p className="text-gray-600 dark:text-gray-400">
                        Based on your multidimensional profile, we predict you would likely support:
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="border border-green-200 dark:border-green-800 rounded-md p-3 bg-white dark:bg-gray-800">
                          <span className="text-xl">🏠</span>
                          <p className="text-sm mt-1">{dimensions.economic > 0 ? 
                            "Market-based housing solutions with targeted supports" : 
                            "Expanded public housing and rent control measures"}
                          </p>
                        </div>
                        <div className="border border-green-200 dark:border-green-800 rounded-md p-3 bg-white dark:bg-gray-800">
                          <span className="text-xl">🏥</span>
                          <p className="text-sm mt-1">{dimensions.welfare > 0 ? 
                            "Private healthcare with public options for vulnerable groups" : 
                            "Universal healthcare system with equal access for all citizens"}
                          </p>
                        </div>
                        <div className="border border-green-200 dark:border-green-800 rounded-md p-3 bg-white dark:bg-gray-800">
                          <span className="text-xl">🌿</span>
                          <p className="text-sm mt-1">{dimensions.environmental > 0 ? 
                            "Balanced environmental policies that don't impede growth" : 
                            "Strong climate action and environmental protection measures"}
                          </p>
                        </div>
                        <div className="border border-green-200 dark:border-green-800 rounded-md p-3 bg-white dark:bg-gray-800">
                          <span className="text-xl">💰</span>
                          <p className="text-sm mt-1">{dimensions.economic > 0 ? 
                            "Lower taxes and reduced business regulations" : 
                            "Progressive taxation and stronger corporate oversight"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            {/* Beliefs & Tensions Tab */}
            <TabsContent value="beliefs" className="space-y-6 pt-4">
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="text-xl text-blue-600 dark:text-blue-400">💭</span> Core Beliefs
                </h3>
                
                {beliefs.length > 0 ? (
                  <div className="space-y-3">
                    {beliefs.map((belief, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <span className="text-blue-600 dark:text-blue-400 text-xl mt-0.5">
                          {index === 0 ? '🏛️' : 
                           index === 1 ? '⚖️' : 
                           index === 2 ? '🌍' : 
                           index === 3 ? '🤝' : 
                           index === 4 ? '💼' : '💭'}
                        </span>
                        <p className="text-gray-700 dark:text-gray-300">{belief}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-6 text-center border border-blue-200 dark:border-blue-900">
                    <span className="text-4xl block mb-3">🧠</span>
                    <h4 className="text-lg font-medium text-blue-700 dark:text-blue-300 mb-2">Based on your profile</h4>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Your profile suggests these core political values:
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="border border-blue-200 dark:border-blue-800 rounded-md p-3 bg-white dark:bg-gray-800">
                        <p className="text-sm">{dimensions.economic > 0 ? 
                          "Markets should generally operate with minimal interference" : 
                          "Economic systems should prioritize fairness over efficiency"}
                        </p>
                      </div>
                      <div className="border border-blue-200 dark:border-blue-800 rounded-md p-3 bg-white dark:bg-gray-800">
                        <p className="text-sm">{dimensions.social > 0 ? 
                          "Social policies should respect traditional values" : 
                          "Personal freedoms should be maximized in social policy"}
                        </p>
                      </div>
                      <div className="border border-blue-200 dark:border-blue-800 rounded-md p-3 bg-white dark:bg-gray-800">
                        <p className="text-sm">{dimensions.globalism > 0 ? 
                          "National sovereignty should be protected from global institutions" : 
                          "International cooperation is essential for addressing challenges"}
                        </p>
                      </div>
                      <div className="border border-blue-200 dark:border-blue-800 rounded-md p-3 bg-white dark:bg-gray-800">
                        <p className="text-sm">{dimensions.authority > 0 ? 
                          "Strong governance provides necessary order and security" : 
                          "Individual rights should be protected from government overreach"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="text-xl text-orange-600 dark:text-orange-400">⚡</span> Policy Tensions
                </h3>
                
                {tensions.length > 0 ? (
                  <div className="space-y-3">
                    {tensions.map((tension, index) => (
                      <div 
                        key={index} 
                        className="flex items-start gap-3 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950 dark:to-yellow-950 rounded-lg border border-orange-200 dark:border-orange-800"
                      >
                        <span className="text-orange-600 dark:text-orange-400 text-xl mt-0.5">⚖️</span>
                        <p className="text-gray-700 dark:text-gray-300">{tension}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-6 text-center border border-orange-200 dark:border-orange-900">
                    <span className="text-4xl block mb-3">⚖️</span>
                    <h4 className="text-lg font-medium text-orange-700 dark:text-orange-300 mb-2">Potential Value Conflicts</h4>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Your profile suggests these potential tensions in policy decisions:
                    </p>
                    <div className="space-y-3">
                      <div className="border border-orange-200 dark:border-orange-800 rounded-md p-3 bg-white dark:bg-gray-800">
                        <p className="text-sm">
                          {(dimensions.economic > 0 && dimensions.welfare < 0) ? 
                            "Balancing your preference for market economics with support for social welfare systems" : 
                            (dimensions.economic < 0 && dimensions.authority > 0) ?
                            "Reconciling economic regulation desires with your support for stronger governance" :
                            "Balancing economic growth with environmental protection priorities"}
                        </p>
                      </div>
                      <div className="border border-orange-200 dark:border-orange-800 rounded-md p-3 bg-white dark:bg-gray-800">
                        <p className="text-sm">
                          {(dimensions.cultural < 0 && dimensions.social > 0) ?
                            "Navigating progressive cultural values while maintaining traditional social structures" :
                            (dimensions.globalism < 0 && dimensions.economic > 0) ?
                            "Supporting global institutions while preserving economic sovereignty" :
                            "Balancing individual freedoms with community needs and social cohesion"}
                        </p>
                      </div>
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

export default EnhancedProfileExplanation;