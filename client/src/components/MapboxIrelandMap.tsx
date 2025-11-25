import { useRef, useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { scaleLinear } from "d3-scale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// NOTE: We're using the public Mapbox token which is fine for this demo
// For a production app, you would use a restricted token from environment variables
mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

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

interface MapboxIrelandMapProps {
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

const countyCoordinates: Record<string, [number, number]> = {
  "Dublin": [-6.2603, 53.3498],
  "Cork": [-8.4956, 51.8979],
  "Galway": [-9.0567, 53.2707],
  "Limerick": [-8.6267, 52.6633],
  "Donegal": [-7.7328, 54.9988],
  "Kerry": [-9.7026, 52.1543],
  "Wicklow": [-6.0499, 52.9808],
  "Wexford": [-6.4631, 52.3342],
  "Mayo": [-9.2156, 53.8852],
  "Kildare": [-6.8131, 53.1589]
};

const MapboxIrelandMap = ({
  height = 500
}: MapboxIrelandMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  
  const [activeTab, setActiveTab] = useState<"economic" | "social" | "issues">("economic");
  const [selectedIssue, setSelectedIssue] = useState<string>("housing");
  const [mapData, setMapData] = useState<MapDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapInitialized, setMapInitialized] = useState(false);
  
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
    let value = "";
    
    if (activeTab === "economic") {
      value = `Economic: ${county.economicAvg.toFixed(1)}`;
    } else if (activeTab === "social") {
      value = `Social: ${county.socialAvg.toFixed(1)}`;
    } else if (activeTab === "issues") {
      const issueValue = county.countyViews[selectedIssue] || 0;
      const issueLabel = POLITICAL_ISSUES.find(i => i.id === selectedIssue)?.label || selectedIssue;
      value = `${issueLabel}: ${issueValue.toFixed(1)}`;
    }
    
    return `<strong>${county.county}</strong><br>${value}<br>Sample: ${county.count} users`;
  };
  
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
  
  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-8.2, 53.4], // Center of Ireland
      zoom: 6,
      minZoom: 5,
      maxZoom: 15 // Allow deeper zoom levels for district-level detail
    });
    
    // Add navigation controls (zoom buttons)
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    popup.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '300px'
    });
    
    map.current.on('load', () => {
      // Add a source for Ireland counties
      map.current?.addSource('ireland-counties', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/deldersveld/topojson/master/countries/ireland/ireland-counties.json'
      });
      
      // Add Dublin electoral districts source (for detailed view)
      map.current?.addSource('dublin-districts', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/deldersveld/topojson/master/countries/ireland/dublin.json'
      });
      
      // Add a layer for county outlines
      map.current?.addLayer({
        id: 'county-boundaries',
        type: 'line',
        source: 'ireland-counties',
        paint: {
          'line-color': '#627BC1',
          'line-width': 1
        }
      });
      
      // Add a layer for county fills
      map.current?.addLayer({
        id: 'county-fills',
        type: 'fill',
        source: 'ireland-counties',
        paint: {
          'fill-color': 'rgba(200, 200, 200, 0.3)',
          'fill-outline-color': 'rgba(0, 0, 0, 0.1)'
        }
      });
      
      // Add Dublin electoral districts layer (hidden by default, shows on zoom)
      map.current?.addLayer({
        id: 'dublin-district-boundaries',
        type: 'line',
        source: 'dublin-districts',
        paint: {
          'line-color': '#d32f2f',
          'line-width': 1.5
        },
        layout: {
          'visibility': 'none' // Hidden by default
        }
      });
      
      // Add Dublin district fills
      map.current?.addLayer({
        id: 'dublin-district-fills',
        type: 'fill',
        source: 'dublin-districts',
        paint: {
          'fill-color': 'rgba(211, 47, 47, 0.1)',
          'fill-outline-color': 'rgba(211, 47, 47, 0.6)'
        },
        layout: {
          'visibility': 'none' // Hidden by default
        }
      });
      
      // Show Dublin districts when zoomed in enough
      if (map.current) {
        map.current.on('zoom', () => {
          if (map.current) {
            const currentZoom = map.current.getZoom();
            
            if (currentZoom > 9) {
              map.current.setLayoutProperty('dublin-district-boundaries', 'visibility', 'visible');
              map.current.setLayoutProperty('dublin-district-fills', 'visibility', 'visible');
            } else {
              map.current.setLayoutProperty('dublin-district-boundaries', 'visibility', 'none');
              map.current.setLayoutProperty('dublin-district-fills', 'visibility', 'none');
            }
          }
        });
      }
      
      setMapInitialized(true);
    });
    
    // Cleanup function
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);
  
  // Add/update markers when data changes or views change
  useEffect(() => {
    if (!map.current || !mapInitialized || isLoading || mapData.length === 0) return;
    
    // First, remove any existing markers
    const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
    existingMarkers.forEach(marker => marker.remove());
    
    // Add new markers
    mapData.forEach(county => {
      const coords = countyCoordinates[county.county];
      if (!coords) return;
      
      // Create a marker element
      const el = document.createElement('div');
      el.className = 'county-marker';
      el.style.backgroundColor = getColor(county);
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      
      // Create the marker
      const marker = new mapboxgl.Marker(el)
        .setLngLat(coords)
        .addTo(map.current!);
      
      // Add hover events
      el.addEventListener('mouseenter', () => {
        if (popup.current && map.current) {
          popup.current
            .setLngLat(coords)
            .setHTML(getTooltipText(county))
            .addTo(map.current);
        }
      });
      
      el.addEventListener('mouseleave', () => {
        if (popup.current) {
          popup.current.remove();
        }
      });
    });
  }, [mapData, mapInitialized, isLoading, activeTab, selectedIssue]);
  
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
          
          <div style={{ height: `${height}px`, position: "relative", marginTop: "1rem" }}>
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Loading geographic data...</p>
                </div>
              </div>
            ) : (
              <div 
                ref={mapContainer} 
                className="w-full h-full rounded-md overflow-hidden"
              />
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

export default MapboxIrelandMap;