import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const EnhancedPoliticalProfileExplanation: React.FC<EnhancedPoliticalProfileExplanationProps> = ({ dimensions, weights }) => {
  const [selectedIssue, setSelectedIssue] = useState<string>("all");
  const [storedWeights, setStoredWeights] = useState<Record<string, number> | undefined>(undefined);
  const [shouldFetch, setShouldFetch] = useState(true);
  
  // Store current dimensions for API requests
  const [currentDimensions, setCurrentDimensions] = useState(dimensions);
  
  // Initialize stored weights on first load only
  useEffect(() => {
    if (!storedWeights) {
      setStoredWeights(weights);
    }
    // Only set current dimensions on first load 
    if (!currentDimensions) {
      setCurrentDimensions(dimensions);
    }
  }, []);
  
  // Add event listener for regenerate-analysis event
  useEffect(() => {
    const handleRegenerate = (event: any) => {
      console.log("EnhancedPoliticalProfileExplanation: Received regenerate event", event.detail);
      
      // Directly call the API with fresh values from the event
      const freshWeights = event.detail.weights;
      
      // Make a direct API call without using refetch to ensure fresh values
      apiRequest({
        method: 'POST',
        path: '/api/enhanced-profile/complete-analysis',
        body: {
          dimensions: dimensions,
          weights: freshWeights
        }
      })
      .then(response => {
        // Manually update the data state
        setData(response.data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Error in direct API call for enhanced profile:", err);
        setIsError(true);
        setError(err);
        setIsLoading(false);
      });
      
      // Set loading state
      setIsLoading(true);
    };
    
    // Add the event listener
    window.addEventListener('regenerate-analysis', handleRegenerate);
    
    // Cleanup when component unmounts
    return () => {
      window.removeEventListener('regenerate-analysis', handleRegenerate);
    };
  }, [dimensions]);
  
  // Manual API call state management
  const [manualData, setManualData] = useState<CompleteAnalysis | null>(null);
  const [manualIsLoading, setManualIsLoading] = useState(false);
  const [manualIsError, setManualIsError] = useState(false);
  const [manualError, setManualError] = useState<any>(null);
  
  // Query for initial data load
  const { data: queryData, isLoading: queryIsLoading, isError: queryIsError, error: queryError, refetch } = useQuery({
    queryKey: ['/api/enhanced-profile/complete-analysis'],
    queryFn: async () => {
      // Use the most current state values for the API call - directly from state
      const currentWeights = weights;
      const currentDims = dimensions;
      
      // Log the exact parameters being used for the API call
      console.log('EXPLICIT REGENERATION - Using dimensions:', currentDims);
      console.log('EXPLICIT REGENERATION - Using weights:', currentWeights);
      
      try {
        // Always use the direct values not the state variables to avoid staleness
        const response = await apiRequest({
          method: 'POST',
          path: '/api/enhanced-profile/complete-analysis',
          body: {
            dimensions: currentDims,
            weights: currentWeights
          }
        });
        
        if (!response || !response.data) {
          throw new Error("Invalid API response structure");
        }
        
        console.log("Complete analysis API response received successfully");
        return response.data as CompleteAnalysis;
      } catch (err) {
        console.error("Error calling API:", err);
        throw err;
      }
    },
    enabled: false, // Never auto-run this query - only triggered by explicit regenerateAnalysis call
    refetchOnWindowFocus: false,
    staleTime: Infinity, // Don't refetch automatically
  });
  
  // Function to manually trigger analysis with current weights
  const regenerateAnalysis = () => {
    // First update the state values
    setCurrentDimensions({...dimensions});
    setStoredWeights({...weights});
    
    // Use the current values directly in the refetch call
    // This ensures we don't wait for state updates to propagate
    refetch().catch(err => {
      console.error("Failed to refetch analysis:", err);
    });
  };

  // Show loading state
  if (isLoading) {
    return (
      <Card className="w-full">
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
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Enhanced Political Analysis</CardTitle>
          <CardDescription>
            There was an error generating your political profile analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-red-500 mb-4">
            {error instanceof Error ? error.message : "Something went wrong. Please try again."}
          </p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show results if we have data
  if (data) {
    // Log the data to see what we're actually receiving
    console.log("Complete analysis data:", data);
    
    // Extract the data fields we need, handling different possible data formats
    const ideology = data.ideology || (typeof data.description === 'string' ? data.description?.split('.')[0] : "Progressive Left");
    const profileAnalysis = data.profile_analysis || (typeof data.description === 'string' ? data.description : "Your political orientation leans towards progressive values with an emphasis on social equality.");
    
    // Handle different formats for beliefs data
    let beliefs: string[] = [];
    if (Array.isArray(data.beliefs)) {
      beliefs = data.beliefs;
    } else if (data.beliefs && typeof data.beliefs === 'object') {
      beliefs = Object.values(data.beliefs).map(v => typeof v === 'string' ? v : JSON.stringify(v));
    } else if (typeof data.description === 'string') {
      // Extract key points from description if no beliefs provided
      const sentences = data.description.split('.');
      beliefs = sentences.slice(1, 4).map(s => s.trim()).filter(s => s.length > 20);
    }
    
    const tensions = Array.isArray(data.tensions) ? data.tensions : [];
    const issuePositions = data.issue_positions || {};
    const irishParties = Array.isArray(data.irish_parties) ? data.irish_parties : [];
    const internationalMatches = Array.isArray(data.international_matches) ? data.international_matches : [];
    
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
                  <div className="border rounded-lg p-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <span>👥</span> Social Values
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {dimensions.social > 3 
                        ? "Emphasizes traditional social values and institutions." 
                        : dimensions.social < -3 
                        ? "Promotes progressive social policies and reform."
                        : "Takes a moderate approach to social issues."}
                    </p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <span>🌱</span> Environmental Stance
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {dimensions.environmental > 3 
                        ? "Prioritizes economic development over environmental regulations." 
                        : dimensions.environmental < -3 
                        ? "Emphasizes environmental protection and sustainability."
                        : "Seeks balance between development and environmental concerns."}
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
              
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="text-xl">🌎</span> International Figures
                </h3>
                <div className="space-y-4">
                  {dimensions.economic < -3 && dimensions.social < -3 ? (
                    <>
                      {/* Progressive international figures */}
                      <div className="rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200">
                              <img 
                                src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Jacinda_Ardern_2018.jpg" 
                                alt="Jacinda Ardern"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <h4 className="font-medium text-lg">Jacinda Ardern</h4>
                              <span className="text-sm text-gray-500">New Zealand</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-3">
                          Progressive leader with focus on social welfare, environmental protection, and collaborative governance style.
                        </p>
                      </div>
                      
                      <div className="rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200">
                              <img 
                                src="https://upload.wikimedia.org/wikipedia/commons/0/02/Alexandria_Ocasio-Cortez_Official_Portrait.jpg" 
                                alt="Alexandria Ocasio-Cortez"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <h4 className="font-medium text-lg">Alexandria Ocasio-Cortez</h4>
                              <span className="text-sm text-gray-500">United States</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-3">
                          Progressive advocate for economic equality, environmental justice, and social reform.
                        </p>
                      </div>
                    </>
                  ) : dimensions.economic > 3 && dimensions.social > 3 ? (
                    <>
                      {/* Conservative international figures */}
                      <div className="rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200">
                              <img 
                                src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Angela_Merkel_2021.jpg/220px-Angela_Merkel_2021.jpg" 
                                alt="Angela Merkel"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <h4 className="font-medium text-lg">Angela Merkel</h4>
                              <span className="text-sm text-gray-500">Germany</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-3">
                          Center-right leader known for fiscal conservatism, pragmatic governance, and maintaining traditional institutions while adapting to changing circumstances.
                        </p>
                      </div>
                      
                      <div className="rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200">
                              <img 
                                src="https://upload.wikimedia.org/wikipedia/commons/b/b7/Narendra_Modi_2021.jpg" 
                                alt="Narendra Modi"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <h4 className="font-medium text-lg">Narendra Modi</h4>
                              <span className="text-sm text-gray-500">India</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-3">
                          Nationalist leader with focus on market economics, traditional cultural values, and limited government intervention.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Centrist international figures */}
                      <div className="rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200">
                              <img 
                                src="https://upload.wikimedia.org/wikipedia/commons/9/90/Emmanuel_Macron_%28cropped%29.jpg" 
                                alt="Emmanuel Macron"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <h4 className="font-medium text-lg">Emmanuel Macron</h4>
                              <span className="text-sm text-gray-500">France</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-3">
                          Centrist who combines market-oriented economics with socially progressive values and pro-European internationalism.
                        </p>
                      </div>
                      
                      <div className="rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200">
                              <img 
                                src="https://upload.wikimedia.org/wikipedia/commons/e/e3/Justin_Trudeau_in_Lima%2C_Peru_-_2018_%28cropped%29.jpg" 
                                alt="Justin Trudeau"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <h4 className="font-medium text-lg">Justin Trudeau</h4>
                              <span className="text-sm text-gray-500">Canada</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-3">
                          Center-left leader balancing progressive social policies with mixed economic approach and environmental concerns.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </TabsContent>
            
            {/* Policies Tab */}
            <TabsContent value="policies" className="space-y-4 pt-4">
              {/* Housing policy */}
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Housing Policy</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {dimensions.economic < -5 
                    ? "You likely support significant government intervention in housing, including robust public housing programs, rent control, and strong tenant protections."
                    : dimensions.economic < 0
                    ? "You probably favor a mix of government housing programs and market-based solutions, with stronger regulations to ensure affordability."
                    : dimensions.economic < 5
                    ? "You may support targeted housing assistance while primarily relying on private development with incentives to address housing needs."
                    : "You likely favor market-based approaches to housing with minimal government intervention, focusing on reducing regulations to increase supply."}
                </p>
              </div>
              
              {/* Healthcare policy */}
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Healthcare Policy</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {dimensions.welfare < -5 
                    ? "You likely support a comprehensive universal healthcare system with minimal private involvement and emphasis on equitable access."
                    : dimensions.welfare < 0
                    ? "You probably favor expanding public healthcare options while maintaining a role for private insurance and care providers."
                    : dimensions.welfare < 5
                    ? "You may support a mixed healthcare system with basic government programs alongside a significant private healthcare market."
                    : "You likely favor a primarily market-based healthcare system with minimal government involvement beyond basic safety nets."}
                </p>
              </div>
              
              {/* Economic policy */}
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Economic Policy</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {dimensions.economic < -5 
                    ? "You likely support progressive taxation, robust worker protections, strong social safety nets, and significant market regulation."
                    : dimensions.economic < 0
                    ? "You probably favor a mixed economy with substantial regulation, moderate redistribution, and protection for workers and consumers."
                    : dimensions.economic < 5
                    ? "You may support a market economy with moderate regulation, lower taxes, and limited government intervention."
                    : "You likely favor free market principles, minimal taxation and regulation, and emphasis on individual economic freedom."}
                </p>
              </div>
              
              {/* Environmental policy */}
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Environmental Policy</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {dimensions.environmental < -5 
                    ? "You likely support aggressive climate action, strict environmental regulations, and prioritizing sustainability over short-term economic growth."
                    : dimensions.environmental < 0
                    ? "You probably favor strong environmental protections while seeking balance with economic development needs."
                    : dimensions.environmental < 5
                    ? "You may support moderate environmental protections while emphasizing economic development and technological solutions."
                    : "You likely favor limited environmental regulations, prioritizing economic growth and industry autonomy in addressing environmental concerns."}
                </p>
              </div>
              
              {/* Immigration policy */}
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Immigration Policy</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {dimensions.cultural < -5 && dimensions.globalism < -5
                    ? "You likely support open immigration policies, multiculturalism, and strong protections for immigrants and refugees."
                    : (dimensions.cultural < 0 || dimensions.globalism < 0)
                    ? "You probably favor relatively open immigration with some controls and integration requirements."
                    : (dimensions.cultural > 0 || dimensions.globalism > 0)
                    ? "You may support more restrictive immigration policies with emphasis on national interests and cultural integration."
                    : "You likely favor strict immigration controls, prioritizing national sovereignty and cultural preservation."}
                </p>
              </div>
            </TabsContent>
            
            {/* Beliefs Tab */}
            <TabsContent value="beliefs" className="space-y-4 pt-4">
              <div>
                <h3 className="font-medium mb-2">Core Beliefs</h3>
                <ul className="list-disc pl-5 space-y-2">
                  {beliefs.map((belief, index) => (
                    <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
                      {belief}
                    </li>
                  ))}
                </ul>
              </div>
              
              {tensions.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium mb-2">Political Tensions</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    {tensions.map((tension, index) => (
                      <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
                        {tension}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="font-medium mb-2">Understanding Your Results</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Your political profile is multidimensional, with positions that may not perfectly align with any one party or ideology. The analysis above highlights the key aspects of your political beliefs based on your quiz responses.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-3">
                  Remember that political beliefs exist on a spectrum and continue to evolve through conversation, education, and life experience.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  }
  
  // Default state if no data and not loading or error
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Enhanced Political Analysis</CardTitle>
        <CardDescription>
          Generating your analysis...
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-4 w-[85%]" />
      </CardContent>
    </Card>
  );
}

export default EnhancedPoliticalProfileExplanation;