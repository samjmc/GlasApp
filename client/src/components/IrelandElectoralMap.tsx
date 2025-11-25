import { useRef, useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// NOTE: Using public Mapbox token for demo
// For production apps, use a restricted token from environment variables
mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';

interface IrelandElectoralMapProps {
  height?: number;
}

// Ireland's Dáil constituencies (electoral districts)
const electoralConstituencies = [
  { name: "Carlow–Kilkenny", seats: 5 },
  { name: "Cavan–Monaghan", seats: 5 },
  { name: "Clare", seats: 4 },
  { name: "Cork East", seats: 4 },
  { name: "Cork North-Central", seats: 4 },
  { name: "Cork North-West", seats: 3 },
  { name: "Cork South-Central", seats: 4 },
  { name: "Cork South-West", seats: 3 },
  { name: "Donegal", seats: 5 },
  { name: "Dublin Bay North", seats: 5 },
  { name: "Dublin Bay South", seats: 4 },
  { name: "Dublin Central", seats: 4 },
  { name: "Dublin Fingal", seats: 5 },
  { name: "Dublin Mid-West", seats: 4 },
  { name: "Dublin North-West", seats: 3 },
  { name: "Dublin Rathdown", seats: 3 },
  { name: "Dublin South-Central", seats: 4 },
  { name: "Dublin South-West", seats: 5 },
  { name: "Dublin West", seats: 4 },
  { name: "Dún Laoghaire", seats: 4 },
  { name: "Galway East", seats: 3 },
  { name: "Galway West", seats: 5 },
  { name: "Kerry", seats: 5 },
  { name: "Kildare North", seats: 4 },
  { name: "Kildare South", seats: 4 },
  { name: "Laois–Offaly", seats: 5 },
  { name: "Limerick City", seats: 4 },
  { name: "Limerick County", seats: 3 },
  { name: "Longford–Westmeath", seats: 4 },
  { name: "Louth", seats: 5 },
  { name: "Mayo", seats: 4 },
  { name: "Meath East", seats: 3 },
  { name: "Meath West", seats: 3 },
  { name: "Roscommon–Galway", seats: 3 },
  { name: "Sligo–Leitrim", seats: 4 },
  { name: "Tipperary", seats: 5 },
  { name: "Waterford", seats: 4 },
  { name: "Wexford", seats: 5 },
  { name: "Wicklow", seats: 5 }
];

// Major cities coordinates for reference
const majorCities: Record<string, [number, number]> = {
  "Dublin": [-6.2603, 53.3498],
  "Cork": [-8.4956, 51.8979],
  "Galway": [-9.0567, 53.2707],
  "Limerick": [-8.6267, 52.6633],
  "Waterford": [-7.1101, 52.2583]
};

const IrelandElectoralMap = ({
  height = 600
}: IrelandElectoralMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  
  const [activeTab, setActiveTab] = useState<"constituencies" | "counties" | "provinces">("constituencies");
  const [mapInitialized, setMapInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    
    setIsLoading(true);
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11', // Lighter style for better visibility of boundaries
      center: [-7.6, 53.4], // Center of Ireland
      zoom: 6,
      minZoom: 5,
      maxZoom: 12
    });
    
    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Add fullscreen control
    map.current.addControl(new mapboxgl.FullscreenControl());
    
    // Add scale control
    map.current.addControl(new mapboxgl.ScaleControl({
      maxWidth: 200,
      unit: 'metric'
    }));
    
    // Create popup but don't add to map yet
    popup.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '300px'
    });
    
    // When map loads, add sources and layers
    map.current.on('load', () => {
      try {
        // Add a source for Ireland counties
        map.current?.addSource('ireland-counties', {
          type: 'geojson',
          data: 'https://raw.githubusercontent.com/deldersveld/topojson/master/countries/ireland/ireland-counties.json'
        });
        
        // Add a source for Ireland provinces
        map.current?.addSource('ireland-provinces', {
          type: 'geojson',
          data: 'https://raw.githubusercontent.com/deldersveld/topojson/master/countries/ireland/ireland-provinces.json'
        });
        
        // Add a source for Ireland electoral constituencies (using counties as a base - in a real app we'd use proper constituency data)
        map.current?.addSource('ireland-constituencies', {
          type: 'geojson',
          data: 'https://raw.githubusercontent.com/deldersveld/topojson/master/countries/ireland/ireland-counties.json'
        });
        
        // Add Dublin electoral districts source (for detailed view)
        map.current?.addSource('dublin-districts', {
          type: 'geojson',
          data: 'https://raw.githubusercontent.com/deldersveld/topojson/master/countries/ireland/dublin.json'
        });
        
        // Add layers for counties
        map.current?.addLayer({
          id: 'county-fills',
          type: 'fill',
          source: 'ireland-counties',
          paint: {
            'fill-color': 'rgba(180, 180, 220, 0.4)',
            'fill-outline-color': 'rgba(100, 100, 200, 0.8)'
          },
          layout: {
            'visibility': activeTab === 'counties' ? 'visible' : 'none'
          }
        });
        
        map.current?.addLayer({
          id: 'county-boundaries',
          type: 'line',
          source: 'ireland-counties',
          paint: {
            'line-color': '#627BC1',
            'line-width': 1.5
          },
          layout: {
            'visibility': activeTab === 'counties' ? 'visible' : 'none'
          }
        });
        
        // Add layers for provinces
        map.current?.addLayer({
          id: 'province-fills',
          type: 'fill',
          source: 'ireland-provinces',
          paint: {
            'fill-color': [
              'match',
              ['get', 'name'],
              'Connacht', 'rgba(102, 187, 106, 0.5)', // Green
              'Ulster', 'rgba(255, 167, 38, 0.5)',   // Orange
              'Munster', 'rgba(233, 30, 99, 0.5)',   // Pink
              'Leinster', 'rgba(33, 150, 243, 0.5)', // Blue
              'rgba(180, 180, 180, 0.4)'             // Default gray
            ],
            'fill-outline-color': 'rgba(0, 0, 0, 0.2)'
          },
          layout: {
            'visibility': activeTab === 'provinces' ? 'visible' : 'none'
          }
        });
        
        map.current?.addLayer({
          id: 'province-boundaries',
          type: 'line',
          source: 'ireland-provinces',
          paint: {
            'line-color': '#000',
            'line-width': 2
          },
          layout: {
            'visibility': activeTab === 'provinces' ? 'visible' : 'none'
          }
        });
        
        // Add layers for constituencies (using county data as placeholder)
        map.current?.addLayer({
          id: 'constituency-fills',
          type: 'fill',
          source: 'ireland-constituencies',
          paint: {
            'fill-color': 'rgba(100, 100, 200, 0.15)',
            'fill-outline-color': 'rgba(100, 100, 200, 0.8)'
          },
          layout: {
            'visibility': activeTab === 'constituencies' ? 'visible' : 'none'
          }
        });
        
        map.current?.addLayer({
          id: 'constituency-boundaries',
          type: 'line',
          source: 'ireland-constituencies',
          paint: {
            'line-color': '#3949AB',
            'line-width': 1.5,
            'line-dasharray': [2, 1]
          },
          layout: {
            'visibility': activeTab === 'constituencies' ? 'visible' : 'none'
          }
        });
        
        // Add Dublin district layers
        map.current?.addLayer({
          id: 'dublin-district-fills',
          type: 'fill',
          source: 'dublin-districts',
          paint: {
            'fill-color': 'rgba(63, 81, 181, 0.2)',
            'fill-outline-color': 'rgba(63, 81, 181, 0.8)'
          },
          layout: {
            'visibility': 'none' // Hidden by default
          }
        });
        
        map.current?.addLayer({
          id: 'dublin-district-boundaries',
          type: 'line',
          source: 'dublin-districts',
          paint: {
            'line-color': '#3F51B5',
            'line-width': 1.5
          },
          layout: {
            'visibility': 'none' // Hidden by default
          }
        });
        
        // Show Dublin districts when zoomed in
        map.current.on('zoom', () => {
          if (!map.current) return;
          
          const currentZoom = map.current.getZoom();
          const showDublinDistricts = currentZoom > 8.5;
          
          map.current.setLayoutProperty(
            'dublin-district-boundaries', 
            'visibility', 
            showDublinDistricts ? 'visible' : 'none'
          );
          
          map.current.setLayoutProperty(
            'dublin-district-fills', 
            'visibility', 
            showDublinDistricts ? 'visible' : 'none'
          );
        });
        
        // Add popups for counties/constituencies
        map.current.on('mouseenter', 'county-fills', (e) => {
          if (!map.current || !popup.current || !e.features || e.features.length === 0) return;
          
          map.current.getCanvas().style.cursor = 'pointer';
          
          const feature = e.features[0];
          const countyName = feature.properties?.name;
          
          const coordinates = e.lngLat;
          
          popup.current
            .setLngLat(coordinates)
            .setHTML(`<strong>${countyName}</strong><br>County`)
            .addTo(map.current);
        });
        
        map.current.on('mouseleave', 'county-fills', () => {
          if (!map.current || !popup.current) return;
          
          map.current.getCanvas().style.cursor = '';
          popup.current.remove();
        });
        
        // Add popups for constituencies (similar to counties in this demo)
        map.current.on('mouseenter', 'constituency-fills', (e) => {
          if (!map.current || !popup.current || !e.features || e.features.length === 0) return;
          
          map.current.getCanvas().style.cursor = 'pointer';
          
          const feature = e.features[0];
          const countyName = feature.properties?.name;
          
          // Find matching constituency (in a real app, we'd use actual constituency data)
          const matchingConstituencies = electoralConstituencies.filter(c => 
            c.name.includes(countyName) || countyName.includes(c.name.split('–')[0])
          );
          
          let popupContent = `<strong>${countyName}</strong><br>`;
          
          if (matchingConstituencies.length > 0) {
            popupContent += `<div style="margin-top: 5px;">Electoral Constituencies:</div>`;
            popupContent += `<ul style="margin-top: 2px; padding-left: 15px;">`;
            matchingConstituencies.forEach(constituency => {
              popupContent += `<li>${constituency.name} (${constituency.seats} seats)</li>`;
            });
            popupContent += `</ul>`;
          } else {
            popupContent += 'Electoral District';
          }
          
          const coordinates = e.lngLat;
          
          popup.current
            .setLngLat(coordinates)
            .setHTML(popupContent)
            .addTo(map.current);
        });
        
        map.current.on('mouseleave', 'constituency-fills', () => {
          if (!map.current || !popup.current) return;
          
          map.current.getCanvas().style.cursor = '';
          popup.current.remove();
        });
        
        // Add popups for provinces
        map.current.on('mouseenter', 'province-fills', (e) => {
          if (!map.current || !popup.current || !e.features || e.features.length === 0) return;
          
          map.current.getCanvas().style.cursor = 'pointer';
          
          const feature = e.features[0];
          const provinceName = feature.properties?.name;
          
          const coordinates = e.lngLat;
          
          popup.current
            .setLngLat(coordinates)
            .setHTML(`<strong>${provinceName}</strong><br>Province`)
            .addTo(map.current);
        });
        
        map.current.on('mouseleave', 'province-fills', () => {
          if (!map.current || !popup.current) return;
          
          map.current.getCanvas().style.cursor = '';
          popup.current.remove();
        });
        
        // Add city markers
        Object.entries(majorCities).forEach(([city, coords]) => {
          if (!map.current) return;
          
          // Create a custom marker element
          const markerEl = document.createElement('div');
          markerEl.className = 'city-marker';
          markerEl.style.width = '10px';
          markerEl.style.height = '10px';
          markerEl.style.borderRadius = '50%';
          markerEl.style.backgroundColor = '#d32f2f';
          markerEl.style.border = '2px solid white';
          markerEl.style.boxShadow = '0 1px 3px rgba(0,0,0,0.4)';
          
          // Add the marker to the map
          const marker = new mapboxgl.Marker(markerEl)
            .setLngLat(coords)
            .setPopup(new mapboxgl.Popup({ offset: 10 }).setText(city))
            .addTo(map.current);
        });
        
        setMapInitialized(true);
      } catch (err) {
        console.error("Error initializing map:", err);
      } finally {
        setIsLoading(false);
      }
    });
    
    // Cleanup function
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);
  
  // Update layer visibility when the active tab changes
  useEffect(() => {
    if (!map.current || !mapInitialized) return;
    
    // Update visibility for county layers
    map.current.setLayoutProperty(
      'county-fills', 
      'visibility', 
      activeTab === 'counties' ? 'visible' : 'none'
    );
    
    map.current.setLayoutProperty(
      'county-boundaries', 
      'visibility', 
      activeTab === 'counties' ? 'visible' : 'none'
    );
    
    // Update visibility for province layers
    map.current.setLayoutProperty(
      'province-fills', 
      'visibility', 
      activeTab === 'provinces' ? 'visible' : 'none'
    );
    
    map.current.setLayoutProperty(
      'province-boundaries', 
      'visibility', 
      activeTab === 'provinces' ? 'visible' : 'none'
    );
    
    // Update visibility for constituency layers
    map.current.setLayoutProperty(
      'constituency-fills', 
      'visibility', 
      activeTab === 'constituencies' ? 'visible' : 'none'
    );
    
    map.current.setLayoutProperty(
      'constituency-boundaries', 
      'visibility', 
      activeTab === 'constituencies' ? 'visible' : 'none'
    );
    
  }, [activeTab, mapInitialized]);
  
  return (
    <Card className="bg-white dark:bg-gray-800 shadow-md overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">Map of Ireland</CardTitle>
          <Badge variant="outline" className="ml-2">
            Interactive
          </Badge>
        </div>
        <CardDescription>
          Explore Ireland's electoral divisions, counties, and provinces
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs 
          defaultValue="constituencies" 
          className="w-full" 
          onValueChange={(v) => setActiveTab(v as any)}
          value={activeTab}
        >
          <TabsList className="mb-4">
            <TabsTrigger value="constituencies">Electoral Constituencies</TabsTrigger>
            <TabsTrigger value="counties">Counties</TabsTrigger>
            <TabsTrigger value="provinces">Provinces</TabsTrigger>
          </TabsList>
          
          <TabsContent value="constituencies" className="mt-0">
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Ireland has 39 Dáil constituencies that elect 160 TDs (members of parliament).
              <div className="mt-2">
                <span className="font-medium">Note:</span> Zoom in on Dublin to see more detailed electoral divisions.
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="counties" className="mt-0">
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Ireland has 32 counties across the island, with 26 in the Republic of Ireland and 6 in Northern Ireland.
            </div>
          </TabsContent>
          
          <TabsContent value="provinces" className="mt-0">
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Ireland has four historic provinces: Connacht (west), Leinster (east), Munster (south), and Ulster (north).
            </div>
          </TabsContent>
          
          <div style={{ height: `${height}px`, position: "relative", marginTop: "1rem" }}>
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Loading map data...</p>
                </div>
              </div>
            ) : (
              <div 
                ref={mapContainer} 
                className="w-full h-full rounded-md overflow-hidden shadow-inner"
              />
            )}
          </div>
        </Tabs>
        
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
          Interactive map showing Ireland's electoral divisions. Hover over areas to see details.
        </div>
      </CardContent>
    </Card>
  );
};

export default IrelandElectoralMap;