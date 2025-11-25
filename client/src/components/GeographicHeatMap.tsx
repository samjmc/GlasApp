import { useState, useEffect, memo } from "react";
import { 
  ComposableMap, 
  Geographies, 
  Geography, 
  ZoomableGroup,
  Marker
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// US states GeoJSON data url
const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

// Types
interface MapDataPoint {
  state: string;
  economicAvg: number;
  socialAvg: number;
  count: number;
  stateCode: string;
  position: [number, number]; // [longitude, latitude]
}

interface ApiResponse {
  success: boolean;
  data: MapDataPoint[];
  message: string;
}

interface GeographicHeatMapProps {
  viewOnly?: boolean;
  height?: number;
}

const GeographicHeatMap = ({
  viewOnly = false,
  height = 400
}: GeographicHeatMapProps) => {
  const [activeTab, setActiveTab] = useState<"economic" | "social">("economic");
  const [tooltipContent, setTooltipContent] = useState("");
  const [tooltipPosition, setTooltipPosition] = useState<[number, number]>([0, 0]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [mapData, setMapData] = useState<MapDataPoint[]>(sampleData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch geographic data
  useEffect(() => {
    const fetchGeographicData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/geographic/states');
        const result: ApiResponse = await response.json();
        
        if (result.success && result.data) {
          setMapData(result.data);
        } else {
          setError(result.message || 'Failed to load geographic data');
        }
      } catch (err) {
        console.error("Error fetching geographic data:", err);
        setError('Failed to load geographic data. Using sample data instead.');
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

  // Get color based on value and active tab
  const getColor = (val: number) => {
    if (activeTab === "economic") {
      return economicColorScale(val);
    } else {
      return socialColorScale(val);
    }
  };

  // Get the data value for a state
  const getValueForState = (stateCode: string) => {
    const stateData = mapData.find((d: MapDataPoint) => d.stateCode === stateCode);
    if (!stateData) return null;
    return activeTab === "economic" ? stateData.economicAvg : stateData.socialAvg;
  };
  
  return (
    <Card className="bg-white dark:bg-gray-800 shadow-md overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">Political Geography</CardTitle>
          {!viewOnly && (
            <Badge variant="outline" className="ml-2">
              Beta
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="economic" className="w-full" onValueChange={(v) => setActiveTab(v as "economic" | "social")}>
          <TabsList className="mb-4">
            <TabsTrigger value="economic">Economic Views</TabsTrigger>
            <TabsTrigger value="social">Social Views</TabsTrigger>
          </TabsList>
          
          <TabsContent value="economic" className="mt-0">
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              This map shows the average economic positions across regions:
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
              This map shows the average social positions across regions:
              <div className="flex items-center justify-between mt-2">
                <span className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#10b981" }}></div>
                  Libertarian
                </span>
                <span className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#8b5cf6" }}></div>
                  Authoritarian
                </span>
              </div>
            </div>
          </TabsContent>
          
          <div style={{ height: `${height}px`, position: "relative" }}>
            {showTooltip && (
              <div 
                style={{
                  position: "absolute",
                  left: tooltipPosition[0] + "px",
                  top: tooltipPosition[1] + "px",
                  transform: "translate(-50%, -100%)",
                  backgroundColor: "white",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  pointerEvents: "none",
                  zIndex: 10,
                  fontSize: "12px"
                }}
              >
                {tooltipContent}
              </div>
            )}
            
            <ComposableMap 
              projection="geoAlbersUsa"
              projectionConfig={{ scale: 800 }}
              style={{ width: "100%", height: "100%" }}
            >
              <ZoomableGroup>
                {isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Loading geographic data...</p>
                    </div>
                  </div>
                ) : null}
                
                <Geographies geography={geoUrl}>
                  {({ geographies }) =>
                    geographies.map((geo: any) => {
                      const stateCode = geo.properties.postal;
                      const value = getValueForState(stateCode);
                      
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={value !== null ? getColor(value) : "#EEE"}
                          stroke="#FFF"
                          strokeWidth={0.5}
                          style={{
                            default: { outline: "none" },
                            hover: { outline: "none", fill: value !== null ? getColor(value) : "#EEE", opacity: 0.8 },
                            pressed: { outline: "none" }
                          }}
                          onMouseEnter={(evt: any) => {
                            const stateData = mapData.find((d: MapDataPoint) => d.stateCode === stateCode);
                            if (stateData) {
                              const { state, economicAvg, socialAvg, count } = stateData;
                              setTooltipContent(
                                `<strong>${state}</strong><br />
                                Economic: ${economicAvg.toFixed(1)}<br />
                                Social: ${socialAvg.toFixed(1)}<br />
                                Sample size: ${count} users`
                              );
                              setTooltipPosition([evt.clientX, evt.clientY - 10]);
                              setShowTooltip(true);
                            }
                          }}
                          onMouseLeave={() => {
                            setShowTooltip(false);
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
                
                {/* Render markers for states with data */}
                {!isLoading && mapData.map((point: MapDataPoint) => (
                  <Marker key={point.stateCode} coordinates={point.position}>
                    <circle 
                      r={Math.max(3, Math.min(8, Math.log(point.count) * 2))} 
                      fill="#FF5533" 
                      stroke="#FFFFFF" 
                      strokeWidth={0.5}
                    />
                  </Marker>
                ))}
              </ZoomableGroup>
            </ComposableMap>
          </div>
        </Tabs>
        
        {!viewOnly && (
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
            Note: This data is anonymized and aggregated from user quiz results. All individual data is kept private.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Sample data for development purposes
const sampleData: MapDataPoint[] = [
  { state: "California", stateCode: "CA", economicAvg: -3.2, socialAvg: -1.5, count: 420, position: [-119.4179, 36.7783] },
  { state: "Texas", stateCode: "TX", economicAvg: 4.8, socialAvg: 2.1, count: 380, position: [-99.9018, 31.9686] },
  { state: "New York", stateCode: "NY", economicAvg: -4.5, socialAvg: -0.8, count: 350, position: [-75.4652, 43.2994] },
  { state: "Florida", stateCode: "FL", economicAvg: 3.1, socialAvg: 1.2, count: 290, position: [-81.5158, 27.6648] },
  { state: "Illinois", stateCode: "IL", economicAvg: -2.1, socialAvg: -0.3, count: 210, position: [-88.9870, 40.0417] },
  { state: "Pennsylvania", stateCode: "PA", economicAvg: -0.8, socialAvg: 0.6, count: 180, position: [-77.1945, 41.2033] },
  { state: "Ohio", stateCode: "OH", economicAvg: 1.5, socialAvg: 1.9, count: 170, position: [-82.7755, 40.4173] },
  { state: "Virginia", stateCode: "VA", economicAvg: -0.3, socialAvg: 0.2, count: 150, position: [-78.6569, 37.4316] },
  { state: "Washington", stateCode: "WA", economicAvg: -3.9, socialAvg: -2.4, count: 140, position: [-120.7401, 47.7511] },
  { state: "Colorado", stateCode: "CO", economicAvg: -1.2, socialAvg: -2.8, count: 120, position: [-105.7821, 39.5501] },
  { state: "North Carolina", stateCode: "NC", economicAvg: 1.7, socialAvg: 1.5, count: 110, position: [-79.0193, 35.7596] },
  { state: "Georgia", stateCode: "GA", economicAvg: 2.8, socialAvg: 1.3, count: 100, position: [-83.6431, 32.1656] },
  { state: "Massachusetts", stateCode: "MA", economicAvg: -5.1, socialAvg: -1.9, count: 90, position: [-71.5800, 42.2373] },
  { state: "Arizona", stateCode: "AZ", economicAvg: 2.1, socialAvg: 0.3, count: 85, position: [-111.6602, 34.0489] },
  { state: "Oregon", stateCode: "OR", economicAvg: -4.2, socialAvg: -3.1, count: 75, position: [-120.5542, 43.8041] }
];

export default memo(GeographicHeatMap);