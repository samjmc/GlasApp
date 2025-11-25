import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchConstituencyBoundaries } from '../helpers/fetchConstituencyGeoJSON';

// Generates representative opinion data for visualization purposes
// In a production app, this would be replaced with real user poll data
const getMockOpinionData = (topic: string) => {
  // List of counties in Ireland
  const counties = [
    'Dublin', 'Cork', 'Galway', 'Kerry', 'Mayo', 'Donegal', 'Limerick',
    'Waterford', 'Tipperary', 'Clare', 'Wexford', 'Kilkenny', 'Wicklow',
    'Meath', 'Louth', 'Kildare', 'Carlow', 'Laois', 'Offaly', 'Westmeath',
    'Longford', 'Cavan', 'Monaghan', 'Roscommon', 'Sligo', 'Leitrim'
  ];

  // Topic-specific patterns to create interesting and believable opinion distributions
  // Different topics have different regional trends
  let baseValues: Record<string, number> = {};
  
  switch(topic) {
    case 'immigration':
      // Urban areas tend to be more supportive, rural less so
      baseValues = {
        'Dublin': 0.68, 'Cork': 0.62, 'Galway': 0.65, 'Waterford': 0.58,
        'Limerick': 0.57, 'Kildare': 0.60, 'Wicklow': 0.63, 'Louth': 0.54,
        'Meath': 0.52, 'Donegal': 0.40, 'Kerry': 0.38, 'Mayo': 0.42,
        'Sligo': 0.44, 'Leitrim': 0.38, 'Cavan': 0.36, 'Monaghan': 0.35,
        'Roscommon': 0.41, 'Longford': 0.40, 'Westmeath': 0.49, 'Offaly': 0.45,
        'Laois': 0.47, 'Carlow': 0.52, 'Kilkenny': 0.48, 'Wexford': 0.46,
        'Clare': 0.50, 'Tipperary': 0.45
      };
      break;
      
    case 'healthcare':
      // More universal support with small regional variations
      baseValues = {
        'Dublin': 0.72, 'Cork': 0.75, 'Galway': 0.77, 'Waterford': 0.79,
        'Limerick': 0.76, 'Kildare': 0.72, 'Wicklow': 0.71, 'Louth': 0.74,
        'Meath': 0.73, 'Donegal': 0.81, 'Kerry': 0.78, 'Mayo': 0.80,
        'Sligo': 0.82, 'Leitrim': 0.83, 'Cavan': 0.80, 'Monaghan': 0.79,
        'Roscommon': 0.82, 'Longford': 0.81, 'Westmeath': 0.76, 'Offaly': 0.77,
        'Laois': 0.75, 'Carlow': 0.74, 'Kilkenny': 0.76, 'Wexford': 0.77,
        'Clare': 0.78, 'Tipperary': 0.79
      };
      break;
      
    case 'housing':
      // Stronger support in urban areas with housing crises
      baseValues = {
        'Dublin': 0.85, 'Cork': 0.82, 'Galway': 0.80, 'Waterford': 0.72,
        'Limerick': 0.75, 'Kildare': 0.78, 'Wicklow': 0.79, 'Louth': 0.72,
        'Meath': 0.76, 'Donegal': 0.63, 'Kerry': 0.65, 'Mayo': 0.62,
        'Sligo': 0.64, 'Leitrim': 0.60, 'Cavan': 0.61, 'Monaghan': 0.59,
        'Roscommon': 0.58, 'Longford': 0.56, 'Westmeath': 0.65, 'Offaly': 0.62,
        'Laois': 0.64, 'Carlow': 0.67, 'Kilkenny': 0.65, 'Wexford': 0.68,
        'Clare': 0.66, 'Tipperary': 0.64
      };
      break;
      
    case 'environment':
      // Mixed support with coastal areas more concerned
      baseValues = {
        'Dublin': 0.70, 'Cork': 0.72, 'Galway': 0.74, 'Waterford': 0.73,
        'Limerick': 0.68, 'Kildare': 0.64, 'Wicklow': 0.71, 'Louth': 0.69,
        'Meath': 0.63, 'Donegal': 0.73, 'Kerry': 0.75, 'Mayo': 0.72,
        'Sligo': 0.71, 'Leitrim': 0.62, 'Cavan': 0.58, 'Monaghan': 0.56,
        'Roscommon': 0.59, 'Longford': 0.55, 'Westmeath': 0.61, 'Offaly': 0.57,
        'Laois': 0.58, 'Carlow': 0.61, 'Kilkenny': 0.63, 'Wexford': 0.72,
        'Clare': 0.74, 'Tipperary': 0.62
      };
      break;
      
    case 'education':
      // Generally high support across the country
      baseValues = {
        'Dublin': 0.78, 'Cork': 0.80, 'Galway': 0.82, 'Waterford': 0.79,
        'Limerick': 0.81, 'Kildare': 0.77, 'Wicklow': 0.76, 'Louth': 0.74,
        'Meath': 0.75, 'Donegal': 0.73, 'Kerry': 0.76, 'Mayo': 0.74,
        'Sligo': 0.77, 'Leitrim': 0.72, 'Cavan': 0.71, 'Monaghan': 0.70,
        'Roscommon': 0.71, 'Longford': 0.70, 'Westmeath': 0.75, 'Offaly': 0.74,
        'Laois': 0.76, 'Carlow': 0.78, 'Kilkenny': 0.77, 'Wexford': 0.75,
        'Clare': 0.76, 'Tipperary': 0.77
      };
      break;
      
    default:
      // Create a balanced distribution as fallback
      counties.forEach(county => {
        baseValues[county] = 0.5 + (Math.random() * 0.3 - 0.15);
      });
  }
  
  // Add small variations to make the data look more natural
  // This simulates individual variations in opinion
  return counties.reduce((acc, county) => {
    const baseValue = baseValues[county] || 0.5;
    // Add a small random variation (±0.05)
    const value = Math.max(0.1, Math.min(0.9, baseValue + (Math.random() * 0.1 - 0.05)));
    acc[county] = value;
    return acc;
  }, {} as Record<string, number>);
};

// Helper function to convert numeric value to color
const getColorForValue = (value: number): string => {
  // Interpolate between yellow (support) and purple (opposition)
  // Value should be between 0-1
  const r = Math.round(244 - (244 - 167) * (1 - value));
  const g = Math.round(224 - (224 - 139) * (1 - value));
  const b = Math.round(77 + (250 - 77) * (1 - value));
  
  return `rgb(${r}, ${g}, ${b})`;
};

interface HeatmapIrelandMapProps {
  topic: string;
  width?: string;
  height?: string;
}

const HeatmapIrelandMap: React.FC<HeatmapIrelandMapProps> = ({
  topic,
  width = '100%',
  height = '600px'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [geoJsonLayer, setGeoJsonLayer] = useState<L.GeoJSON | null>(null);
  const [opinionData, setOpinionData] = useState<Record<string, number>>({});

  // Load opinion data when topic changes
  useEffect(() => {
    const data = getMockOpinionData(topic);
    setOpinionData(data);
    
    // Update map colors if GeoJSON layer exists
    if (geoJsonLayer && mapRef.current) {
      geoJsonLayer.eachLayer((layer) => {
        if (layer instanceof L.Path && 'feature' in layer && layer.feature && layer.feature.properties) {
          // Extract constituency name from properties
          const constituencyName = layer.feature.properties.CONSTITUENCY || 
                                layer.feature.properties.CONSTITUENCY_EN || 
                                layer.feature.properties.NAME_EN || 
                                "Unknown";
                                
          const regionName = getCountyFromConstituency(constituencyName);
          const value = data[regionName] || 0.5; // Default to neutral if no data
          
          layer.setStyle({
            fillColor: getColorForValue(value),
            weight: 1.5,
            opacity: 0.8,
            color: '#555',
            fillOpacity: 0.7
          });
        }
      });
    }
  }, [topic]);

  // Initialize map and data
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    // Clean up function
    const cleanup = () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };

    // Extract county from constituency name
    const getCountyFromName = (name: string): string => {
      const parts = name.split(' ');
      return parts[0]; // Usually the county name is the first part
    };

    // Initialize the map
    const initializeMap = async () => {
      if (!mapRef.current && mapContainerRef.current) {
        setIsLoading(true);
        
        try {
          // Initialize opinion data
          const data = getMockOpinionData(topic);
          setOpinionData(data);
          
          // Initialize the map
          mapRef.current = L.map(mapContainerRef.current, {
            center: [53.3, -7.5], // Center on Ireland
            zoom: 7,
            minZoom: 6,
            maxZoom: 11,
            scrollWheelZoom: true,
            zoomControl: true
          });

          // Add OpenStreetMap base layer
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxNativeZoom: 19,
            maxZoom: 22
          }).addTo(mapRef.current);
          
          try {
            // Load boundary data using the same function as the main map
            const boundaryData = await fetchConstituencyBoundaries();
            
            if (!mapRef.current) return;
            
            // Create GeoJSON layer with the processed data
            const geoJsonLayer = L.geoJSON(boundaryData, {
              style: (feature) => {
                if (!feature || !feature.properties) return {};
                
                // Extract constituency name from properties - match the format from the Electoral Commission data
                const constituencyName = feature.properties.CONSTITUENCY || 
                                      feature.properties.CONSTITUENCY_EN || 
                                      feature.properties.NAME_EN || 
                                      "Unknown";
                
                const regionName = getCountyFromConstituency(constituencyName);
                const value = data[regionName] || 0.5; // Default to neutral if no data
                
                return {
                  fillColor: getColorForValue(value),
                  weight: 1.5,
                  opacity: 0.8,
                  color: '#555',
                  fillOpacity: 0.7
                };
              },
              onEachFeature: (feature, layer) => {
                if (!feature.properties) return;
                
                // Extract constituency name from properties
                const constituencyName = feature.properties.CONSTITUENCY || 
                                      feature.properties.CONSTITUENCY_EN || 
                                      feature.properties.NAME_EN || 
                                      "Unknown";
                                      
                const regionName = getCountyFromConstituency(constituencyName);
                const value = data[regionName] || 0.5;
                const percentage = Math.round(value * 100);
                
                // Create tooltip content
                const tooltipContent = `
                  <div style="text-align: center; padding: 5px;">
                    <strong>${constituencyName}</strong><br>
                    <span style="color: ${percentage > 50 ? '#8B5D33' : '#594180'}">
                      ${percentage}% ${percentage > 50 ? 'Support' : 'Opposition'}
                    </span>
                  </div>
                `;
                
                // Add tooltip
                layer.bindTooltip(tooltipContent, { 
                  permanent: false, 
                  direction: 'center',
                  className: 'heatmap-tooltip',
                  opacity: 0.9
                });
                
                // Add hover effect
                layer.on('mouseover', function() {
                  if (layer instanceof L.Path) {
                    layer.setStyle({
                      weight: 3,
                      opacity: 1,
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
                  if (layer instanceof L.Path) {
                    layer.setStyle({
                      weight: 1.5,
                      opacity: 0.8,
                      fillOpacity: 0.7
                    });
                  }
                });
              }
            }).addTo(mapRef.current);
            
            setGeoJsonLayer(geoJsonLayer);
            setIsLoading(false);
          } catch (err) {
            console.error("Error processing heatmap data:", err);
            setError(`Failed to load map data: ${(err as Error).message}. Please try again.`);
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
  }, [topic]);

  return (
    <div className="heatmap-ireland-map" style={{ width, height, position: 'relative' }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
            <div className="mt-2">Loading opinion data...</div>
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
        className="map-container rounded-lg overflow-hidden shadow-lg" 
        style={{ width: '100%', height: '100%' }}
      ></div>
      
      {/* Map controls - zoom in/out buttons will be added by Leaflet */}
      
      {/* Information overlay */}
      <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 p-3 rounded shadow-md text-xs z-5 hidden md:block">
        <div className="font-bold mb-1">Opinion Heatmap</div>
        <div className="text-gray-600 text-xs">
          Yellow: Support | Purple: Opposition
        </div>
      </div>
    </div>
  );
};

// Helper function to extract county from constituency name
function getCountyFromConstituency(constituencyName: string): string {
  // Extract the first word which is usually the county name
  const parts = constituencyName.split(' ');
  return parts[0];
}

export default HeatmapIrelandMap;