import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { electoralConstituencies } from '../assets/electoral-data';
import { constituencyData } from '../assets/constituency-simplified';
import { ElectoralDistrictDetailView } from '../components/ElectoralDistrictDetailView';
import 'leaflet/dist/leaflet.css';

// We need to use dynamic import for Leaflet since it requires window object
// which doesn't exist during server-side rendering
let L: any;

const ElectoralDistrictsPage: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [selectedConstituency, setSelectedConstituency] = useState<string | null>(null);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const electoralGroup = useRef<any>(null);

  useEffect(() => {
    const initializeLeaflet = async () => {
      try {
        // Import Leaflet dynamically
        const leaflet = await import('leaflet');
        L = leaflet;

        if (!isMapInitialized && mapRef.current) {
          // Initialize the map
          const map = L.map(mapRef.current, {
            center: [53.4, -8.3], // Center of Ireland
            zoom: 7,
            minZoom: 6,
            maxZoom: 10,
            zoomControl: true,
            attributionControl: true
          });

          // Add OpenStreetMap tiles
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }).addTo(map);

          // Save map instance
          mapInstanceRef.current = map;
          
          // Create a layer group for electoral constituencies
          electoralGroup.current = L.layerGroup().addTo(map);
          
          // Style for electoral constituencies
          const electoralStyle = {
            color: '#3366cc',
            weight: 2,
            opacity: 0.6,
            fillColor: '#3366cc',
            fillOpacity: 0.15,
            dashArray: '4'
          };
          
          // Add electoral constituency boundaries
          L.geoJSON(electoralConstituencies as any, {
            style: () => electoralStyle,
            onEachFeature: (feature: any, layer: any) => {
              const constituencyName = feature?.properties?.CONSTITUENCY || '';
              const seats = feature?.properties?.SEATS || '?';
              
              // Add popup with constituency name and seats
              layer.bindPopup(`<strong>${constituencyName}</strong><br>Seats: ${seats}`);
              
              // Add hover effect
              layer.on({
                mouseover: (e: any) => {
                  const targetLayer = e.target;
                  targetLayer.setStyle({
                    weight: 3,
                    fillOpacity: 0.3
                  });
                  targetLayer.bringToFront();
                },
                mouseout: (e: any) => {
                  const targetLayer = e.target;
                  targetLayer.setStyle(electoralStyle);
                },
                click: (e: any) => {
                  map.fitBounds(e.target.getBounds());
                  setSelectedConstituency(constituencyName);
                }
              });
            }
          }).addTo(electoralGroup.current);
          
          setIsMapInitialized(true);
        }
      } catch (error) {
        console.error('Error initializing Leaflet map:', error);
      }
    };
    
    initializeLeaflet();
    
    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setIsMapInitialized(false);
      }
    };
  }, [isMapInitialized]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-6">Ireland Electoral Districts</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="shadow-lg">
            <CardHeader className="bg-blue-700 text-white">
              <CardTitle className="flex justify-between items-center">
                <span>Electoral Constituencies</span>
                <Select 
                  onValueChange={(value) => setSelectedConstituency(value)}
                  value={selectedConstituency || undefined}
                >
                  <SelectTrigger className="w-[200px] bg-white text-black">
                    <SelectValue placeholder="Select Constituency" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(constituencyData).map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div 
                ref={mapRef} 
                className="h-[500px] w-full bg-slate-100"
              ></div>
            </CardContent>
          </Card>
        </div>
        
        <div>
          {selectedConstituency && constituencyData[selectedConstituency] ? (
            <ElectoralDistrictDetailView 
              constituencyName={selectedConstituency}
              constituencyData={constituencyData[selectedConstituency]}
            />
          ) : (
            <Card className="shadow-lg">
              <CardHeader className="bg-blue-700 text-white">
                <CardTitle>Constituency Information</CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-center">
                <div className="py-12">
                  <h3 className="text-xl font-medium mb-2">Select a constituency</h3>
                  <p className="text-gray-600">
                    Click on any constituency on the map or use the dropdown menu to view detailed information.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          
          <div className="mt-6">
            <Card className="shadow-lg">
              <CardHeader className="bg-blue-700 text-white">
                <CardTitle>General Election Statistics</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-r pr-4">
                    <h3 className="text-lg font-medium mb-1">Constituencies</h3>
                    <span className="text-2xl font-bold">43</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium mb-1">Total Seats</h3>
                    <span className="text-2xl font-bold">174</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElectoralDistrictsPage;