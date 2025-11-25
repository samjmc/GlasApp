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

interface ZoomableIrelandMapProps {
  height?: number;
}

// Improved Irish counties with accurate relative positions
const countyPositions: Record<string, [number, number]> = {
  "Dublin": [78, 53],
  "Wicklow": [76, 62],
  "Wexford": [71, 75],
  "Carlow": [65, 70],
  "Kildare": [67, 58],
  "Meath": [68, 48],
  "Louth": [72, 41],
  "Monaghan": [64, 34],
  "Cavan": [58, 38],
  "Longford": [52, 45],
  "Westmeath": [58, 50],
  "Offaly": [58, 58],
  "Laois": [62, 65],
  "Kilkenny": [62, 75],
  "Tipperary": [55, 70],
  "Waterford": [60, 82],
  "Cork": [45, 82],
  "Kerry": [32, 75],
  "Limerick": [45, 70],
  "Clare": [40, 60],
  "Galway": [35, 52],
  "Mayo": [25, 42],
  "Roscommon": [43, 48],
  "Sligo": [35, 35],
  "Leitrim": [45, 35],
  "Donegal": [30, 20]
};

// Dublin electoral districts with accurate positions
const dublinDistricts: Record<string, [number, number]> = {
  "Dublin City Centre": [76.5, 52.5],
  "Dublin North Central": [77, 50],
  "Dublin North West": [74, 49],
  "Dublin South Central": [75, 54],
  "Dublin South East": [78, 53],
  "Dublin South West": [73, 56],
  "Dún Laoghaire": [79, 55],
  "Dublin West": [71, 52],
  "Dublin Mid-West": [72, 55],
  "Dublin North East": [78, 48],
  "Fingal East": [75, 47],
  "Fingal West": [72, 46],
  "Rathdown": [77, 57],
  "Dublin Bay North": [80, 51],
  "Dublin Bay South": [77, 54]
};

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

const ZoomableIrelandMap = ({
  height = 500
}: ZoomableIrelandMapProps) => {
  const [activeTab, setActiveTab] = useState<"economic" | "social" | "issues">("economic");
  const [selectedIssue, setSelectedIssue] = useState<string>("housing");
  const [mapData, setMapData] = useState<MapDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<"country" | "dublin">("country");
  const [zoomScale, setZoomScale] = useState(1); // Controls the zoom level
  const [panOffset, setPanOffset] = useState<[number, number]>([0, 0]); // For panning the map
  const [tooltipInfo, setTooltipInfo] = useState<{
    visible: boolean;
    x: number;
    y: number;
    content: string;
  }>({ visible: false, x: 0, y: 0, content: "" });
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
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
  const getColor = (countyName: string) => {
    const county = mapData.find(item => item.county === countyName);
    if (!county) return "#94a3b8"; // Default gray
    
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
  
  // Generate tooltip text for a county
  const getTooltipText = (countyName: string) => {
    const county = mapData.find(item => item.county === countyName);
    if (!county) return "";
    
    let valueText = "";
    let valueLabel = "";
    
    if (activeTab === "economic") {
      valueText = county.economicAvg.toFixed(1);
      valueLabel = "Economic";
    } else if (activeTab === "social") {
      valueText = county.socialAvg.toFixed(1);
      valueLabel = "Social";
    } else if (activeTab === "issues") {
      valueText = (county.countyViews[selectedIssue] || 0).toFixed(1);
      valueLabel = POLITICAL_ISSUES.find(i => i.id === selectedIssue)?.label || selectedIssue;
    }
    
    return `<strong>${county.county}</strong><br>${valueLabel}: ${valueText}<br>${county.count} contributors`;
  };
  
  // Handle showing tooltip
  const handleMouseOver = (countyName: string, x: number, y: number) => {
    const tooltipText = getTooltipText(countyName);
    setTooltipInfo({
      visible: true,
      x,
      y,
      content: tooltipText
    });
  };
  
  const handleMouseOut = () => {
    setTooltipInfo({ ...tooltipInfo, visible: false });
  };
  
  // Zoom controls
  const zoomIn = () => {
    setZoomScale(prev => Math.min(prev + 0.2, 2.5));
  };
  
  const zoomOut = () => {
    setZoomScale(prev => Math.max(prev - 0.2, 0.8));
  };
  
  const resetZoom = () => {
    setZoomScale(1);
    setPanOffset([0, 0]);
  };
  
  // Pan controls
  const handlePan = (direction: 'up' | 'down' | 'left' | 'right') => {
    const step = 5;
    setPanOffset(prev => {
      const [x, y] = prev;
      switch (direction) {
        case 'up': return [x, y - step];
        case 'down': return [x, y + step];
        case 'left': return [x - step, y];
        case 'right': return [x + step, y];
        default: return prev;
      }
    });
  };
  
  // Handle county click - zoom in to Dublin
  const handleCountyClick = (countyName: string) => {
    setSelectedCounty(countyName);
    if (countyName === "Dublin") {
      setZoomLevel("dublin");
      setZoomScale(1); // Reset zoom when switching to Dublin view
      setPanOffset([0, 0]); // Reset pan when switching to Dublin view
    }
  };
  
  // Zoom back to country view
  const handleZoomOut = () => {
    setSelectedCounty(null);
    setZoomLevel("country");
    setZoomScale(1); // Reset zoom when returning to country view
    setPanOffset([0, 0]); // Reset pan when returning to country view
  };
  
  const renderIrelandMap = () => {
    return (
      <div className="relative" style={{ height: `${height}px`, overflow: "hidden" }}>
        {/* Zoom controls */}
        <div className="absolute top-2 right-2 z-10 bg-white dark:bg-gray-800 rounded-md shadow-md flex flex-col">
          <button 
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700"
            onClick={zoomIn}
            title="Zoom In"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          <button 
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700"
            onClick={zoomOut}
            title="Zoom Out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
            </svg>
          </button>
          <button 
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            onClick={resetZoom}
            title="Reset View"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
            </svg>
          </button>
        </div>
        
        {/* Navigation controls */}
        <div className="absolute bottom-2 right-2 z-10 grid grid-cols-3 gap-1 bg-white dark:bg-gray-800 p-1 rounded-md shadow-md">
          <button onClick={() => handlePan('left')} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={() => handlePan('up')} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button onClick={() => handlePan('right')} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="w-4"></div>
          <button onClick={() => handlePan('down')} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className="w-4"></div>
        </div>
        
        <svg 
          width="100%" 
          height="100%" 
          viewBox="0 0 100 100" 
          preserveAspectRatio="xMidYMid meet"
          style={{
            transform: `scale(${zoomScale}) translate(${panOffset[0]}px, ${panOffset[1]}px)`,
            transformOrigin: 'center',
            transition: 'transform 0.2s ease'
          }}
        >
          {/* Accurate shape of Ireland */}
          <path
            d="M32.1,20.5 L30.5,20.7 L29.2,21.7 L28.5,24 L28.3,25.8 L27.5,27.4 L26.2,29.8 L26.3,31.1 L24.7,33.4 L24.2,35.6 L23.1,37.6 L22.4,40.1 L21.2,42 L20.8,43.5 L20.7,45.4 L21.5,47.3 L21.9,49.1 L22.3,50.9 L23.2,52.3 L24.4,53.8 L25.3,55.7 L26.2,57.1 L27.6,57.9 L28.7,59.4 L29.6,61.3 L31.1,62.7 L32.4,63.9 L33.7,65 L34.9,66.4 L36.3,67.5 L37.8,68.2 L39.2,69.4 L40.5,70.8 L41.9,72.1 L43.3,73.2 L44.5,74.5 L45.8,75.9 L47.3,77.1 L48.9,78 L50.7,78.7 L52.6,79.4 L54.4,79.8 L56.1,80 L58,79.6 L59.7,78.9 L61.3,78 L62.8,76.9 L64.1,75.6 L65.4,74.3 L66.7,72.9 L67.9,71.4 L69.3,69.7 L70.5,68.1 L71.5,66.3 L72.4,64.6 L73.2,62.9 L74,61 L74.7,59.2 L75.3,57.2 L75.8,55.2 L76.1,53.2 L76.2,51.2 L76.1,49.1 L75.6,47.2 L75,45.5 L74.2,43.6 L73.3,41.8 L72.3,40.2 L71.1,38.5 L69.9,37 L68.5,35.6 L67.1,34.1 L65.6,32.9 L63.9,31.6 L62.2,30.4 L60.4,29.4 L58.5,28.4 L56.6,27.5 L54.6,26.8 L52.6,26.1 L50.6,25.6 L48.5,25.1 L46.4,24.7 L44.3,24.4 L42.3,24.2 L40.2,24.1 L38.1,24.1 L36.1,24.3 L34.2,24.5 L32.8,25.1 L31.5,25.8 L30.6,27 L29.6,28.2 L30.3,25.7 L30.9,24.1 L31.5,22.5 L32.1,20.5 Z M31.9,29.1 L32.3,27.2 L33,26.5 L34.9,25.5 L36.8,25.1 L38.8,25 L40.7,25.1 L42.6,25.3 L44.6,25.6 L46.5,26 L48.5,26.5 L50.4,27.1 L52.2,27.8 L54,28.6 L55.8,29.5 L57.5,30.5 L59.1,31.6 L60.7,32.8 L62.2,34.1 L63.6,35.5 L64.9,36.9 L66.1,38.4 L67.2,39.9 L68.1,41.6 L69,43.2 L69.7,44.9 L70.3,46.7 L70.7,48.5 L70.9,50.2 L70.9,52 L70.7,53.7 L70.4,55.4 L69.9,57.1 L69.3,58.7 L68.6,60.3 L67.8,61.8 L66.9,63.3 L65.9,64.7 L64.9,66.1 L63.6,67.5 L62.3,68.7 L60.9,69.8 L59.4,70.7 L57.8,71.5 L56.1,72 L54.3,72.3 L52.6,72.3 L50.8,72 L49.1,71.4 L47.4,70.5 L45.8,69.5 L44.3,68.2 L42.9,66.9 L41.5,65.5 L40.2,64 L38.9,62.5 L37.6,61.1 L36.3,59.6 L35.1,58.1 L33.8,56.6 L32.7,55 L31.6,53.3 L30.7,51.6 L29.8,49.8 L29.2,47.9 L28.7,46 L28.4,44.1 L28.4,42.2 L28.7,40.3 L29.2,38.4 L29.9,36.6 L30.7,34.9 L31.5,33.1 L31.9,31.1 L31.9,29.1 Z"
            fill="#f0f1f2"
            stroke="#6b7280"
            strokeWidth="0.3"
          />
          
          {/* Render counties as circles */}
          {Object.entries(countyPositions).map(([county, [x, y]]) => (
            <g key={county} onClick={() => handleCountyClick(county)}>
              <circle
                cx={x}
                cy={y}
                r={county === selectedCounty ? 5 : 4}
                fill={getColor(county)}
                stroke="#fff"
                strokeWidth="0.5"
                className={`transition-all cursor-pointer ${
                  county === selectedCounty ? 'stroke-2 stroke-indigo-500' : 'hover:r-4.5'
                }`}
                onMouseOver={(e) => {
                  const rect = mapContainerRef.current?.getBoundingClientRect();
                  if (rect) {
                    const svgX = (x / 100) * rect.width;
                    const svgY = (y / 100) * rect.height;
                    handleMouseOver(county, svgX, svgY - 30);
                  }
                }}
                onMouseOut={handleMouseOut}
              />
              <text
                x={x}
                y={y + 8}
                textAnchor="middle"
                fontSize="2"
                fill="#374151"
                className="pointer-events-none"
              >
                {county}
              </text>
            </g>
          ))}
        </svg>
        
        {/* Tooltip */}
        {tooltipInfo.visible && (
          <div
            className="absolute bg-white dark:bg-gray-800 p-2 rounded-md shadow-md text-sm z-10 pointer-events-none"
            style={{
              left: `${tooltipInfo.x}px`,
              top: `${tooltipInfo.y}px`,
              transform: 'translate(-50%, -100%)',
              maxWidth: '150px'
            }}
            dangerouslySetInnerHTML={{ __html: tooltipInfo.content }}
          />
        )}
      </div>
    );
  };
  
  const renderDublinMap = () => {
    return (
      <div className="relative" style={{ height: `${height}px`, overflow: "hidden" }}>
        <button
          className="absolute top-2 left-2 z-10 bg-white dark:bg-gray-800 p-2 rounded-md shadow-md text-sm"
          onClick={handleZoomOut}
        >
          ← Back to Ireland
        </button>
        
        <div className="absolute top-2 right-2 z-10 bg-white dark:bg-gray-800 p-2 rounded-md shadow-md text-xs">
          <p>Click on districts for details</p>
        </div>
        
        <svg width="100%" height="100%" viewBox="65 40 25 25" preserveAspectRatio="xMidYMid meet">
          {/* Dublin county outline - more detailed */}
          <path
            d="M70,47 Q69.5,48 69.8,49.5 T70.5,51.5 T72,53.5 T73.5,55 T75.5,56 T77.5,56.5 T80,56 T82,54.5 T83,52.5 T83.5,50 T82,47.5 T80,46 T77,45 T74,45.5 T71.5,46.5 Z"
            fill="#e5e7eb"
            stroke="#6b7280"
            strokeWidth="0.2"
          />
          
          {/* Render Dublin districts */}
          {Object.entries(dublinDistricts).map(([district, [x, y]]) => (
            <g key={district}>
              <circle
                cx={x}
                cy={y}
                r={3}
                fill={getColor("Dublin")} // Use Dublin's color for districts
                stroke="#fff"
                strokeWidth="0.2"
                className="transition-all cursor-pointer hover:r-3.5"
                onMouseOver={(e) => {
                  const rect = mapContainerRef.current?.getBoundingClientRect();
                  if (rect) {
                    // Calculate position in the scaled/zoomed viewport
                    const svgX = ((x - 65) / 25) * rect.width;
                    const svgY = ((y - 40) / 25) * rect.height;
                    handleMouseOver(district, svgX, svgY - 20);
                  }
                }}
                onMouseOut={handleMouseOut}
              />
              <text
                x={x}
                y={y + 5}
                textAnchor="middle"
                fontSize="1.2"
                fill="#374151"
                className="pointer-events-none"
              >
                {district}
              </text>
            </g>
          ))}
        </svg>
        
        {/* Tooltip */}
        {tooltipInfo.visible && (
          <div
            className="absolute bg-white dark:bg-gray-800 p-2 rounded-md shadow-md text-sm z-10 pointer-events-none"
            style={{
              left: `${tooltipInfo.x}px`,
              top: `${tooltipInfo.y}px`,
              transform: 'translate(-50%, -100%)',
              maxWidth: '150px'
            }}
            dangerouslySetInnerHTML={{ __html: tooltipInfo.content }}
          />
        )}
      </div>
    );
  };
  
  return (
    <Card className="bg-white dark:bg-gray-800 shadow-md overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">
            {zoomLevel === "country" ? "Political Views Across Ireland" : "Dublin Political Views"}
          </CardTitle>
          <Badge variant="outline" className="ml-2">
            Interactive Map
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
          
          <div ref={mapContainerRef} className="mt-4 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Loading geographic data...</p>
                </div>
              </div>
            ) : (
              zoomLevel === "country" ? renderIrelandMap() : renderDublinMap()
            )}
          </div>
        </Tabs>
        
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
          <p>Click on Dublin to zoom in and see district-level data. Data shows political opinions aggregated anonymously from user responses.</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ZoomableIrelandMap;