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

interface SimpleIrishCountiesGraphProps {
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

const SimpleIrishCountiesGraph = ({
  height = 500
}: SimpleIrishCountiesGraphProps) => {
  const [activeTab, setActiveTab] = useState<"economic" | "social" | "issues">("economic");
  const [selectedIssue, setSelectedIssue] = useState<string>("housing");
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null);
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
  
  // Get the value to display for a county based on active tab
  const getValueForCounty = (county: MapDataPoint) => {
    if (activeTab === "economic") {
      return county.economicAvg.toFixed(1);
    } else if (activeTab === "social") {
      return county.socialAvg.toFixed(1);
    } else if (activeTab === "issues") {
      return (county.countyViews[selectedIssue] || 0).toFixed(1);
    }
    return "0.0";
  };
  
  // Get label for current view
  const getCurrentLabel = () => {
    if (activeTab === "economic") {
      return "Economic";
    } else if (activeTab === "social") {
      return "Social";
    } else if (activeTab === "issues") {
      return POLITICAL_ISSUES.find(i => i.id === selectedIssue)?.label || selectedIssue;
    }
    return "";
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
              This visualization shows the average economic positions across Irish counties:
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
              This visualization shows the average social positions across Irish counties:
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
              This visualization shows positions on {POLITICAL_ISSUES.find(i => i.id === selectedIssue)?.label || selectedIssue}:
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
          
          <div style={{ minHeight: `${height}px` }} className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Loading county data...</p>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold mb-6 text-center">{getCurrentLabel()} Views by Irish County</h3>
                
                {/* County Grid Layout */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {mapData.map(county => (
                    <div 
                      key={county.county}
                      className={`p-4 rounded-lg transition-all cursor-pointer
                        ${selectedCounty === county.county ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      onClick={() => setSelectedCounty(selectedCounty === county.county ? null : county.county)}
                    >
                      <div className="flex flex-col items-center">
                        <div 
                          className="w-16 h-16 rounded-full mb-2 flex items-center justify-center"
                          style={{ backgroundColor: getColor(county) }}
                        >
                          <span className="text-white font-bold text-lg">{getValueForCounty(county)}</span>
                        </div>
                        <h4 className="font-medium text-center">{county.county}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                          {county.count} contributors
                        </p>
                      </div>
                      
                      {/* Expanded details when county is selected */}
                      {selectedCounty === county.county && (
                        <div className="mt-4 bg-gray-50 dark:bg-gray-700 p-3 rounded-md text-sm">
                          <h5 className="font-semibold mb-2">County Details:</h5>
                          <ul className="space-y-1">
                            <li className="flex justify-between">
                              <span>Economic:</span> 
                              <span className={county.economicAvg < 0 ? 'text-blue-500' : county.economicAvg > 0 ? 'text-red-500' : ''}>
                                {county.economicAvg.toFixed(1)}
                              </span>
                            </li>
                            <li className="flex justify-between">
                              <span>Social:</span> 
                              <span className={county.socialAvg < 0 ? 'text-green-500' : county.socialAvg > 0 ? 'text-purple-500' : ''}>
                                {county.socialAvg.toFixed(1)}
                              </span>
                            </li>
                            <li className="flex justify-between">
                              <span>Housing:</span> 
                              <span>{(county.countyViews.housing || 0).toFixed(1)}</span>
                            </li>
                            <li className="flex justify-between">
                              <span>Immigration:</span> 
                              <span>{(county.countyViews.immigration || 0).toFixed(1)}</span>
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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

export default SimpleIrishCountiesGraph;