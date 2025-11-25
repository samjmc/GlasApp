import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ELECTION_RESULTS, PARTY_COLORS } from '../assets/election-results';
import { fetchConstituencyBoundaries, processGeoJSON } from '../helpers/fetchConstituencyGeoJSON';

interface OfficialConstituencyMapProps {
  onConstituencySelect: (name: string) => void;
  width?: string;
  height?: string;
}

const OfficialConstituencyMap: React.FC<OfficialConstituencyMapProps> = ({
  onConstituencySelect,
  width = '100%',
  height = '600px'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [activeConstituency, setActiveConstituency] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [geoJsonLayer, setGeoJsonLayer] = useState<L.GeoJSON | null>(null);

  // Function to get the dominant party color for a constituency
  const getConstituencyColor = (constituencyName: string): string => {
    const partyCount: Record<string, number> = {};
    let maxCount = 0;
    let dominantParty = 'Other';

    // Normalize constituency name to match our election results data format
    const normalizedName = constituencyName.replace('-', ' ').replace(/\s+/g, ' ').trim();

    // Count the occurrences of each party in the constituency
    for (let i = 1; i <= 5; i++) {
      const key = `${normalizedName}${i}`;
      if (ELECTION_RESULTS[key]) {
        const party = ELECTION_RESULTS[key];
        partyCount[party] = (partyCount[party] || 0) + 1;
        
        if (partyCount[party] > maxCount) {
          maxCount = partyCount[party];
          dominantParty = party;
        }
      }
    }

    return PARTY_COLORS[dominantParty] || PARTY_COLORS['Other'];
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    // Clean up function
    const cleanup = () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };

    // Initialize the map if it hasn't been initialized yet
    const initializeMap = async () => {
      if (!mapRef.current && mapContainerRef.current) {
        setIsLoading(true);
        
        try {
          // Initialize the map
          mapRef.current = L.map(mapContainerRef.current, {
            center: [53.3, -7.5],
            zoom: 7,
            minZoom: 6,
            maxZoom: 12,
          });

          // Add OpenStreetMap tile layer with maxNativeZoom to prevent excessive loading
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxNativeZoom: 19, // Maximum zoom level for tiles
            maxZoom: 22 // Maximum zoom level for the map
          }).addTo(mapRef.current);
          
          try {
            // Fetch GeoJSON data from external source (in WGS84/EPSG:4326 format)
            const geoJsonData = await fetchConstituencyBoundaries();
            const processedData = processGeoJSON(geoJsonData);
            
            if (!mapRef.current) return;
            
            // Create GeoJSON layer with the fetched data
            const geoJsonLayer = L.geoJSON(processedData, {
              style: (feature) => {
                if (!feature || !feature.properties) return {};
                
                const constituencyName = feature.properties.name;
                return {
                  fillColor: getConstituencyColor(constituencyName),
                  weight: 2,
                  opacity: 1,
                  color: '#333',
                  fillOpacity: 0.6,
                  dashArray: '',
                };
              },
              onEachFeature: (feature, layer) => {
                if (!feature.properties) return;
                
                const constituencyName = feature.properties.name;
                let seats = feature.properties.seats || 3; // Default to 3 if not specified
                const population = feature.properties.population?.toLocaleString() || 'N/A';
                
                // Add tooltip
                layer.bindTooltip(`
                  <div style="text-align: center; padding: 5px;">
                    <strong>${constituencyName}</strong>
                    <br>
                    ${seats} seats | Tap for details
                  </div>
                `, { 
                  permanent: false, 
                  direction: 'center',
                  className: 'constituency-tooltip',
                  opacity: 0.9
                });
                
                // Add hover effect for non-touch devices
                layer.on('mouseover', function() {
                  if (layer instanceof L.Path) {
                    layer.setStyle({
                      weight: 3,
                      dashArray: '',
                      fillOpacity: 0.8
                    });
                  }
                  if ('bringToFront' in layer) {
                    // @ts-ignore - bringToFront exists on these layers
                    layer.bringToFront();
                  }
                });
                
                // Reset style on mouseout
                layer.on('mouseout', function() {
                  if (layer instanceof L.Path && constituencyName !== activeConstituency) {
                    layer.setStyle({
                      weight: 2,
                      dashArray: '',
                      fillOpacity: 0.6
                    });
                  }
                });
                
                // Add click handler
                layer.on('click', function() {
                  if (constituencyName) {
                    // Reset all styles first
                    if (geoJsonLayer) {
                      geoJsonLayer.resetStyle();
                    }
                    
                    // Highlight selected constituency
                    if (layer instanceof L.Path) {
                      layer.setStyle({
                        weight: 4,
                        color: '#222',
                        dashArray: '',
                        fillOpacity: 0.8
                      });
                    }
                    
                    if ('bringToFront' in layer) {
                      // @ts-ignore - bringToFront exists on these layers
                      layer.bringToFront();
                    }
                    
                    // Update state and call the callback
                    setActiveConstituency(constituencyName);
                    onConstituencySelect(constituencyName);
                    
                    // Pan to the constituency
                    if (mapRef.current && 'getBounds' in layer && typeof layer.getBounds === 'function') {
                      // @ts-ignore - getBounds exists on these layers
                      mapRef.current.fitBounds(layer.getBounds(), { 
                        padding: [50, 50],
                        maxZoom: 10
                      });
                    }
                  }
                });
              }
            }).addTo(mapRef.current);
            
            setGeoJsonLayer(geoJsonLayer);
            setIsLoading(false);
          } catch (err) {
            console.error("Error processing GeoJSON data:", err);
            setError(`Failed to load constituency boundaries: ${(err as Error).message}. Please try again.`);
            setIsLoading(false);
          }
        } catch (err) {
          const error = err as Error;
          console.error("Error initializing map:", error);
          setError(`Failed to initialize map: ${error.message}`);
          setIsLoading(false);
        }
      }
    };

    initializeMap();

    // Clean up on component unmount
    return cleanup;
  }, [onConstituencySelect, activeConstituency]);

  return (
    <div className="official-constituency-map" style={{ width, height, position: 'relative' }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
            <div className="mt-2">Loading electoral boundary data...</div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
          <div className="text-center text-red-600 p-4 bg-white rounded shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-red-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="font-bold">Error Loading Map</div>
            <div className="text-sm mt-1">{error}</div>
          </div>
        </div>
      )}
      
      <div 
        ref={mapContainerRef} 
        className="map-container" 
        style={{ width: '100%', height: '100%' }}
      ></div>
      
      {/* Map overlay */}
      <div className="absolute bottom-4 right-4 bg-white bg-opacity-90 p-3 rounded shadow-md text-xs z-5 hidden md:block">
        <div className="font-bold mb-1">Irish Electoral Constituencies</div>
        <div className="text-gray-600 text-xs mb-1">Click on a constituency for details</div>
      </div>
    </div>
  );
};

export default OfficialConstituencyMap;