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
  position: [number, number]; // [longitude, latitude]
}

interface ApiResponse {
  success: boolean;
  data: MapDataPoint[];
  message: string;
}

interface IrelandMapProps {
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

const SimpleIrelandMap = ({
  height = 500
}: IrelandMapProps) => {
  const [activeTab, setActiveTab] = useState<"economic" | "social" | "issues">("economic");
  const [selectedIssue, setSelectedIssue] = useState<string>("housing");
  const [tooltipContent, setTooltipContent] = useState<{county: string, text: string} | null>(null);
  const [mapData, setMapData] = useState<MapDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [mapPosition, setMapPosition] = useState({ x: 0, y: 0 });
  
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
  
  // Positioning data for counties
  const countyPositions: {[key: string]: {top: string, left: string}} = {
    "Dublin": {top: "38%", left: "75%"},
    "Cork": {top: "78%", left: "35%"},
    "Galway": {top: "50%", left: "25%"},
    "Limerick": {top: "65%", left: "35%"},
    "Donegal": {top: "15%", left: "30%"},
    "Kerry": {top: "80%", left: "20%"},
    "Wicklow": {top: "45%", left: "75%"},
    "Wexford": {top: "60%", left: "70%"},
    "Mayo": {top: "35%", left: "15%"},
    "Kildare": {top: "45%", left: "65%"}
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
              <>
                {/* Ireland map visualization with zoom controls */}
                <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                  {/* Zoom controls */}
                  <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2">
                    <button 
                      className="w-8 h-8 bg-white dark:bg-gray-800 rounded-full shadow-md flex items-center justify-center"
                      onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 2.5))}
                    >
                      <span className="text-xl font-bold">+</span>
                    </button>
                    <button 
                      className="w-8 h-8 bg-white dark:bg-gray-800 rounded-full shadow-md flex items-center justify-center"
                      onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.75))}
                    >
                      <span className="text-xl font-bold">-</span>
                    </button>
                    <button 
                      className="w-8 h-8 bg-white dark:bg-gray-800 rounded-full shadow-md flex items-center justify-center"
                      onClick={() => { setZoomLevel(1); setMapPosition({ x: 0, y: 0 }); }}
                    >
                      <span className="text-sm font-bold">↺</span>
                    </button>
                  </div>
                  
                  {/* Map content with transform for zoom/pan */}
                  <div 
                    className="w-full h-full relative"
                    style={{
                      transform: `scale(${zoomLevel}) translate(${mapPosition.x}px, ${mapPosition.y}px)`,
                      transformOrigin: 'center',
                      transition: 'transform 0.3s ease'
                    }}
                    onMouseDown={(e) => {
                      // Enable dragging if desired
                      // This would require more complex state management
                    }}
                  >
                    {/* Draw accurate outline for Ireland */}
                    <svg viewBox="0 0 100 160" className="w-full h-full opacity-30">
                      <path 
                        d="M51.5,21.1 C50.7,22.3 49.4,23.6 48.4,24.4 C47.4,25.2 45.1,28.6 43.2,31.9 C41.3,35.2 38.7,39.1 37.3,40.4 C36,41.7 34.3,44.1 33.6,45.7 C32.9,47.3 31.8,48.7 31.3,48.7 C30.8,48.7 30.4,49.1 30.4,49.5 C30.4,49.9 29.5,52.1 28.4,54.4 C27.3,56.7 26.4,59.2 26.4,60.1 C26.4,60.9 25.9,62.1 25.3,62.8 C24.7,63.4 24.2,64.6 24.2,65.3 C24.2,66 23.9,67.2 23.5,67.9 C22.7,69.4 22.8,73.9 23.6,74.7 C23.8,75 24,76.3 24,77.6 C24,78.9 24.4,80.7 24.9,81.5 C25.4,82.3 26.1,83.7 26.4,84.5 C26.8,85.3 27.6,86.5 28.2,87 C28.9,87.5 29.4,88.4 29.4,89 C29.4,89.6 29.9,90.4 30.5,90.8 C31.2,91.2 31.9,92 32.1,92.6 C32.3,93.2 33.4,94.6 34.5,95.6 C35.6,96.7 36.7,98.1 37,98.7 C37.2,99.3 38.2,100.6 39.1,101.5 C40,102.4 41.3,103.9 41.9,104.8 C42.5,105.7 43.4,106.7 43.9,107.1 C44.3,107.5 44.9,108.5 45.1,109.4 C45.3,110.3 46.1,111.7 46.9,112.6 C48.4,114.4 52.4,118.6 53.4,119.1 C53.8,119.3 54.7,120.2 55.4,121.1 C56.1,122 57.3,123.1 58.1,123.6 C58.9,124.1 60.2,125.4 61,126.5 C61.8,127.6 62.9,128.5 63.5,128.5 C64,128.5 64.5,128.9 64.5,129.5 C64.5,130.1 65.1,130.9 65.8,131.3 C66.5,131.8 67.3,132.6 67.6,133.1 C68.6,134.7 71.2,136.5 72.7,136.5 C73.6,136.5 74.9,137 75.6,137.6 C76.3,138.2 77.5,138.9 78.3,139.2 C79.1,139.5 80.2,140.3 80.8,141 C81.4,141.7 82.3,142.2 82.7,142.2 C83.1,142.2 84.1,142.8 84.9,143.5 C85.6,144.2 86.9,145 87.7,145.2 C88.5,145.5 89.9,146.3 90.8,147 C91.7,147.7 92.6,148.2 92.8,148.2 C93.1,148.2 93.9,148.8 94.6,149.5 C95.4,150.3 96.3,150.8 96.9,150.8 C97.4,150.8 98.3,151.3 98.8,151.9 C99.8,153 100.7,153.1 101.8,152.2 C102.4,151.7 103.3,151.5 103.8,151.7 C104.4,151.9 105.5,151.5 106.3,150.8 C107.1,150.1 108,149.5 108.3,149.5 C108.6,149.5 109.9,148.8 111.1,148 C112.3,147.2 114.1,146.1 115,145.5 C116,144.9 117,144.4 117.3,144.4 C118.7,144.4 123.5,141.9 123.5,141.2 C123.5,140.8 124,140.5 124.5,140.5 C125,140.5 126.2,139.8 127.2,139 C128.1,138.1 129.7,137.2 130.6,136.9 C131.5,136.5 132.9,135.5 133.6,134.5 C134.4,133.5 135.2,132.7 135.6,132.7 C136,132.7 137,131.9 137.8,131 C138.6,130 139.7,129 140.2,128.8 C141.2,128.3 143.6,125.2 143.6,124.1 C143.6,123.6 144.1,122.8 144.8,122.2 C145.4,121.7 146.4,120.4 146.9,119.4 C147.5,118.4 148.3,117.6 148.8,117.6 C149.2,117.6 149.6,117.2 149.6,116.8 C149.6,116.4 150.1,115.4 150.6,114.5 C151.2,113.7 151.9,112.2 152.2,111.2 C152.6,110.2 153.1,109.4 153.3,109.4 C153.5,109.4 153.8,108.7 153.8,107.8 C153.8,106.9 154.4,105.5 155.1,104.7 C155.9,103.9 156.3,103 156.2,102.5 C156,102.1 156.3,101 156.9,100.1 C157.5,99.2 158.1,97.9 158.3,97.3 C158.5,96.6 159.1,95.3 159.6,94.4 C160.1,93.4 160.6,92 160.7,91.1 C160.8,90.3 161.2,89.4 161.6,89.1 C162.4,88.5 162.6,82.9 161.9,82.1 C161.7,81.9 161.5,80.6 161.5,79.3 C161.5,78 161.2,76.5 160.8,75.9 C160.5,75.4 160.1,73.9 160,72.6 C159.9,71.3 159.5,69.7 159.1,69.1 C158.7,68.4 158.4,67.2 158.4,66.3 C158.4,65.4 158,64.1 157.5,63.4 C157,62.6 156.4,61.3 156.2,60.3 C156,59.3 155.4,58.1 154.9,57.4 C154.3,56.7 153.8,55.5 153.8,54.7 C153.8,53.9 153.2,52.6 152.5,51.8 C151.8,51 151,49.6 150.8,48.7 C150.5,47.7 149.7,46.4 149,45.7 C148.3,45 147.6,44 147.4,43.4 C147.2,42.8 146.4,41.5 145.6,40.6 C144.9,39.6 144.1,38.2 143.8,37.5 C143.5,36.8 142.7,35.7 142.1,35.1 C141.4,34.5 140.8,33.8 140.8,33.5 C140.8,33.2 140.2,32.4 139.5,31.8 C138.8,31.2 137.6,30.1 136.9,29.3 C136.1,28.5 135.3,27.8 135,27.8 C134.7,27.8 133.6,26.9 132.6,25.9 C131.6,24.9 130.5,24 130,24 C129.6,24 128.8,23.5 128.2,22.9 C126.8,21.4 124.5,20.1 122.3,19.5 C121.3,19.2 119.6,18.4 118.5,17.7 C117.4,17 116,16.5 115.3,16.5 C114.6,16.5 113.7,16.1 113.3,15.7 C112.9,15.2 111.7,14.8 110.6,14.8 C109.5,14.8 108.4,14.5 107.9,14.2 C107.5,13.9 106.1,13.5 104.8,13.3 C103.5,13 101.8,12.8 101,12.8 C100.2,12.8 99,12.5 98.4,12.1 C97.8,11.7 96.8,11.4 96.3,11.4 C95.7,11.4 94.9,10.9 94.5,10.4 C93.5,9 91.9,9 90.9,10.4 C90.5,10.9 89.7,11.4 89.1,11.4 C88.6,11.4 87.6,11.7 86.9,12.1 C86.3,12.5 85.1,12.8 84.3,12.8 C83.5,12.8 81.8,13 80.5,13.3 C79.2,13.5 77.8,13.9 77.4,14.2 C76.9,14.5 75.8,14.8 74.7,14.8 C73.6,14.8 72.4,15.2 72,15.7 C71.6,16.1 70.7,16.5 70,16.5 C69.3,16.5 67.9,17 66.8,17.7 C65.7,18.4 64,19.2 63,19.5 C62,19.9 60.5,20.5 59.6,21 C58.7,21.5 57.7,21.8 57.2,21.8 C56.7,21.8 55.9,22.2 55.4,22.7 C54.9,23.3 53.6,24.1 52.5,24.6 L50.5,25.5 L51.5,21.1 Z" 
                        fill="#f0f4f8" 
                        stroke="#333"
                        strokeWidth="1"
                      />
                    </svg>
                  </div>
                </div>
                
                {/* County data points */}
                <div className="relative w-full h-full">
                  {mapData.map((county) => (
                    <div
                      key={county.county}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 hover:z-10"
                      style={{
                        top: countyPositions[county.county]?.top || "50%",
                        left: countyPositions[county.county]?.left || "50%"
                      }}
                      onMouseEnter={() => setTooltipContent({
                        county: county.county,
                        text: getTooltipText(county)
                      })}
                      onMouseLeave={() => setTooltipContent(null)}
                    >
                      <div 
                        className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center transform transition-transform hover:scale-110"
                        style={{ 
                          backgroundColor: getColor(county),
                          border: '3px solid white'
                        }}
                      >
                        <span className="text-sm font-bold text-white">
                          {county.county.substring(0, 2)}
                        </span>
                      </div>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 text-xs font-medium">
                        {county.county}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Tooltip */}
                {tooltipContent && (
                  <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 shadow-md rounded-md p-3 border border-gray-200 dark:border-gray-700">
                    <div className="font-bold">{tooltipContent.county}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{tooltipContent.text}</div>
                  </div>
                )}
              </>
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

export default SimpleIrelandMap;