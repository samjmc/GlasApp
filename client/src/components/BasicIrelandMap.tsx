import { useState, useEffect } from "react";
import { scaleLinear } from "d3-scale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Types
interface MapDataPoint {
  county: string;
  economicAvg: number;
  socialAvg: number;
  countyViews: { [key: string]: number }; // Views on specific issues
  count: number;
}

interface ApiResponse {
  success: boolean;
  data: MapDataPoint[];
  message: string;
}

interface BasicIrelandMapProps {
  height?: number;
}

// Irish political issues
const POLITICAL_ISSUES = [
  { id: "housing", label: "Housing Policy" },
  { id: "immigration", label: "Immigration" },
  { id: "eu", label: "EU Relations" },
  { id: "taxation", label: "Taxation" },
  { id: "healthcare", label: "Healthcare" },
  { id: "northern_ireland", label: "Northern Ireland Relations" },
  { id: "climate", label: "Climate Action" },
  { id: "agriculture", label: "Agriculture" }
];

// County groupings by region
const REGIONS = {
  "Ulster": ["Donegal"],
  "Connacht": ["Galway", "Mayo"],
  "Munster": ["Cork", "Kerry", "Limerick"],
  "Leinster": ["Dublin", "Wicklow", "Wexford", "Kildare"]
};

const BasicIrelandMap = ({
  height = 500
}: BasicIrelandMapProps) => {
  const [activeTab, setActiveTab] = useState<"economic" | "social" | "issues">("economic");
  const [selectedIssue, setSelectedIssue] = useState<string>("housing");
  const [tooltipContent, setTooltipContent] = useState<{county: string, text: string} | null>(null);
  const [mapData, setMapData] = useState<MapDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch geographic data
  useEffect(() => {
    const fetchGeographicData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/geographic/ireland');
        const result: ApiResponse = await response.json();
        
        if (result.success && result.data) {
          setMapData(result.data);
        } else {
          console.error("Failed to load geographic data");
        }
      } catch (err) {
        console.error("Error fetching Ireland geographic data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGeographicData();
  }, []);
  
  // Color scales for the heat map
  const economicColorScale = scaleLinear<string>()
    .domain([-10, 0, 10])
    .range(["#3b82f6", "#94a3b8", "#ef4444"]);
  
  const socialColorScale = scaleLinear<string>()
    .domain([-10, 0, 10])
    .range(["#10b981", "#94a3b8", "#8b5cf6"]);
    
  const issueColorScale = scaleLinear<string>()
    .domain([-10, 0, 10])
    .range(["#f59e0b", "#94a3b8", "#0ea5e9"]);

  // Get color based on value and active tab/issue
  const getColor = (county: MapDataPoint) => {
    if (activeTab === "economic") {
      return economicColorScale(county.economicAvg);
    } else if (activeTab === "social") {
      return socialColorScale(county.socialAvg);
    } else if (activeTab === "issues") {
      const issueValue = county.countyViews[selectedIssue] || 0;
      return issueColorScale(issueValue);
    }
    
    return "#94a3b8"; // Default gray
  };

  // Generate tooltip text
  const getTooltipText = (county: MapDataPoint) => {
    let text = "";
    
    if (activeTab === "economic") {
      text = `Economic: ${county.economicAvg.toFixed(1)}`;
    } else if (activeTab === "social") {
      text = `Social: ${county.socialAvg.toFixed(1)}`;
    } else if (activeTab === "issues") {
      const issueValue = county.countyViews[selectedIssue] || 0;
      const issueLabel = POLITICAL_ISSUES.find(i => i.id === selectedIssue)?.label || selectedIssue;
      text = `${issueLabel}: ${issueValue.toFixed(1)}`;
    }
    
    return text + ` (${county.count} users)`;
  };

  // Helper to get all counties in a region
  const getCountiesInRegion = (region: string) => {
    return REGIONS[region as keyof typeof REGIONS] || [];
  };
  
  // Find region for a county
  const getRegionForCounty = (county: string) => {
    for (const [region, counties] of Object.entries(REGIONS)) {
      if (counties.includes(county)) {
        return region;
      }
    }
    return "Other";
  };
  
  return (
    <Card className="bg-white dark:bg-gray-800 shadow-md overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">Political Views Across Ireland</CardTitle>
          <Badge variant="outline" className="ml-2">
            Live Data
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="economic" className="w-full" onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="economic">Economic Views</TabsTrigger>
            <TabsTrigger value="social">Social Views</TabsTrigger>
            <TabsTrigger value="issues">Specific Issues</TabsTrigger>
          </TabsList>
          
          <TabsContent value="economic" className="mt-0">
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              This map shows the average economic positions across Irish counties:
              <div className="flex items-center justify-between mt-2">
                <span className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#3b82f6" }}></div>
                  Left-leaning
                </span>
                <span className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#ef4444" }}></div>
                  Right-leaning
                </span>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="social" className="mt-0">
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              This map shows the average social positions across Irish counties:
              <div className="flex items-center justify-between mt-2">
                <span className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#10b981" }}></div>
                  Progressive
                </span>
                <span className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#8b5cf6" }}></div>
                  Traditional
                </span>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="issues" className="mt-0">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Issue:
              </label>
              <Select 
                value={selectedIssue} 
                onValueChange={setSelectedIssue}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an issue" />
                </SelectTrigger>
                <SelectContent>
                  {POLITICAL_ISSUES.map(issue => (
                    <SelectItem key={issue.id} value={issue.id}>
                      {issue.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              This map shows positions on {POLITICAL_ISSUES.find(i => i.id === selectedIssue)?.label || selectedIssue}:
              <div className="flex items-center justify-between mt-2">
                <span className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#f59e0b" }}></div>
                  Against/Skeptical
                </span>
                <span className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#0ea5e9" }}></div>
                  Supportive
                </span>
              </div>
            </div>
          </TabsContent>
          
          <div style={{ height: `${height}px`, position: "relative" }}>
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Loading geographic data...</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full p-4">
                <h3 className="text-center text-lg font-semibold mb-4">Ireland Political Data by Region</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow">
                  {/* Regional groups */}
                  {Object.keys(REGIONS).map(region => (
                    <div key={region} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <h4 className="text-center font-bold mb-3">{region}</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {getCountiesInRegion(region).map(county => {
                          const countyData = mapData.find(d => d.county === county);
                          if (!countyData) return null;
                          
                          return (
                            <div 
                              key={county}
                              className="flex flex-col items-center p-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                              onMouseEnter={() => setTooltipContent({
                                county,
                                text: getTooltipText(countyData)
                              })}
                              onMouseLeave={() => setTooltipContent(null)}
                            >
                              <div 
                                className="w-16 h-16 rounded-full flex items-center justify-center text-white mb-2"
                                style={{ backgroundColor: getColor(countyData) }}
                              >
                                {county.substring(0, 3)}
                              </div>
                              <span className="text-sm font-medium">{county}</span>
                              <span className="text-xs text-gray-500">
                                {activeTab === "economic" 
                                  ? `Eco: ${countyData.economicAvg.toFixed(1)}`
                                  : activeTab === "social"
                                    ? `Soc: ${countyData.socialAvg.toFixed(1)}`
                                    : `${selectedIssue.substring(0, 3)}: ${(countyData.countyViews[selectedIssue] || 0).toFixed(1)}`
                                }
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Tooltip */}
                {tooltipContent && (
                  <div className="fixed top-0 left-0 bg-white dark:bg-gray-800 shadow-md rounded-md p-3 border border-gray-200 dark:border-gray-700 z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full"
                    style={{
                      left: `calc(50% + ${Math.random() * 10 - 5}px)`,
                      top: `calc(50% + ${Math.random() * 10 - 15}px)`
                    }}
                  >
                    <div className="font-bold">{tooltipContent.county}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{tooltipContent.text}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Tabs>
        
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
          Data shows political opinions aggregated anonymously from user responses.
        </div>
      </CardContent>
    </Card>
  );
};

export default BasicIrelandMap;