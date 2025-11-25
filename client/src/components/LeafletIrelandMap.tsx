import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { electoralConstituencies } from '../assets/electoral-data';
import { constituencyDetails } from '../assets/constituency-data';

interface LeafletIrelandMapProps {
  height?: number;
  className?: string;
  interactive?: boolean;
  initialTab?: string;
  onConstituencySelect?: (name: string) => void;
}

interface Marker {
  id: string;
  name: string;
  type: 'province' | 'constituency' | 'city';
  lat: number;
  lng: number;
  color: string;
  description: string;
  details?: Record<string, string | number>;
}

const LeafletIrelandMap: React.FC<LeafletIrelandMapProps> = ({
  height = 500,
  className = '',
  interactive = false,
  initialTab = 'provinces',
  onConstituencySelect
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'provinces' | 'constituencies' | 'electoral' | 'cities' | 'all'>(initialTab as any || 'provinces');
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);
  const [mapInitialized, setMapInitialized] = useState(false);

  // Define marker data
  const provinceMarkers: Marker[] = [
    { 
      id: 'connacht', 
      name: 'Connacht', 
      type: 'province',
      lat: 53.77, 
      lng: -8.92, 
      color: '#10b981', 
      description: 'Western province with counties Galway, Leitrim, Mayo, Roscommon, and Sligo.',
      details: { counties: 5, population: 584000 }
    },
    { 
      id: 'leinster', 
      name: 'Leinster', 
      type: 'province',
      lat: 53.33, 
      lng: -7.32, 
      color: '#3b82f6', 
      description: 'Eastern province including Dublin, with 12 counties total.',
      details: { counties: 12, population: 2630720 }
    },
    { 
      id: 'munster', 
      name: 'Munster', 
      type: 'province',
      lat: 52.25, 
      lng: -8.75, 
      color: '#ef4444', 
      description: 'Southern province with counties Clare, Cork, Kerry, Limerick, Tipperary, and Waterford.',
      details: { counties: 6, population: 1280394 }
    },
    { 
      id: 'ulster', 
      name: 'Ulster', 
      type: 'province',
      lat: 54.60, 
      lng: -7.33, 
      color: '#f59e0b', 
      description: 'Northern province with 3 counties in the Republic and 6 in Northern Ireland.',
      details: { counties: 9, population: 2038645 }
    }
  ];
  
  const constituencyMarkers: Marker[] = [
    { 
      id: 'dublin-central', 
      name: 'Dublin Central', 
      type: 'constituency',
      lat: 53.350, 
      lng: -6.260, 
      color: '#1d4ed8', 
      description: 'Urban constituency in central Dublin',
      details: { seats: 4, turnout: '52.5%' }
    },
    { 
      id: 'dublin-bay-south', 
      name: 'Dublin Bay South', 
      type: 'constituency',
      lat: 53.330, 
      lng: -6.230, 
      color: '#1d4ed8', 
      description: 'Affluent constituency in south Dublin',
      details: { seats: 4, turnout: '58.2%' }
    },
    { 
      id: 'cork-south-central', 
      name: 'Cork South-Central', 
      type: 'constituency',
      lat: 51.893, 
      lng: -8.480, 
      color: '#b91c1c', 
      description: 'Major constituency in Cork City',
      details: { seats: 4, turnout: '60.4%' }
    },
    { 
      id: 'galway-west', 
      name: 'Galway West', 
      type: 'constituency',
      lat: 53.270, 
      lng: -9.056, 
      color: '#047857',
      description: 'Western constituency including Galway city',
      details: { seats: 5, turnout: '56.8%' }
    },
    { 
      id: 'donegal', 
      name: 'Donegal', 
      type: 'constituency',
      lat: 54.930, 
      lng: -7.930, 
      color: '#d97706', 
      description: 'Northernmost constituency in the Republic',
      details: { seats: 5, turnout: '57.1%' }
    }
  ];
  
  const cityMarkers: Marker[] = [
    { 
      id: 'dublin', 
      name: 'Dublin', 
      type: 'city',
      lat: 53.350, 
      lng: -6.260, 
      color: '#000000', 
      description: 'Capital and largest city',
      details: { population: 1173179, constituencies: 11 }
    },
    { 
      id: 'cork', 
      name: 'Cork', 
      type: 'city',
      lat: 51.898, 
      lng: -8.476, 
      color: '#000000', 
      description: 'Second largest city',
      details: { population: 208669, constituencies: 4 }
    },
    { 
      id: 'galway', 
      name: 'Galway', 
      type: 'city',
      lat: 53.270, 
      lng: -9.056, 
      color: '#000000', 
      description: 'Western city and cultural hub',
      details: { population: 79934, constituencies: 2 }
    },
    { 
      id: 'limerick', 
      name: 'Limerick', 
      type: 'city',
      lat: 52.661, 
      lng: -8.623, 
      color: '#000000', 
      description: 'Third largest city',
      details: { population: 94192, constituencies: 2 }
    },
    { 
      id: 'waterford', 
      name: 'Waterford', 
      type: 'city',
      lat: 52.260, 
      lng: -7.110, 
      color: '#000000', 
      description: 'Oldest city in Ireland',
      details: { population: 53504, constituencies: 1 }
    }
  ];

  // Define electoral constituencies markers
  const electoralMarkers: Marker[] = [
    { 
      id: 'kildare-north', 
      name: 'Kildare North', 
      type: 'constituency',
      lat: 53.2, 
      lng: -6.66, 
      color: '#3b82f6', 
      description: 'Electoral constituency in north Kildare',
      details: { seats: 4, turnout: '63.4%' }
    },
    { 
      id: 'kildare-south', 
      name: 'Kildare South', 
      type: 'constituency',
      lat: 53.0, 
      lng: -6.82, 
      color: '#3b82f6', 
      description: 'Electoral constituency in south Kildare',
      details: { seats: 4, turnout: '60.1%' }
    },
    { 
      id: 'dublin-central', 
      name: 'Dublin Central', 
      type: 'constituency',
      lat: 53.350, 
      lng: -6.260, 
      color: '#3b82f6', 
      description: 'Urban constituency in central Dublin',
      details: { seats: 4, turnout: '52.5%' }
    },
    { 
      id: 'dublin-west', 
      name: 'Dublin West', 
      type: 'constituency',
      lat: 53.395, 
      lng: -6.420, 
      color: '#3b82f6', 
      description: 'Constituency in west Dublin',
      details: { seats: 4, turnout: '54.8%' }
    },
    { 
      id: 'cork-north-central', 
      name: 'Cork North-Central', 
      type: 'constituency',
      lat: 51.93, 
      lng: -8.51, 
      color: '#b91c1c', 
      description: 'Electoral constituency in north-central Cork',
      details: { seats: 4, turnout: '58.2%' }
    }
  ];

  // Get active markers based on selected tab
  const getActiveMarkers = () => {
    switch (activeTab) {
      case 'provinces':
        return provinceMarkers;
      case 'constituencies':
        return constituencyMarkers;
      case 'electoral':
        return electoralMarkers;
      case 'cities':
        return cityMarkers;
      default:
        return provinceMarkers;
    }
  };

  // Initialize the map
  useEffect(() => {
    if (!mapRef.current || mapInitialized) return;
    
    // Import Leaflet dynamically to avoid SSR issues
    const initializeMap = async () => {
      try {
        // Import necessary Leaflet libraries
        const L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');
        
        // Fix Leaflet default icon issue
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        });
        
        // Initialize map centered on Ireland
        const map = L.map(mapRef.current).setView([53.4, -7.9], 7);
        
        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);
        
        // Add a layer group for markers
        const markersGroup = L.layerGroup().addTo(map);
        
        // Add a layer group for county boundaries
        const countiesGroup = L.layerGroup().addTo(map);
        
        // Add a layer group for electoral constituency boundaries
        const electoralGroup = L.layerGroup();
        
        // Define county styles for different provinces
        const countyStyles = {
          Connacht: { color: '#10b981', weight: 1.5, opacity: 0.8, fillColor: '#10b981', fillOpacity: 0.2 },
          Leinster: { color: '#3b82f6', weight: 1.5, opacity: 0.8, fillColor: '#3b82f6', fillOpacity: 0.2 },
          Munster: { color: '#ef4444', weight: 1.5, opacity: 0.8, fillColor: '#ef4444', fillOpacity: 0.2 },
          Ulster: { color: '#f59e0b', weight: 1.5, opacity: 0.8, fillColor: '#f59e0b', fillOpacity: 0.2 }
        };
        
        // Map counties to their province
        const countyToProvince: Record<string, 'Connacht' | 'Leinster' | 'Munster' | 'Ulster'> = {
          // Connacht
          'Galway': 'Connacht',
          'Mayo': 'Connacht',
          'Sligo': 'Connacht', 
          'Leitrim': 'Connacht',
          'Roscommon': 'Connacht',
          
          // Leinster 
          'Dublin': 'Leinster',
          'Kildare': 'Leinster',
          'Meath': 'Leinster',
          'Louth': 'Leinster',
          'Wicklow': 'Leinster',
          'Westmeath': 'Leinster',
          'Longford': 'Leinster',
          'Offaly': 'Leinster',
          'Laois': 'Leinster',
          'Kilkenny': 'Leinster',
          'Carlow': 'Leinster',
          'Wexford': 'Leinster',
          
          // Munster
          'Clare': 'Munster',
          'Cork': 'Munster',
          'Kerry': 'Munster',
          'Limerick': 'Munster',
          'Tipperary': 'Munster',
          'Waterford': 'Munster',
          
          // Ulster (both ROI and NI)
          'Donegal': 'Ulster',
          'Cavan': 'Ulster',
          'Monaghan': 'Ulster',
          'Antrim': 'Ulster',
          'Armagh': 'Ulster',
          'Down': 'Ulster',
          'Fermanagh': 'Ulster',
          'Derry': 'Ulster',
          'Londonderry': 'Ulster', // Alternative name
          'Tyrone': 'Ulster'
        };
        
        // Define electoral constituency style
        const electoralStyle = {
          color: '#6366f1', // Indigo color
          weight: 2,
          opacity: 0.9,
          fillColor: '#818cf8',
          fillOpacity: 0.15,
          dashArray: '4'
        };
        
        // Function to add electoral constituency GeoJSON data
        const addElectoralConstituencies = () => {
          try {
            // Use our embedded data instead of fetching from URL
            L.geoJSON(electoralConstituencies as any, {
              style: () => electoralStyle,
              onEachFeature: (feature, layer) => {
                const constituencyName = feature?.properties?.CONSTITUENCY || '';
                const seats = feature?.properties?.SEATS || '?';
                
                // Add popup with constituency name and seats
                layer.bindPopup(`<strong>${constituencyName}</strong><br>Seats: ${seats}`);
                
                // Add hover effect
                layer.on({
                  mouseover: (e) => {
                    const targetLayer = e.target;
                    targetLayer.setStyle({
                      weight: 3,
                      fillOpacity: 0.3
                    });
                    targetLayer.bringToFront();
                  },
                  mouseout: (e) => {
                    const targetLayer = e.target;
                    targetLayer.setStyle(electoralStyle);
                  },
                  click: (e) => {
                    map.fitBounds(e.target.getBounds());
                  }
                });
              }
            }).addTo(electoralGroup);
            
          } catch (error) {
            console.error('Error loading electoral boundaries:', error);
          }
        };
        
        // Function to add county GeoJSON data
        const addCountyBoundaries = async () => {
          try {
            // Try to fetch from the direct GitHub URL as a fallback
            const url = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/main/public/data/ireland-counties.geojson';
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
            const data = await response.json();
            
            L.geoJSON(data as any, {
              style: (feature) => {
                const countyName = feature?.properties?.name || '';
                const province = countyToProvince[countyName] || 'Leinster';
                return countyStyles[province];
              },
              onEachFeature: (feature, layer) => {
                const countyName = feature?.properties?.name || '';
                const province = countyToProvince[countyName] || 'Unknown';
                
                // Add popup with county name and province
                layer.bindPopup(`<strong>${countyName}</strong><br>Province: ${province}`);
                
                // Add hover effect
                layer.on({
                  mouseover: (e) => {
                    const targetLayer = e.target;
                    targetLayer.setStyle({
                      weight: 3,
                      fillOpacity: 0.4
                    });
                    targetLayer.bringToFront();
                  },
                  mouseout: (e) => {
                    const targetLayer = e.target;
                    const cName = feature?.properties?.name || '';
                    const prov = countyToProvince[cName] || 'Leinster';
                    targetLayer.setStyle({
                      weight: countyStyles[prov].weight,
                      fillOpacity: countyStyles[prov].fillOpacity
                    });
                  },
                  click: (e) => {
                    map.fitBounds(e.target.getBounds());
                  }
                });
              }
            }).addTo(countiesGroup);
            
          } catch (error) {
            console.error('Error loading county boundaries:', error);
            
            // If the counties don't load, we'll still show the markers
            console.log('County boundaries could not be loaded, showing markers only');
          }
        };
        
        // Function to update markers based on active tab
        const updateMarkers = () => {
          // Clear existing markers
          markersGroup.clearLayers();
          
          // Add new markers based on active tab
          getActiveMarkers().forEach(marker => {
            const markerColor = marker.color;
            const markerIcon = L.divIcon({
              className: 'custom-div-icon',
              html: `
                <div style="
                  background-color: ${markerColor}; 
                  width: 14px; 
                  height: 14px; 
                  border-radius: 50%; 
                  border: 2px solid white;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.4);
                "></div>
              `,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });
            
            const mapMarker = L.marker([marker.lat, marker.lng], { icon: markerIcon })
              .addTo(markersGroup)
              .bindTooltip(marker.name, { permanent: false, direction: 'top' })
              .on('click', () => {
                setSelectedMarker(marker);
              });
          });
        };
        
        // Add county boundaries and electoral boundaries
        addCountyBoundaries();
        addElectoralConstituencies();
        
        // Update markers initially
        updateMarkers();
        
        // Store the map and layer groups for future updates
        (window as any).leafletMap = map;
        (window as any).markersGroup = markersGroup;
        (window as any).countiesGroup = countiesGroup;
        (window as any).electoralGroup = electoralGroup;
        (window as any).updateMapMarkers = updateMarkers;
        
        setMapInitialized(true);
      } catch (error) {
        console.error('Error initializing Leaflet map:', error);
      }
    };
    
    initializeMap();
    
    // Cleanup function
    return () => {
      const leafletMap = (window as any).leafletMap;
      if (leafletMap) {
        leafletMap.remove();
        (window as any).leafletMap = null;
        (window as any).markersGroup = null;
        (window as any).countiesGroup = null;
        (window as any).updateMapMarkers = null;
      }
    };
  }, [mapRef.current]);
  
  // Update markers and map layers when active tab changes
  useEffect(() => {
    if (!mapInitialized) return;
    
    const map = (window as any).leafletMap;
    const countiesGroup = (window as any).countiesGroup;
    const electoralGroup = (window as any).electoralGroup;
    const updateMapMarkers = (window as any).updateMapMarkers;
    
    // Update markers
    if (updateMapMarkers) {
      updateMapMarkers();
    }
    
    // Handle layer visibility based on active tab
    if (map) {
      // First remove all the layers that might be showing
      if (countiesGroup) map.removeLayer(countiesGroup);
      if (electoralGroup) map.removeLayer(electoralGroup);
      
      // Add back the appropriate layer(s) based on active tab
      if (activeTab === 'provinces' || activeTab === 'constituencies' || activeTab === 'cities') {
        if (countiesGroup) map.addLayer(countiesGroup);
      }
      
      if (activeTab === 'electoral') {
        if (electoralGroup) map.addLayer(electoralGroup);
      }
    }
  }, [activeTab, mapInitialized]);

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
          {activeTab === 'provinces' && 'Explore Ireland\'s four historic provinces'}
          {activeTab === 'constituencies' && 'View key electoral constituencies'}
          {activeTab === 'cities' && 'Locate major cities in Ireland'}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4">
        <Tabs 
          defaultValue="provinces" 
          className="w-full" 
          onValueChange={(v) => {
            setActiveTab(v as any);
            setSelectedMarker(null);
          }}
          value={activeTab}
        >
          <TabsList className="mb-4">
            <TabsTrigger value="provinces">Provinces</TabsTrigger>
            <TabsTrigger value="constituencies">Counties</TabsTrigger>
            <TabsTrigger value="electoral">Electoral Districts</TabsTrigger>
            <TabsTrigger value="cities">Cities</TabsTrigger>
          </TabsList>
          
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Map container */}
            <div 
              className="relative border rounded-md shadow-inner overflow-hidden flex-grow w-full lg:w-2/3"
              style={{ height: `${height}px` }}
            >
              <div ref={mapRef} className="w-full h-full" />
              
              {!mapInitialized && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Loading map...</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Information panel */}
            <div className="w-full lg:w-1/3">
              {selectedMarker ? (
                <div className="border rounded-md p-4 h-full dark:border-gray-700 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center">
                      <span 
                        className="inline-block w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: selectedMarker.color }}
                      ></span>
                      <h3 className="font-bold text-lg">{selectedMarker.name}</h3>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 -mt-1 -mr-1" 
                      onClick={() => setSelectedMarker(null)}
                    >
                      <span className="text-lg">&times;</span>
                    </Button>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    {selectedMarker.description}
                  </p>
                  
                  {selectedMarker.details && (
                    <div className="text-sm space-y-1 border-t pt-3 dark:border-gray-700">
                      <h4 className="font-medium mb-2">Details</h4>
                      {Object.entries(selectedMarker.details).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-2 gap-2">
                          <span className="text-gray-500 dark:text-gray-400 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                          </span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {selectedMarker.type === 'province' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-4"
                      onClick={() => {
                        setActiveTab('constituencies');
                        setSelectedMarker(null);
                      }}
                    >
                      View Constituencies
                    </Button>
                  )}
                </div>
              ) : (
                <div className="border rounded-md p-4 h-full dark:border-gray-700 shadow-sm">
                  <h3 className="font-medium mb-2">About {activeTab === 'provinces' ? 'Provinces' : activeTab === 'constituencies' ? 'Constituencies' : 'Major Cities'}</h3>
                  
                  {activeTab === 'provinces' && (
                    <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                      <p>
                        Ireland is traditionally divided into four historic provinces: Connacht, Leinster, 
                        Munster, and Ulster. These provinces no longer serve administrative functions but
                        remain important cultural regions.
                      </p>
                      <p>
                        Click on a marker to see more information about each province.
                      </p>
                      <p>
                        Counties are color-coded by province: green for Connacht, blue for Leinster, 
                        red for Munster, and orange for Ulster.
                      </p>
                    </div>
                  )}
                  
                  {activeTab === 'constituencies' && (
                    <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                      <p>
                        Ireland's electoral system divides the country into 39 constituencies, 
                        each electing 3-5 TDs (members of parliament) to the Dáil Éireann.
                      </p>
                      <p>
                        The map shows key constituencies. Click on a marker to see more details.
                      </p>
                    </div>
                  )}
                  
                  {activeTab === 'cities' && (
                    <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                      <p>
                        Ireland's major cities serve as important political, economic and cultural centers.
                        Dublin, as the capital, contains multiple electoral constituencies.
                      </p>
                      <p>
                        Click on a city marker to see population data and more information.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Tabs>
        
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
          Map data from OpenStreetMap. Click on markers to view detailed information.
        </div>
      </CardContent>
    </Card>
  );
};

export default LeafletIrelandMap;