import { useState, useEffect, useRef } from "react";
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

interface CountyMapProps {
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

// County positions based on actual map coordinates
const countyPositions: Record<string, {x: number, y: number}> = {
  "Dublin": {x: 350, y: 185},
  "Cork": {x: 200, y: 390},
  "Galway": {x: 150, y: 220},
  "Limerick": {x: 180, y: 315},
  "Donegal": {x: 140, y: 60},
  "Kerry": {x: 120, y: 370},
  "Wicklow": {x: 360, y: 220},
  "Wexford": {x: 335, y: 290},
  "Mayo": {x: 110, y: 170},
  "Kildare": {x: 320, y: 200}
};

const CountyMapOfIreland = ({
  height = 500
}: CountyMapProps) => {
  const [activeTab, setActiveTab] = useState<"economic" | "social" | "issues">("economic");
  const [selectedIssue, setSelectedIssue] = useState<string>("housing");
  const [tooltipContent, setTooltipContent] = useState<{county: string, text: string, x: number, y: number} | null>(null);
  const [mapData, setMapData] = useState<MapDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Zoom state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Refs for the container and map
  const containerRef = useRef<HTMLDivElement>(null);
  const mapAreaRef = useRef<HTMLDivElement>(null);

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
  
  // Handle mouse events for dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      const dx = (e.clientX - dragStart.x) / zoomLevel;
      const dy = (e.clientY - dragStart.y) / zoomLevel;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
      
      // Update tooltip position if it's showing
      if (tooltipContent) {
        setTooltipContent({
          ...tooltipContent,
          x: e.clientX,
          y: e.clientY - 10
        });
      }
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  useEffect(() => {
    const handleMouseUpOutside = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUpOutside);
    return () => window.removeEventListener('mouseup', handleMouseUpOutside);
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
  
  // Reset map view
  const resetMapView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    if (tooltipContent) {
      setTooltipContent(null);
    }
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
          
          <div 
            ref={containerRef} 
            style={{ 
              height: `${height}px`, 
              position: "relative", 
              overflow: "hidden",
              cursor: isDragging ? "grabbing" : "grab"
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Loading geographic data...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Zoom and Reset Controls */}
                <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2">
                  <button 
                    className="w-8 h-8 bg-white dark:bg-gray-700 rounded-full shadow-md flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomLevel(prev => Math.min(prev + 0.25, 2.5));
                    }}
                  >
                    <span className="text-xl font-bold">+</span>
                  </button>
                  <button 
                    className="w-8 h-8 bg-white dark:bg-gray-700 rounded-full shadow-md flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomLevel(prev => Math.max(prev - 0.25, 0.75));
                    }}
                  >
                    <span className="text-xl font-bold">−</span>
                  </button>
                  <button 
                    className="w-8 h-8 bg-white dark:bg-gray-700 rounded-full shadow-md flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetMapView();
                    }}
                  >
                    <span className="text-sm font-bold">↺</span>
                  </button>
                </div>
                
                {/* Map Container - An actual image of Ireland */}
                <div 
                  ref={mapAreaRef}
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                    transformOrigin: 'center',
                    transition: isDragging ? 'none' : 'transform 0.2s ease'
                  }}
                >
                  {/* Actual map of Ireland image */}
                  <div className="relative" style={{ width: '500px', height: '500px' }}>
                    <img 
                      src="https://raw.githubusercontent.com/deldersveld/topojson/master/countries/ireland/ireland.png" 
                      alt="Map of Ireland with counties"
                      className="w-full h-full object-contain"
                      style={{ opacity: 0.7 }}
                    />
                    {/* Dark outline of Ireland */}
                    <div
                      className="absolute inset-0 border-4 border-gray-700 dark:border-gray-300 rounded-lg"
                      style={{
                        maskImage: 'url(https://raw.githubusercontent.com/deldersveld/topojson/master/countries/ireland/ireland.png)',
                        maskSize: 'contain',
                        maskRepeat: 'no-repeat',
                        maskPosition: 'center',
                        WebkitMaskImage: 'url(https://raw.githubusercontent.com/deldersveld/topojson/master/countries/ireland/ireland.png)',
                        WebkitMaskSize: 'contain',
                        WebkitMaskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                      }}
                    />
                    
                    {/* County data points */}
                    {mapData.map((county) => {
                      const countyPos = countyPositions[county.county] || { x: 250, y: 250 };
                      return (
                        <div
                          key={county.county}
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 hover:z-10"
                          style={{
                            top: countyPos.y + 'px',
                            left: countyPos.x + 'px',
                          }}
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            // Convert to client coordinates for tooltip positioning
                            const rect = containerRef.current?.getBoundingClientRect();
                            if (rect) {
                              const clientX = rect.left + (countyPos.x * zoomLevel) + (panOffset.x * zoomLevel) + rect.width/2;
                              const clientY = rect.top + (countyPos.y * zoomLevel) + (panOffset.y * zoomLevel) + rect.height/2;
                              
                              setTooltipContent({
                                county: county.county,
                                text: getTooltipText(county),
                                x: clientX,
                                y: clientY - 20
                              });
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.stopPropagation();
                            setTooltipContent(null);
                          }}
                        >
                          <div 
                            className="rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110"
                            style={{ 
                              backgroundColor: getColor(county),
                              border: '2px solid white',
                              width: '24px',
                              height: '24px'
                            }}
                          />
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 text-xs font-medium text-black dark:text-white bg-white/70 dark:bg-black/70 px-1 rounded">
                            {county.county}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Fixed position tooltip - outside the transformed area */}
                {tooltipContent && (
                  <div 
                    className="fixed bg-white dark:bg-gray-800 shadow-md rounded-md p-3 border border-gray-200 dark:border-gray-700 z-50 pointer-events-none"
                    style={{
                      left: tooltipContent.x + 'px',
                      top: tooltipContent.y + 'px',
                      transform: 'translate(-50%, -100%)'
                    }}
                  >
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

export default CountyMapOfIreland;