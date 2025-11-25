import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Info, MapPin, Home } from 'lucide-react';

interface LightweightIrishMapProps {
  height?: number;
  className?: string;
  showControls?: boolean;
}

// Define types for map data
interface MapRegion {
  id: string;
  name: string;
  color: string;
  description: string;
  coordinates: { x: number; y: number };
  seats?: number;
  population?: number;
  turnout?: number;
}

// Create province data
const provinces: MapRegion[] = [
  {
    id: 'connacht',
    name: 'Connacht',
    color: 'bg-emerald-500',
    description: 'Western province with counties Galway, Leitrim, Mayo, Roscommon, and Sligo.',
    coordinates: { x: 20, y: 30 },
    population: 584000
  },
  {
    id: 'leinster',
    name: 'Leinster',
    color: 'bg-blue-500',
    description: 'Eastern province including Dublin, with 12 counties total.',
    coordinates: { x: 70, y: 35 },
    population: 2630720
  },
  {
    id: 'munster',
    name: 'Munster',
    color: 'bg-red-500',
    description: 'Southern province with counties Clare, Cork, Kerry, Limerick, Tipperary, and Waterford.',
    coordinates: { x: 40, y: 70 },
    population: 1280394
  },
  {
    id: 'ulster',
    name: 'Ulster',
    color: 'bg-amber-500',
    description: 'Northern province with 3 counties in the Republic and 6 in Northern Ireland.',
    coordinates: { x: 55, y: 15 },
    population: 2038645
  }
];

// Create data for key constituencies
const constituencies: MapRegion[] = [
  {
    id: 'dublin-central',
    name: 'Dublin Central',
    color: 'bg-blue-600',
    description: 'Urban constituency in central Dublin',
    coordinates: { x: 73, y: 35 },
    seats: 4,
    turnout: 52.5
  },
  {
    id: 'dublin-bay-south',
    name: 'Dublin Bay South',
    color: 'bg-blue-600',
    description: 'Affluent constituency in south Dublin',
    coordinates: { x: 74, y: 38 },
    seats: 4,
    turnout: 58.2
  },
  {
    id: 'cork-south-central',
    name: 'Cork South-Central',
    color: 'bg-red-600',
    description: 'Major constituency in Cork City',
    coordinates: { x: 35, y: 78 },
    seats: 4,
    turnout: 60.4
  },
  {
    id: 'galway-west',
    name: 'Galway West',
    color: 'bg-emerald-600',
    description: 'Western constituency including Galway city',
    coordinates: { x: 18, y: 40 },
    seats: 5,
    turnout: 56.8
  },
  {
    id: 'donegal',
    name: 'Donegal',
    color: 'bg-amber-600',
    description: 'Northernmost constituency in the Republic',
    coordinates: { x: 30, y: 8 },
    seats: 5,
    turnout: 57.1
  }
];

// Create data for major cities
const majorCities: MapRegion[] = [
  {
    id: 'dublin',
    name: 'Dublin',
    color: 'bg-gray-800',
    description: 'Capital and largest city',
    coordinates: { x: 73, y: 35 },
    population: 1173179
  },
  {
    id: 'cork',
    name: 'Cork',
    color: 'bg-gray-800',
    description: 'Second largest city',
    coordinates: { x: 35, y: 78 },
    population: 208669
  },
  {
    id: 'galway',
    name: 'Galway',
    color: 'bg-gray-800',
    description: 'Western city and cultural hub',
    coordinates: { x: 18, y: 40 },
    population: 79934
  },
  {
    id: 'limerick',
    name: 'Limerick',
    color: 'bg-gray-800',
    description: 'Third largest city',
    coordinates: { x: 30, y: 65 },
    population: 94192
  },
  {
    id: 'waterford',
    name: 'Waterford',
    color: 'bg-gray-800',
    description: 'Oldest city in Ireland',
    coordinates: { x: 58, y: 80 },
    population: 53504
  }
];

const LightweightIrishMap: React.FC<LightweightIrishMapProps> = ({ 
  height = 400, 
  className = '',
  showControls = true 
}) => {
  const [activeView, setActiveView] = useState<'provinces' | 'constituencies' | 'cities'>('provinces');
  const [selectedRegion, setSelectedRegion] = useState<MapRegion | null>(null);
  const [zoom, setZoom] = useState(1);
  const [mapCenter, setMapCenter] = useState({ x: 50, y: 50 });
  
  // Get currently active regions based on selected view
  const activeRegions = () => {
    switch (activeView) {
      case 'provinces':
        return provinces;
      case 'constituencies':
        return constituencies;
      case 'cities':
        return majorCities;
      default:
        return provinces;
    }
  };
  
  // Handle region click
  const handleRegionClick = (region: MapRegion) => {
    if (selectedRegion && selectedRegion.id === region.id) {
      setSelectedRegion(null);
    } else {
      setSelectedRegion(region);
      // Optionally center map on selected region
      setMapCenter({
        x: 50 - (region.coordinates.x - 50) * 0.5,
        y: 50 - (region.coordinates.y - 50) * 0.5
      });
    }
  };
  
  // Handle zoom controls
  const zoomIn = () => setZoom(prev => Math.min(prev + 0.2, 2));
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));
  const resetView = () => {
    setZoom(1);
    setMapCenter({ x: 50, y: 50 });
    setSelectedRegion(null);
  };
  
  // Calculate position adjustments based on zoom and center
  const adjustPosition = (coord: { x: number; y: number }) => {
    return {
      x: (coord.x - mapCenter.x) * zoom + 50,
      y: (coord.y - mapCenter.y) * zoom + 50
    };
  };
  
  // Render region markers
  const renderRegionMarkers = () => {
    return activeRegions().map(region => {
      const isSelected = selectedRegion?.id === region.id;
      const position = adjustPosition(region.coordinates);
      
      // Skip if position is outside visible area
      if (position.x < -5 || position.x > 105 || position.y < -5 || position.y > 105) {
        return null;
      }
      
      return (
        <div
          key={region.id}
          className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer transition-all duration-200 ${isSelected ? 'z-20' : 'z-10'}`}
          style={{ 
            left: `${position.x}%`, 
            top: `${position.y}%` 
          }}
          onClick={() => handleRegionClick(region)}
        >
          <div 
            className={`${region.color} w-4 h-4 md:w-5 md:h-5 rounded-full border-2 border-white shadow-md ${
              isSelected ? 'scale-150' : 'hover:scale-125'
            } transition-transform`}
          />
          <div 
            className={`mt-1 text-xs md:text-sm font-medium bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded shadow whitespace-nowrap ${
              isSelected ? 'opacity-100' : 'opacity-80'
            }`}
          >
            {region.name}
          </div>
        </div>
      );
    });
  };
  
  // Define outline of Ireland (accurate SVG path)
  const irelandOutlinePath = "M38.27,11.91c-0.44,0.06-1.61,0.75-2.02,1.15c-1.06,1.32-3.17,3.08-3.4,3.66c-0.27,0.62-0.71,1.32-1.12,1.77c-0.36,0.4-0.79,1.54-0.79,1.94c0,0.49-0.44,1.01-1.95,2.21c-1.24,0.97-2.16,1.81-2.16,1.81s-0.13,0.48-0.22,0.7c-0.13,0.4-0.04,0.92,0.4,2.25c0.8,2.52-0.66,6.79-2.78,8.17c-0.58,0.4-0.97,0.84-1.19,1.5c-0.49,1.41-1.28,2.74-1.86,3.17c-0.53,0.4-0.79,0.75-0.79,1.15c0,0.48,0.22,0.79,0.48,0.79c0.18,0,0.36,0.04,0.36,0.13c0,0.04-0.31,0.48-0.66,0.92c-1.06,1.32-1.77,2.82-1.77,3.7c0,0.57,0.18,0.79,0.97,1.24c1.1,0.62,1.95,1.54,2.38,2.65c0.4,0.97,0.4,1.06,0.09,1.9c-0.36,0.88-0.36,0.97-0.13,1.37c0.22,0.4,0.62,0.57,0.62,0.26c0-0.09,0.13-0.13,0.27-0.13c0.18,0,0.31,0.18,0.31,0.44c0,0.48,0.57,1.5,1.28,2.38c0.53,0.7,0.57,1.23,0.13,1.76c-0.31,0.4-0.4,0.61-0.4,0.97c0,0.4,0.09,0.44,1.15,0.26c0.62-0.09,1.28-0.22,1.5-0.31c0.53-0.22,1.63-0.48,2.21-0.48c0.4,0,0.49,0.04,0.44,0.31c-0.04,0.22,0,0.4,0.13,0.53c0.27,0.22,0.27,0.88,0.04,1.1c-0.13,0.13-0.75,0.4-1.37,0.57c-1.72,0.48-2.16,0.75-2.16,1.32c0,0.44,0.62,1.19,1.32,1.68c0.62,0.4,0.79,0.97,0.57,1.59c-0.36,0.97-1.5,2.07-2.6,2.47c-0.84,0.35-0.88,0.35-1.37,0.18c-0.44-0.18-0.53-0.18-0.97,0.09c-0.53,0.31-0.71,0.7-0.71,1.41c0,0.44-0.09,0.57-0.53,0.79c-0.79,0.44-1.37,1.1-1.37,1.54c0,0.62,0.75,0.92,2.25,0.92c0.93,0,1.32,0.04,1.54,0.22c0.36,0.31,0.36,0.57,0,0.93c-0.22,0.22-0.35,0.44-0.31,0.62c0.09,0.22,0.57,0.48,1.24,0.7c0.22,0.09,0.57,0.27,0.75,0.4c0.27,0.22,0.36,0.22,0.53,0.09c0.13-0.13,0.27-0.13,0.4-0.04c0.66,0.44,2.87-0.13,4.11-1.06c0.4-0.31,0.84-0.57,0.93-0.57c0.31,0,1.15-0.62,1.5-1.1c0.35-0.53,0.8-0.71,1.19-0.53c0.13,0.09,0.4,0.13,0.53,0.13c0.31,0,0.31,0,0.13,0.31c-0.09,0.18-0.22,0.62-0.31,0.93c-0.13,0.79-0.53,1.28-1.28,1.63c-0.31,0.13-0.93,0.4-1.32,0.57c-0.84,0.4-1.24,0.75-1.24,1.1c0,0.35,0.22,0.48,0.88,0.48c0.4,0,0.75,0.09,1.81,0.49c1.24,0.44,1.32,0.48,1.72,0.44c0.48-0.05,1.23-0.49,1.23-0.71c0-0.08,0.09-0.13,0.22-0.13c0.27,0,0.71-0.53,0.71-0.84c0-0.13,0.13-0.27,0.31-0.35c0.53-0.27,0.93-0.62,1.19-1.15c0.4-0.84,0.75-1.32,1.54-2.25c0.79-0.89,1.1-1.36,1.1-1.76c0-0.18-0.13-0.31-0.44-0.4c-0.31-0.09-0.49-0.09-0.66,0c-0.18,0.09-0.36,0.09-0.62-0.04c-0.57-0.27-0.75-0.62-0.84-1.68c-0.04-0.7-0.13-1.01-0.31-1.32c-0.18-0.27-0.31-0.62-0.31-0.93c0-0.93,0.09-1.02,1.24-1.15c1.01-0.13,1.42-0.31,1.45-0.62c0.05-0.74-0.88-1.5-2.07-1.76c-0.31-0.04-0.74-0.22-0.97-0.35c-0.27-0.18-0.62-0.27-0.93-0.27c-0.49,0-0.53-0.04-0.88-0.97c-0.31-0.71-0.4-1.06-0.4-1.54c0-0.7,0.13-0.88,0.88-1.32c0.31-0.18,0.75-0.48,0.93-0.71c0.18-0.22,0.75-0.7,1.19-1.06c0.71-0.53,0.88-0.62,1.1-0.53c0.18,0.09,0.44,0.09,0.84-0.04c0.75-0.22,0.84-0.22,1.1,0.04c0.13,0.13,0.62,0.35,1.06,0.48c0.44,0.14,1.01,0.4,1.23,0.57c0.27,0.22,0.57,0.35,0.84,0.35c0.88,0,2.03-1.15,2.96-2.96c0.35-0.7,0.53-0.93,0.88-0.97c0.4-0.04,0.71-0.31,1.41-1.06c0.22-0.27,0.66-0.66,0.93-0.84c0.74-0.53,1.72-1.9,1.72-2.43c0-0.26,0.09-0.48,0.18-0.57c0.53-0.35,0.8-0.97,0.8-1.85c0-1.5-0.97-3.3-2.21-4.15c-0.35-0.22-0.93-0.62-1.32-0.88c-0.84-0.57-1.33-1.15-1.54-1.72c-0.13-0.35-0.22-0.44-0.57-0.44c-0.44,0-2.16-0.53-2.74-0.84c-0.18-0.09-0.57-0.4-0.84-0.66c-0.4-0.4-0.57-0.48-0.8-0.44c-0.26,0.04-0.31,0-0.4-0.48c-0.04-0.31-0.13-0.62-0.18-0.71c-0.13-0.13-0.13-0.57-0.04-0.97c0.09-0.31,0.09-0.31-0.31-0.31c-0.22,0-0.53-0.04-0.71-0.09c-0.31-0.09-0.35-0.13-0.35-0.53c0-0.35,0.04-0.53,0.35-1.15c0.97-1.68,1.1-2.03,1.1-2.65c0-0.88,0.09-1.06,0.66-1.28c1.32-0.53,2.65-1.32,3.39-2.12c0.75-0.79,0.97-1.19,1.06-1.98c0.13-1.85-1.23-4.33-3.04-5.43c-0.66-0.4-1.9-0.53-2.43-0.31c-0.18,0.09-0.48,0.13-0.66,0.09c-0.27-0.04-0.36,0-0.49,0.26c-0.09,0.22-0.49,0.53-1.06,0.84c-0.49,0.27-1.01,0.66-1.15,0.84c-0.18,0.26-0.36,0.35-0.57,0.35c-0.18,0-0.4,0.09-0.48,0.18c-0.09,0.13-0.31,0.48-0.49,0.79c-0.27,0.49-0.36,0.57-0.8,0.62c-0.27,0.04-0.66,0.13-0.89,0.22c-0.22,0.09-0.57,0.18-0.8,0.18c-0.22,0.04-0.48,0.18-0.62,0.31c-0.13,0.13-0.4,0.27-0.57,0.27c-0.18,0.04-0.67,0.13-1.1,0.22c-0.44,0.09-0.93,0.22-1.1,0.27C39.33,11.83,38.67,11.83,38.27,11.91zM37.65,71.46c-0.31,0.22-0.31,0.27-0.31,0.8c0,0.53,0,0.57,0.31,0.8c0.44,0.31,1.15,0.31,1.54,0c0.31-0.22,0.31-0.27,0.31-0.8c0-0.53,0-0.57-0.31-0.8C38.76,71.15,38.05,71.15,37.65,71.46zM62.94,50.46c-0.18,0.13-0.62,0.35-0.97,0.53c-0.71,0.35-1.1,0.66-1.1,0.79c0,0.05-0.18,0.31-0.4,0.53c-0.48,0.44-1.32,1.9-1.32,2.21c0,0.13-0.13,0.35-0.22,0.49c-0.31,0.31-0.31,1.9-0.04,2.51c0.13,0.31,0.35,0.84,0.53,1.24c0.35,0.84,0.97,1.76,1.32,1.98c0.13,0.09,0.31,0.35,0.4,0.62c0.13,0.35,0.31,0.53,0.66,0.66c0.31,0.13,0.57,0.35,0.71,0.66c0.13,0.26,0.4,0.53,0.66,0.62c0.49,0.18,1.54,0.75,2.03,1.1c0.57,0.44,1.68,0.62,2.29,0.35c0.62-0.27,1.46-1.28,1.72-2.12c0.13-0.35,0.35-0.79,0.53-0.97c0.22-0.22,0.31-0.53,0.31-1.06c0-0.75-0.48-1.98-1.1-2.78c-0.13-0.18-0.31-0.44-0.4-0.62c-0.27-0.48-2.16-2.87-2.96-3.7c-0.88-0.97-1.98-1.76-2.6-1.9C63.38,50.28,63.12,50.33,62.94,50.46zM53.27,71.1c-0.48,0.09-0.93,0.27-1.81,0.71c-1.19,0.62-1.68,0.8-2.47,0.8c-0.88,0-1.02,0.22-0.71,1.32c0.18,0.66,0.22,0.71,0.66,0.8c0.31,0.04,0.75,0.27,1.19,0.57c0.4,0.31,0.93,0.62,1.19,0.71c0.44,0.13,0.57,0.13,1.46-0.13c1.06-0.31,1.37-0.49,1.85-1.15c0.53-0.75,0.57-1.37,0.18-2.12c-0.22-0.4-0.35-0.53-0.66-0.62C53.97,71.02,53.63,71.02,53.27,71.1z";
  
  return (
    <Card className={`bg-white dark:bg-gray-800 shadow-md overflow-hidden ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">Ireland Map</CardTitle>
          <Badge variant="outline" className="ml-2">
            Interactive
          </Badge>
        </div>
        <CardDescription>
          {activeView === 'provinces' && 'Explore Ireland\'s four historic provinces'}
          {activeView === 'constituencies' && 'View key electoral constituencies'}
          {activeView === 'cities' && 'Locate major cities in Ireland'}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {showControls && (
          <Tabs 
            defaultValue="provinces" 
            className="w-full" 
            onValueChange={(v) => {
              setActiveView(v as any);
              setSelectedRegion(null);
            }}
            value={activeView}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="provinces">Provinces</TabsTrigger>
              <TabsTrigger value="constituencies">Constituencies</TabsTrigger>
              <TabsTrigger value="cities">Cities</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        
        <div 
          className="relative border rounded-md shadow-inner bg-blue-50 dark:bg-blue-950"
          style={{ height: `${height}px` }}
        >
          {/* Map base with Ireland outline */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <svg 
              width="100%" 
              height="100%" 
              viewBox="0 0 100 100" 
              preserveAspectRatio="xMidYMid meet"
              className="opacity-80"
            >
              <g transform={`scale(${zoom}) translate(${mapCenter.x - 50} ${mapCenter.y - 50})`}>
                <path 
                  d={irelandOutlinePath} 
                  fill="rgba(200, 230, 255, 0.5)" 
                  stroke="rgba(100, 150, 200, 0.8)" 
                  strokeWidth="1"
                />
                {/* Add Northern Ireland outline with dashed border */}
                <path 
                  d="M38.27,11.91 C39.2,10.8 40.3,9.8 41.6,9.2 C43.5,8.3 45.6,8.5 47.5,9.2 C49.2,9.8 50.2,11.5 51.1,13.0 C51.8,14.1 52.5,15.2 53.0,16.5 C53.5,17.7 54.0,19.1 53.8,20.4 C53.7,21.2 53.2,21.9 52.8,22.6 C52.3,23.5 51.9,24.5 51.8,25.5 C51.6,27.3 52.4,29.1 53.3,30.6"
                  fill="rgba(255, 255, 255, 0.4)"
                  stroke="rgba(100, 100, 100, 0.8)"
                  strokeWidth="0.8"
                  strokeDasharray="2,1"
                />
              </g>
            </svg>
          </div>
          
          {/* Region markers */}
          {renderRegionMarkers()}
          
          {/* Map controls */}
          <div className="absolute top-3 right-3 flex flex-col gap-1 z-30">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8 bg-white dark:bg-gray-800 rounded-md shadow-sm" 
              onClick={zoomIn}
            >
              <span className="text-xl font-bold">+</span>
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8 bg-white dark:bg-gray-800 rounded-md shadow-sm" 
              onClick={zoomOut}
            >
              <span className="text-xl font-bold">-</span>
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8 bg-white dark:bg-gray-800 rounded-md shadow-sm" 
              onClick={resetView}
            >
              <Home className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Info panel for selected region */}
          {selectedRegion && (
            <div className="absolute left-3 bottom-3 right-3 md:left-auto md:right-3 md:bottom-3 md:w-60 bg-white dark:bg-gray-800 rounded-md shadow-md p-3 z-30">
              <div className="flex items-start justify-between">
                <h3 className="font-bold flex items-center">
                  <span className={`inline-block w-3 h-3 rounded-full ${selectedRegion.color} mr-2`}></span>
                  {selectedRegion.name}
                </h3>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 -mt-1 -mr-1" 
                  onClick={() => setSelectedRegion(null)}
                >
                  <span className="text-lg">&times;</span>
                </Button>
              </div>
              <p className="text-sm mt-1 text-gray-600 dark:text-gray-300">
                {selectedRegion.description}
              </p>
              
              <div className="mt-2 text-sm grid grid-cols-2 gap-x-2 gap-y-1">
                {selectedRegion.population && (
                  <>
                    <span className="text-gray-500 dark:text-gray-400">Population:</span>
                    <span className="font-medium">{selectedRegion.population.toLocaleString()}</span>
                  </>
                )}
                {selectedRegion.seats && (
                  <>
                    <span className="text-gray-500 dark:text-gray-400">Seats:</span>
                    <span className="font-medium">{selectedRegion.seats}</span>
                  </>
                )}
                {selectedRegion.turnout && (
                  <>
                    <span className="text-gray-500 dark:text-gray-400">Voter Turnout:</span>
                    <span className="font-medium">{selectedRegion.turnout}%</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Simplified interactive map with key regions. Click on markers for more information.
        </div>
      </CardContent>
    </Card>
  );
};

export default LightweightIrishMap;