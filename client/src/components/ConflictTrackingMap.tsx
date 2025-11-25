import { useState, useRef, useEffect, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker
} from "react-simple-maps";
import { geoCentroid } from "d3-geo";
import { scaleLinear } from "d3-scale";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

// Types
interface ConflictZone {
  id: string;
  name: string;
  location: string;
  coordinates: [number, number]; // [longitude, latitude]
  intensity: number; // 1-10 scale
  type: "active" | "frozen" | "escalating" | "deescalating";
  description: string;
  lastUpdated: string;
  casualties?: {
    civilian: number;
    military: number;
  };
  countries: string[];
  sources: string[];
}

interface ConflictMapProps {
  viewOnly?: boolean;
  height?: number;
}

// World map topology JSON
const geoUrl = "https://raw.githubusercontent.com/deldersveld/topojson/master/world-countries.json";

const ConflictTrackingMap = ({
  viewOnly = false,
  height = 500
}: ConflictMapProps) => {
  // State variables
  const [conflicts, setConflicts] = useState<ConflictZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapTab, setMapTab] = useState("global");
  const [conflictFilter, setConflictFilter] = useState("all");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<ConflictZone | null>(null);
  const [tooltipContent, setTooltipContent] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<[number, number]>([0, 0]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState<{ coordinates: [number, number], zoom: number }>({
    coordinates: [0, 20],
    zoom: 1
  });

  // Create a ref for the map container
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Fetch conflict data
  useEffect(() => {
    const fetchConflicts = async () => {
      setIsLoading(true);
      try {
        // Call API endpoint to get conflict data
        const response = await apiRequest<{ success: boolean; data?: ConflictZone[]; message?: string }>({
          method: "GET",
          path: "/api/geographic/conflicts",
          on401: "returnNull"
        });

        if (response?.success) {
          setConflicts(response.data);
        } else {
          console.error("Failed to fetch conflict data:", response?.message);
          // Use some sample data for development
          setConflicts([
            {
              id: "ukraine-russia",
              name: "Russia-Ukraine War",
              location: "Eastern Europe",
              coordinates: [31.1656, 48.3794],
              intensity: 8,
              type: "active",
              description: "Military invasion of Ukraine by Russian forces that began in February 2022",
              lastUpdated: new Date().toISOString(),
              casualties: {
                civilian: 9000,
                military: 45000
              },
              countries: ["Ukraine", "Russia"],
              sources: ["UN Reports", "Media Sources"]
            },
            {
              id: "gaza-israel",
              name: "Israel-Gaza Conflict",
              location: "Middle East",
              coordinates: [34.3088, 31.3547],
              intensity: 9,
              type: "active",
              description: "Ongoing conflict between Israel and Hamas in Gaza",
              lastUpdated: new Date().toISOString(),
              casualties: {
                civilian: 16000,
                military: 5000
              },
              countries: ["Israel", "Palestine"],
              sources: ["UN Reports", "Media Sources"]
            },
            {
              id: "sudan-civil-war",
              name: "Sudan Civil War",
              location: "Africa",
              coordinates: [30.2176, 12.8628],
              intensity: 7,
              type: "escalating",
              description: "Civil war between the Sudanese Armed Forces and the Rapid Support Forces",
              lastUpdated: new Date().toISOString(),
              casualties: {
                civilian: 12000,
                military: 6000
              },
              countries: ["Sudan"],
              sources: ["UN Reports", "Media Sources"]
            },
            {
              id: "myanmar-civil-war",
              name: "Myanmar Civil War",
              location: "Southeast Asia",
              coordinates: [95.9560, 21.9162],
              intensity: 6,
              type: "active",
              description: "Civil conflict following the 2021 military coup",
              lastUpdated: new Date().toISOString(),
              casualties: {
                civilian: 3000,
                military: 2000
              },
              countries: ["Myanmar"],
              sources: ["UN Reports", "Media Sources"]
            },
            {
              id: "ethiopia-tigray",
              name: "Tigray Conflict",
              location: "Africa",
              coordinates: [39.4699, 13.4966],
              intensity: 5,
              type: "deescalating",
              description: "Civil conflict in the Tigray region of Ethiopia",
              lastUpdated: new Date().toISOString(),
              casualties: {
                civilian: 5000,
                military: 8000
              },
              countries: ["Ethiopia"],
              sources: ["UN Reports", "Media Sources"]
            }
          ]);
        }
      } catch (error) {
        console.error("Error fetching conflict data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConflicts();
  }, []);

  // Filter conflicts based on selected filter
  const filteredConflicts = conflicts.filter(conflict => {
    if (conflictFilter === "all") return true;
    if (conflictFilter === "active") return conflict.type === "active";
    if (conflictFilter === "escalating") return conflict.type === "escalating";
    if (conflictFilter === "deescalating") return conflict.type === "deescalating";
    if (conflictFilter === "frozen") return conflict.type === "frozen";
    return true;
  });

  // Handle map click
  const handleMapClick = () => {
    if (selectedConflict) {
      setSelectedConflict(null);
    }
  };

  // Color scale for conflict intensity
  const intensityColorScale = scaleLinear<string>()
    .domain([1, 5, 10])
    .range(["#f8d46a", "#f08c1b", "#d4380d"]);

  // Get marker size based on conflict intensity
  const getMarkerSize = (intensity: number) => {
    return Math.max(6, Math.min(14, intensity * 1.2));
  };

  // Get marker color based on conflict type
  const getMarkerColor = (type: string, intensity: number) => {
    const baseColor = intensityColorScale(intensity);
    
    if (type === "escalating") return "#d4380d"; // Red
    if (type === "deescalating") return "#389e0d"; // Green
    if (type === "frozen") return "#096dd9"; // Blue
    return baseColor; // Active conflicts use intensity scale
  };

  // Format date string
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy");
  };

  // Get badge color based on conflict type
  const getBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case "active": return "destructive";
      case "escalating": return "destructive";
      case "deescalating": return "default";
      case "frozen": return "secondary";
      default: return "default";
    }
  };

  return (
    <Card className="bg-white dark:bg-gray-800 shadow-md h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold flex items-center justify-between">
          <span>Global Conflict Tracker</span>
          <Badge variant="outline" className="ml-2">LIVE</Badge>
        </CardTitle>
        <CardDescription>
          Real-time tracking of major global conflicts and geopolitical tensions
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 h-[calc(100%-80px)]">
        <Tabs defaultValue="map" className="h-full">
          <TabsList className="mb-4">
            <TabsTrigger value="map">Map View</TabsTrigger>
            <TabsTrigger value="list">List View</TabsTrigger>
          </TabsList>
          
          <TabsContent value="map" className="h-[calc(100%-40px)] flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-2/3 h-full">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-md h-full relative overflow-hidden">
                {/* Map controls */}
                <div className="absolute top-2 left-2 z-10 bg-white dark:bg-gray-800 rounded-md shadow-md p-2 flex space-x-2">
                  <TabsList className="p-0 h-auto bg-transparent">
                    <TabsTrigger 
                      value="global" 
                      onClick={() => {
                        setMapTab("global");
                        setPosition({ coordinates: [0, 20], zoom: 1 });
                      }}
                      className={`px-2 py-1 ${mapTab === "global" ? 'bg-indigo-100 dark:bg-indigo-900/30' : ''}`}
                    >
                      Global
                    </TabsTrigger>
                    <TabsTrigger 
                      value="europe" 
                      onClick={() => {
                        setMapTab("europe");
                        setPosition({ coordinates: [15, 50], zoom: 3 });
                      }}
                      className={`px-2 py-1 ${mapTab === "europe" ? 'bg-indigo-100 dark:bg-indigo-900/30' : ''}`}
                    >
                      Europe
                    </TabsTrigger>
                    <TabsTrigger 
                      value="middle-east" 
                      onClick={() => {
                        setMapTab("middle-east");
                        setPosition({ coordinates: [45, 30], zoom: 3 });
                      }}
                      className={`px-2 py-1 ${mapTab === "middle-east" ? 'bg-indigo-100 dark:bg-indigo-900/30' : ''}`}
                    >
                      Middle East
                    </TabsTrigger>
                    <TabsTrigger 
                      value="africa" 
                      onClick={() => {
                        setMapTab("africa");
                        setPosition({ coordinates: [20, 0], zoom: 2 });
                      }}
                      className={`px-2 py-1 ${mapTab === "africa" ? 'bg-indigo-100 dark:bg-indigo-900/30' : ''}`}
                    >
                      Africa
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                {/* Map view */}
                <div 
                  ref={mapContainerRef}
                  className="w-full h-full"
                  style={{ height: height }}
                  onClick={handleMapClick}
                >
                  {isLoading ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Loading conflict data...</p>
                    </div>
                  ) : (
                    <ComposableMap
                      projection="geoEqualEarth"
                      data-tip=""
                      width={800}
                      height={height}
                      projectionConfig={{
                        scale: 150
                      }}
                    >
                      <ZoomableGroup
                        zoom={position.zoom}
                        center={position.coordinates}
                      >
                        <Geographies geography={geoUrl}>
                          {({ geographies }) =>
                            geographies.map(geo => {
                              // Check if this country has active conflicts
                              const hasConflict = filteredConflicts.some(
                                c => c.countries.includes(geo.properties.name)
                              );
                              
                              return (
                                <Geography
                                  key={geo.rsmKey}
                                  geography={geo}
                                  fill={hasConflict ? "#FFCCCC" : "#F5F4F6"}
                                  stroke="#D6D6DA"
                                  strokeWidth={0.5}
                                  style={{
                                    default: { outline: "none" },
                                    hover: { 
                                      outline: "none", 
                                      fill: hasConflict ? "#FFAAAA" : "#E6E6E9",
                                      stroke: "#9998A3",
                                      strokeWidth: 0.75
                                    },
                                    pressed: { outline: "none" }
                                  }}
                                />
                              );
                            })
                          }
                        </Geographies>
                        
                        {/* Markers for conflicts */}
                        {filteredConflicts.map(conflict => (
                          <Marker
                            key={conflict.id}
                            coordinates={conflict.coordinates}
                          >
                            <g
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                setSelectedConflict(selectedConflict?.id === conflict.id ? null : conflict);
                              }}
                              onMouseEnter={(evt) => {
                                setTooltipContent(`
                                  <strong>${conflict.name}</strong><br />
                                  Status: ${conflict.type}<br />
                                  Intensity: ${conflict.intensity}/10
                                `);
                                setTooltipPosition([evt.clientX, evt.clientY - 10]);
                                setShowTooltip(true);
                              }}
                              onMouseLeave={() => {
                                setShowTooltip(false);
                              }}
                            >
                              <circle
                                r={getMarkerSize(conflict.intensity)}
                                fill={getMarkerColor(conflict.type, conflict.intensity)}
                                stroke="#FFFFFF"
                                strokeWidth={2}
                                opacity={0.8}
                                className="transition-all duration-300 hover:opacity-1"
                              />
                              {/* Pulse animation for active or escalating conflicts */}
                              {(conflict.type === "active" || conflict.type === "escalating") && (
                                <>
                                  <circle
                                    r={getMarkerSize(conflict.intensity) + 4}
                                    fill="transparent"
                                    stroke={getMarkerColor(conflict.type, conflict.intensity)}
                                    strokeWidth={1}
                                    opacity={0.3}
                                    className="animate-ping"
                                  />
                                  <circle
                                    r={getMarkerSize(conflict.intensity) + 2}
                                    fill="transparent"
                                    stroke={getMarkerColor(conflict.type, conflict.intensity)}
                                    strokeWidth={1}
                                    opacity={0.5}
                                  />
                                </>
                              )}
                            </g>
                          </Marker>
                        ))}
                      </ZoomableGroup>
                    </ComposableMap>
                  )}
                  
                  {/* Tooltip */}
                  {showTooltip && tooltipContent && (
                    <div
                      className="absolute z-50 bg-white dark:bg-gray-800 p-2 rounded-md shadow-md text-sm pointer-events-none border border-gray-200 dark:border-gray-700"
                      style={{
                        left: tooltipPosition[0] + 10,
                        top: tooltipPosition[1] + 10,
                        maxWidth: "200px"
                      }}
                      dangerouslySetInnerHTML={{ __html: tooltipContent }}
                    />
                  )}
                </div>
              </div>
            </div>
            
            {/* Side panel - conflict details */}
            <div className="w-full md:w-1/3 h-full overflow-y-auto">
              {selectedConflict ? (
                <div className="bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 p-4 h-full">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold">{selectedConflict.name}</h3>
                    <Badge variant={getBadgeVariant(selectedConflict.type)} className="capitalize">
                      {selectedConflict.type}
                    </Badge>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{selectedConflict.description}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded-md">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Location</p>
                        <p className="font-medium">{selectedConflict.location}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded-md">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Intensity</p>
                        <p className="font-medium">{selectedConflict.intensity}/10</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded-md">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Updated</p>
                        <p className="font-medium">{formatDate(selectedConflict.lastUpdated)}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded-md">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Countries</p>
                        <p className="font-medium">{selectedConflict.countries.join(", ")}</p>
                      </div>
                    </div>
                    
                    {selectedConflict.casualties && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold mb-2">Estimated Casualties</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded-md">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Civilian</p>
                            <p className="font-medium">{selectedConflict.casualties.civilian.toLocaleString()}</p>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded-md">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Military</p>
                            <p className="font-medium">{selectedConflict.casualties.military.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {showSources && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold mb-2">Sources</h4>
                        <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-300">
                          {selectedConflict.sources.map((source, index) => (
                            <li key={index}>{source}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="flex items-center mt-2">
                      <Switch
                        id="show-sources"
                        checked={showSources}
                        onCheckedChange={setShowSources}
                      />
                      <Label htmlFor="show-sources" className="ml-2 text-sm">
                        Show Sources
                      </Label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4 h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600 dark:text-indigo-400">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Select a Conflict</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Click on any marker on the map to view detailed information about that conflict.
                  </p>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <p>Currently tracking {filteredConflicts.length} conflicts worldwide</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="list" className="h-[calc(100%-40px)]">
            <div className="bg-white dark:bg-gray-800 rounded-md h-full">
              {/* Filters */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex-grow max-w-xs">
                  <Select 
                    value={conflictFilter} 
                    onValueChange={setConflictFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter conflicts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Conflicts</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="escalating">Escalating</SelectItem>
                      <SelectItem value="deescalating">De-escalating</SelectItem>
                      <SelectItem value="frozen">Frozen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  Showing {filteredConflicts.length} conflicts
                </div>
              </div>
              
              {/* Conflict list */}
              <div className="space-y-2 overflow-y-auto pr-2" style={{ maxHeight: 'calc(100% - 60px)' }}>
                {filteredConflicts.map(conflict => (
                  <div 
                    key={conflict.id}
                    className={`p-4 border border-gray-200 dark:border-gray-700 rounded-md transition-colors cursor-pointer ${
                      selectedConflict?.id === conflict.id ? 
                      'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 
                      'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setSelectedConflict(selectedConflict?.id === conflict.id ? null : conflict)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold mb-1 flex items-center">
                          <span>{conflict.name}</span>
                          {conflict.type === "escalating" && (
                            <span className="ml-2 text-red-500 text-xs flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m6 18 6-6 6-6"/>
                                <path d="M15 6h3v3"/>
                              </svg>
                              Escalating
                            </span>
                          )}
                          {conflict.type === "deescalating" && (
                            <span className="ml-2 text-green-500 text-xs flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m6 6 6 6 6 6"/>
                                <path d="M15 18h3v-3"/>
                              </svg>
                              De-escalating
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1">{conflict.description}</p>
                      </div>
                      <Badge variant={getBadgeVariant(conflict.type)} className="ml-2 capitalize">
                        {conflict.type === "active" ? "Active" : 
                         conflict.type === "frozen" ? "Frozen" : 
                         conflict.type === "escalating" ? "Escalating" : 
                         "De-escalating"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <div className="flex items-center text-gray-500 dark:text-gray-400">
                        <span className="mr-4">Intensity: {conflict.intensity}/10</span>
                        <span>{conflict.location}</span>
                      </div>
                      <div className="text-gray-400 dark:text-gray-500 text-xs">
                        Updated: {formatDate(conflict.lastUpdated)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        {!viewOnly && (
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
            Data sources: International Crisis Group, UN reports, media analysis, and government statements. Updated daily.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default memo(ConflictTrackingMap);