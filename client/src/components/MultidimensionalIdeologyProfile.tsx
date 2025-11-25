import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { HelpCircle, RotateCcw, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { dimensionDisplayConfig, DimensionDisplayConfig, IdeologicalDimensions, getDimensionDescription } from '@shared/quizTypes';
import { useQueryClient } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

// Default weights for all dimensions
const DEFAULT_WEIGHTS: Record<string, number> = {
  economic: 1,
  social: 1,
  cultural: 1,
  globalism: 1,
  environmental: 1,
  authority: 1,
  welfare: 1,
  technocratic: 1
};

interface MultidimensionalIdeologyProfileProps {
  dimensions: IdeologicalDimensions;
  ideology: string;
  description: string;
  onWeightsChange?: (weights: Record<string, number>) => void;
  initialWeights?: Record<string, number>;
}

const MultidimensionalIdeologyProfile: React.FC<MultidimensionalIdeologyProfileProps> = ({
  dimensions,
  ideology,
  description,
  onWeightsChange,
  initialWeights
}) => {
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  const [weights, setWeights] = useState<Record<string, number>>(initialWeights || DEFAULT_WEIGHTS);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Convert scores from -10 to +10 scale to 0-100% for display
  const getProgressValue = (value: number): number => {
    return ((value + 10) / 20) * 100;
  };
  
  // Get color class based on dimension score
  const getDimensionColor = (value: number, config: DimensionDisplayConfig): string => {
    // Use the color from the dimension config
    return config.color;
  };
  
  // Toggle dimension expansion for more detailed view
  const toggleDimension = (dimensionId: string) => {
    if (expandedDimension === dimensionId) {
      setExpandedDimension(null);
    } else {
      setExpandedDimension(dimensionId);
    }
  };

  // Load weights from localStorage on component mount
  useEffect(() => {
    try {
      const savedWeights = localStorage.getItem('dimensionWeights');
      if (savedWeights) {
        const parsedWeights = JSON.parse(savedWeights);
        setWeights(parsedWeights);
        if (onWeightsChange) {
          onWeightsChange(parsedWeights);
        }
        console.log("Loaded saved weights from localStorage:", parsedWeights);
      }
    } catch (error) {
      console.error("Error loading saved weights:", error);
    }
  }, [onWeightsChange]);

  // Handle weight changes from sliders
  const handleWeightChange = (dimension: string, value: number[]) => {
    const newWeights = { ...weights, [dimension]: value[0] };
    setWeights(newWeights);
    
    // Notify parent component if callback provided
    if (onWeightsChange) {
      onWeightsChange(newWeights);
    }
  };
  
  // Reset weights to default
  const resetWeights = () => {
    setWeights(DEFAULT_WEIGHTS);
    if (onWeightsChange) {
      onWeightsChange(DEFAULT_WEIGHTS);
    }
    toast({
      title: "Weights Reset",
      description: "All dimension weights have been reset to default values.",
    });
  };
  
  // Save weights to localStorage, notify parent component, and regenerate analysis
  const saveWeights = async () => {
    // Save to localStorage
    localStorage.setItem('dimensionWeights', JSON.stringify(weights));
    localStorage.setItem('resultsWeights', JSON.stringify(weights)); // Also save for results page
    
    // Notify parent component (this is the key part that triggers UI updates)
    if (onWeightsChange) {
      onWeightsChange(weights);
    }
    
    // Show loading toast
    toast({
      title: "Applying Weights",
      description: "Saving your custom weights and updating your political analysis...",
    });
    
    try {
      // Call API to regenerate analysis with weights
      const response = await fetch('/api/enhanced-profile/complete-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dimensions: dimensions,
          weights: weights
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to regenerate analysis');
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        // Success message
        toast({
          title: "Analysis Updated",
          description: "Your political profile has been updated with your customized weights.",
        });
        
        // Log the updated analysis
        console.log("Updated political analysis:", data.data);
        
        // Explicitly invalidate all relevant queries to refresh the UI components
        // Each of these will trigger a refetch of the associated component
        console.log('Triggering react-query cache invalidation...');
        
        queryClient.invalidateQueries({ 
          queryKey: ['/api/enhanced-profile/complete-analysis'] 
        });
        
        queryClient.invalidateQueries({ 
          queryKey: ['/api/enhanced-profile/context-analysis'] 
        });
        
        queryClient.invalidateQueries({ 
          queryKey: ['/api/party-match/party-matches'] 
        });
        
        console.log('Successfully triggered refetch of all political profile data');
      } else {
        throw new Error('Invalid response data');
      }
    } catch (error) {
      console.error("Error regenerating analysis:", error);
      
      // Show success message for weights anyway
      toast({
        title: "Weights Saved",
        description: "Your dimension weights have been saved. The visual analysis will update when you view it.",
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Your Political Profile</span>
          <span className="text-sm font-normal text-muted-foreground">(8-Dimensional Analysis)</span>
        </CardTitle>
        <CardDescription>
          Expanded political analysis using eight distinct ideological dimensions
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">{ideology}</h3>
          <p className="text-gray-600 dark:text-gray-400">{description}</p>
        </div>
        
        <Tabs defaultValue="bars" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bars">Dimension Bars</TabsTrigger>
            <TabsTrigger value="details">Detailed Analysis</TabsTrigger>
          </TabsList>
          
          <TabsContent value="bars" className="space-y-4 pt-4">
            {dimensionDisplayConfig.map((dim) => {
              const value = dimensions[dim.id];
              const progressValue = getProgressValue(value);
              
              return (
                <div key={dim.id} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span className="mr-2 text-xl">{dim.icon}</span>
                      <span className="font-medium">{dim.label}</span>
                    </div>
                    <span className="text-sm font-mono">{value > 0 ? '+' : ''}{value.toFixed(1)}</span>
                  </div>
                  
                  <div className="relative h-8">
                    <div className="absolute inset-0 flex">
                      <div className="w-1/2 bg-gray-100 dark:bg-gray-800 flex justify-end items-center pr-2 text-xs text-gray-500">
                        {dim.leftLabel}
                      </div>
                      <div className="w-1/2 bg-gray-200 dark:bg-gray-700 flex justify-start items-center pl-2 text-xs text-gray-500">
                        {dim.rightLabel}
                      </div>
                    </div>
                    
                    <div className="absolute inset-0 w-full">
                      <div className="absolute top-0 bottom-0 w-px bg-gray-400 left-1/2 z-10"></div>
                      <div 
                        className="absolute top-0 bottom-0 rounded-full transition-all duration-500 z-20"
                        style={{
                          width: '12px',
                          left: `calc(${progressValue}% - 6px)`,
                          backgroundColor: dim.color,
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => toggleDimension(dim.id)}
                    className="p-0 h-auto text-xs text-muted-foreground"
                  >
                    {getDimensionDescription(dim.id, value)}
                  </Button>
                  
                  {expandedDimension === dim.id && (
                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm">
                      <p className="mb-2">
                        Your score of <strong>{value > 0 ? '+' : ''}{value.toFixed(1)}</strong> on the {dim.label} dimension 
                        indicates you tend to favor {value > 0 ? dim.rightLabel : dim.leftLabel} approaches.
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <strong>{dim.leftLabel} (-10):</strong>
                          <p className="text-gray-600 dark:text-gray-400">
                            {getDimensionExplanation(dim.id, -10)}
                          </p>
                        </div>
                        <div>
                          <strong>{dim.rightLabel} (+10):</strong>
                          <p className="text-gray-600 dark:text-gray-400">
                            {getDimensionExplanation(dim.id, 10)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>
          
          <TabsContent value="details" className="pt-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Multidimensional Analysis</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  This expanded analysis looks beyond the traditional left-right spectrum to capture the nuance and complexity of your political beliefs across 8 distinct dimensions.
                </p>
              </div>
              
              <div className="grid gap-4">
                {dimensionDisplayConfig.map((dim) => {
                  const value = dimensions[dim.id];
                  return (
                    <Card key={dim.id} className="overflow-hidden">
                      <div 
                        className="h-1.5" 
                        style={{ backgroundColor: dim.color }}
                      ></div>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold flex items-center">
                            <span className="mr-2 text-xl">{dim.icon}</span>
                            <span className="dimension-tooltip">
                              {dim.label} Dimension
                              <span className="tooltip-text">
                                <p>{getDimensionTooltipDescription(dim.id)}</p>
                                <p className="mt-1"><strong>-10</strong>: {getDimensionTooltipNegative(dim.id)}</p>
                                <p><strong>+10</strong>: {getDimensionTooltipPositive(dim.id)}</p>
                              </span>
                            </span>
                          </h4>
                          <span className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                            {value > 0 ? '+' : ''}{value.toFixed(1)}
                          </span>
                        </div>
                        <p className="text-sm mb-3">
                          {getDimensionDetailedExplanation(dim.id, value)}
                        </p>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                          <span>{dim.leftLabel} (-10)</span>
                          <span>{dim.rightLabel} (+10)</span>
                        </div>
                        <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                          <div className="absolute top-0 bottom-0 left-1/2 bg-gray-400 w-0.5 transform -translate-x-1/2"></div>
                          <div 
                            className="absolute top-0 bottom-0 rounded-full"
                            style={{
                              width: `8px`,
                              left: `calc(${getProgressValue(value)}% - 4px)`,
                              backgroundColor: dim.color
                            }}
                          ></div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>
          
          {/* Weights content moved to EnhancedProfileExplanation -> Political Matches section */}
        </Tabs>
      </CardContent>
    </Card>
  );
};

// CSS for the tooltips
const tooltipStyles = `
  .dimension-tooltip {
    position: relative;
    display: inline-block;
    cursor: help;
    border-bottom: 1px dotted #718096;
  }
  
  .dimension-tooltip .tooltip-text {
    visibility: hidden;
    width: 260px;
    background-color: white;
    color: #4a5568;
    text-align: left;
    border-radius: 6px;
    padding: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    
    /* Position the tooltip */
    position: absolute;
    z-index: 50;
    bottom: 125%;
    left: 0;
    margin-bottom: 5px;
    
    /* Fade in/out */
    opacity: 0;
    transition: opacity 0.3s;
  }
  
  .dimension-tooltip:hover .tooltip-text {
    visibility: visible;
    opacity: 1;
  }
  
  /* Dark mode overrides */
  @media (prefers-color-scheme: dark) {
    .dimension-tooltip .tooltip-text {
      background-color: #1a202c;
      color: #e2e8f0;
    }
  }
`;

// Helper functions for tooltips
const getDimensionTooltipDescription = (dimensionId: string): string => {
  switch(dimensionId) {
    case 'economic':
      return "Measures how much government should intervene in the economy.";
    case 'social':
      return "Measures attitudes toward social norms, values and social change.";
    case 'cultural':
      return "Measures attitudes toward cultural identity, traditions, and heritage.";
    case 'globalism':
      return "Measures attitudes toward international cooperation, sovereignty, and borders.";
    case 'environmental':
      return "Measures priority given to environmental protection versus economic development.";
    case 'authority':
      return "Measures attitudes toward authority, personal freedom, and social control.";
    case 'welfare':
      return "Measures attitudes toward social support systems and community responsibility.";
    case 'technocratic':
      return "Measures trust in expertise versus popular opinion in decision-making.";
    default:
      return "";
  }
};

const getDimensionTooltipNegative = (dimensionId: string): string => {
  switch(dimensionId) {
    case 'economic':
      return "Strong government control of economy, public ownership, and wealth redistribution.";
    case 'social':
      return "Socially progressive, supporting diversity, social reform, and individual expression.";
    case 'cultural':
      return "Embraces cultural change, multiculturalism, and reimagining of cultural institutions.";
    case 'globalism':
      return "Internationalist, supporting global governance, open borders, and multilateralism.";
    case 'environmental':
      return "Prioritizes environmental protection, sustainability, and limits on growth.";
    case 'authority':
      return "Libertarian, favoring personal freedoms, civil liberties, and minimal state control.";
    case 'welfare':
      return "Supports universal welfare, public services, and collective social responsibility.";
    case 'technocratic':
      return "Populist, trusting common sense, public opinion, and direct democracy.";
    default:
      return "";
  }
};

const getDimensionTooltipPositive = (dimensionId: string): string => {
  switch(dimensionId) {
    case 'economic':
      return "Free market economy with minimal government regulation and taxation.";
    case 'social':
      return "Socially traditional, valuing established norms, conventional morality, and social stability.";
    case 'cultural':
      return "Preserves cultural heritage, traditions, and national identity against change.";
    case 'globalism':
      return "Nationalist, prioritizing national sovereignty, restricted immigration, and national interests.";
    case 'environmental':
      return "Prioritizes industrial growth, resource extraction, and economic development.";
    case 'authority':
      return "Authoritarian, supporting strong law enforcement, social control, and centralized authority.";
    case 'welfare':
      return "Emphasizes individual responsibility, private charity, and limited public welfare.";
    case 'technocratic':
      return "Technocratic, valuing expert knowledge, credentials, and specialized governance.";
    default:
      return "";
  }
};

// Helper functions for detailed dimension explanations
const getDimensionExplanation = (dimensionId: string, value: number): string => {
  switch(dimensionId) {
    case 'economic':
      return value < 0 
        ? "Favors economic equality, redistribution, and collective ownership"
        : "Favors free markets, private property rights, and limited economic intervention";
    case 'social':
      return value < 0 
        ? "Favors social progress, reform of traditions, and cultural evolution"
        : "Favors traditional social values, established cultural norms, and continuity";
    case 'cultural':
      return value < 0 
        ? "Embraces cultural change, diversity, and evolution of traditions"
        : "Values preservation of cultural heritage, traditions, and national distinctiveness";
    case 'globalism':
      return value < 0 
        ? "Favors international cooperation, open borders, and global governance"
        : "Prioritizes national sovereignty, independence, and national interests";
    case 'environmental':
      return value < 0 
        ? "Prioritizes environmental protection and ecological sustainability"
        : "Prioritizes resource development and industrial/economic growth";
    case 'authority':
      return value < 0 
        ? "Values individual liberty, civil rights, and limited government power"
        : "Values social order, strong authority, and governmental power";
    case 'welfare':
      return value < 0 
        ? "Favors collective welfare systems and shared social responsibility"
        : "Favors individual responsibility and self-reliance";
    case 'technocratic':
      return value < 0 
        ? "Prefers expert-led, data-driven policy making"
        : "Prefers popular will and widely-shared values in policy making";
    default:
      return "";
  }
};

const getDimensionDetailedExplanation = (dimensionId: string, value: number): string => {
  const positionText = getDimensionDescription(dimensionId as keyof IdeologicalDimensions, value);
  
  switch(dimensionId) {
    case 'economic':
      if (value < -6) return `You are ${positionText.toLowerCase()}, supporting significant redistribution of wealth, extensive public services, and potentially public ownership of key economic sectors.`;
      if (value < -2) return `You are ${positionText.toLowerCase()}, favoring progressive taxation, robust public services, and significant regulation of markets.`;
      if (value < 2) return `You are ${positionText.toLowerCase()}, balancing market economics with governmental regulation and modest public services.`;
      if (value < 6) return `You are ${positionText.toLowerCase()}, supporting free enterprise, private property rights, and limited government intervention in markets.`;
      return `You are ${positionText.toLowerCase()}, advocating for minimal taxation, extensive privatization, and unregulated markets.`;
    
    case 'social':
      if (value < -6) return `You are ${positionText.toLowerCase()}, advocating for significant social change, reform of traditional institutions, and expansive individual liberties.`;
      if (value < -2) return `You are ${positionText.toLowerCase()}, supporting gradual social reform while maintaining some societal structures.`;
      if (value < 2) return `You are ${positionText.toLowerCase()}, weighing social progress against stability and tradition.`;
      if (value < 6) return `You are ${positionText.toLowerCase()}, valuing traditional social structures while accepting some modernization.`;
      return `You are ${positionText.toLowerCase()}, strongly prioritizing traditional values, established social structures, and cultural continuity.`;
    
    case 'cultural':
      if (value < -6) return `You are ${positionText.toLowerCase()}, embracing cultural evolution, diversity, and significant reform of traditional customs.`;
      if (value < -2) return `You are ${positionText.toLowerCase()}, supporting cultural adaptation while maintaining connections to cultural heritage.`;
      if (value < 2) return `You are ${positionText.toLowerCase()}, balancing cultural preservation with gradual evolution and diversity.`;
      if (value < 6) return `You are ${positionText.toLowerCase()}, valuing cultural heritage and traditions with limited accommodation of change.`;
      return `You are ${positionText.toLowerCase()}, prioritizing the preservation of cultural identity, traditions, and historical continuity.`;
    
    case 'globalism':
      if (value < -6) return `You are ${positionText.toLowerCase()}, supporting open borders, global governance structures, and international cooperation over national interests.`;
      if (value < -2) return `You are ${positionText.toLowerCase()}, favoring international cooperation and modest integration while maintaining some national autonomy.`;
      if (value < 2) return `You are ${positionText.toLowerCase()}, balancing international cooperation with protection of national sovereignty.`;
      if (value < 6) return `You are ${positionText.toLowerCase()}, prioritizing national sovereignty while engaging selectively in international affairs.`;
      return `You are ${positionText.toLowerCase()}, strongly advocating for national independence, sovereignty, and pursuing national interests above international concerns.`;
    
    case 'environmental':
      if (value < -6) return `You are strongly ecologically focused, prioritizing environmental protection over economic growth and supporting significant regulations on industry.`;
      if (value < -2) return `You favor environmental protection while allowing for sustainable economic development and moderate industry regulation.`;
      if (value < 2) return `You seek a balance between environmental protection and economic development, supporting moderate environmental policies.`;
      if (value < 6) return `You prioritize economic development with basic environmental safeguards and limited restrictions on industry.`;
      return `You strongly prioritize industrial development and resource utilization, with minimal environmental regulations.`;
    
    case 'authority':
      if (value < -6) return `You are ${positionText.toLowerCase()}, advocating for minimal government control, extensive civil liberties, and individual autonomy.`;
      if (value < -2) return `You are ${positionText.toLowerCase()}, supporting strong civil liberties with limited government authority.`;
      if (value < 2) return `You are ${positionText.toLowerCase()}, balancing government authority with individual rights and freedoms.`;
      if (value < 6) return `You are ${positionText.toLowerCase()}, supporting strong governmental authority to maintain order and security.`;
      return `You are ${positionText.toLowerCase()}, advocating for powerful central authority to ensure security, order, and social cohesion.`;
    
    case 'welfare':
      if (value < -6) return `You are strongly communitarian, supporting extensive welfare systems, social safety nets, and collective responsibility for wellbeing.`;
      if (value < -2) return `You favor communitarian approaches with robust public services while maintaining some emphasis on individual choice.`;
      if (value < 2) return `You balance collective welfare systems with individual responsibility and choice.`;
      if (value < 6) return `You emphasize individual responsibility and self-reliance with limited public safety nets.`;
      return `You are strongly individualist, advocating for personal responsibility, self-reliance, and minimal welfare systems.`;
    
    case 'technocratic':
      if (value < -6) return `You are strongly technocratic, believing policy should be primarily determined by experts, data, and technical analysis.`;
      if (value < -2) return `You favor evidence-based policy making with significant input from experts and technical analysis.`;
      if (value < 2) return `You balance technical expertise with public values and democratic input in policy making.`;
      if (value < 6) return `You emphasize the importance of public opinion and widely-shared values over technical expertise in policy making.`;
      return `You are strongly populist, believing policy should primarily reflect the will and values of ordinary people rather than experts.`;
    
    default:
      return "";
  }
};

export default MultidimensionalIdeologyProfile;