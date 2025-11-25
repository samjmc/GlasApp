import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';

interface HeatmapPoint {
  lat: number;
  lng: number;
  value: number;
}

interface GridHeatmapProps {
  width?: string | number;
  height?: number;
  cellSize?: number; // Cell size in kilometers
  title?: string;
}

const GridHeatmap: React.FC<GridHeatmapProps> = ({
  width = '100%',
  height = 500,
  cellSize = 10, // Default to 10km cells
  title = 'Political Opinion Heatmap'
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gridLayer, setGridLayer] = useState<L.GeoJSON | null>(null);
  
  // Load and initialize the map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    const initMap = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Initialize map if it doesn't exist
        if (!mapRef.current && mapContainerRef.current) {
          // Center on Republic of Ireland (adjusted to focus on ROI)
          const centerLat = 53.2;
          const centerLng = -7.6;
          
          // Create Leaflet map with options to ensure proper square cells
          mapRef.current = L.map(mapContainerRef.current, { 
            // Disable zoom animation for smoother transitions
            zoomAnimation: false,
            // Use Mercator projection to maintain proper square shapes
            crs: L.CRS.EPSG3857
          }).setView([centerLat, centerLng], 7);
          
          // Add OpenStreetMap tiles
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }).addTo(mapRef.current);
        }
        
        // Load heatmap data from the server
        try {
          const response = await fetch('/api/heatmap');
          if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
          }
          
          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.message || 'Failed to load heatmap data');
          }
          
          const points: HeatmapPoint[] = result.data;
          
          // If we have no data points, show a message
          if (points.length === 0) {
            setError('No location data available yet. As users register with location data, the heatmap will populate.');
            setIsLoading(false);
            return;
          }
          
          // Create a 10km grid covering Republic of Ireland only (excluding Northern Ireland)
          const irelandBbox = [-10.6, 51.3, -5.3, 54.5] as [number, number, number, number]; // [minX, minY, maxX, maxY] - Lowered max latitude to exclude Northern Ireland
          const grid = turf.squareGrid(irelandBbox, cellSize, { units: 'kilometers' });
          
          // Create a collection of points from our heatmap data
          const pointFeatures = points.map(p => 
            turf.point([p.lng, p.lat], { value: p.value })
          );
          const pointsCollection = turf.featureCollection(pointFeatures);
          
          // Calculate the counts for each grid cell
          grid.features.forEach(cell => {
            if (cell) {
              const pointsWithin = turf.pointsWithinPolygon(pointsCollection, cell);
              cell.properties = cell.properties || {};
              cell.properties.count = pointsWithin.features.length;
              
              // Calculate density (normalize from 0-1)
              const maxCount = Math.max(...grid.features.map(f => f?.properties?.count || 0));
              cell.properties.density = maxCount > 0 ? cell.properties.count / maxCount : 0;
            }
          });
          
          // Remove any existing grid layer
          if (gridLayer && mapRef.current) {
            mapRef.current.removeLayer(gridLayer);
          }
          
          // Create and add the grid layer to the map
          const newGridLayer = L.geoJSON(grid, {
            style: (feature) => {
              if (!feature) return { weight: 0.5, color: '#666', fillColor: '#cccccc', fillOpacity: 0.1 };
              
              const count = feature.properties?.count || 0;
              const density = feature.properties?.density || 0;
              
              // New, easier to understand color scale (green to yellow to red)
              const color = density === 0 
                ? '#f5f5f5' // very light gray for empty cells
                : density < 0.2 
                  ? '#e6f5d0' // very light green
                  : density < 0.4 
                    ? '#a1d76a' // light green
                    : density < 0.6 
                      ? '#fdae61' // yellow/orange
                      : density < 0.8 
                        ? '#f46d43' // orange/red
                        : '#d73027'; // dark red
              
              return {
                weight: 0,  // Remove the outline by setting weight to 0
                color: 'transparent',
                fillColor: color,
                fillOpacity: count > 0 ? 0.7 : 0.1
              };
            },
            onEachFeature: (feature, layer) => {
              if (feature) {
                const count = feature.properties?.count || 0;
                layer.bindTooltip(
                  count > 0 
                    ? `${count} user${count !== 1 ? 's' : ''} in this area`
                    : 'No users in this area', 
                  { sticky: true }
                );
              }
            }
          });
          
          if (mapRef.current) {
            newGridLayer.addTo(mapRef.current);
            setGridLayer(newGridLayer);
          }
          
          setIsLoading(false);
        } catch (err) {
          console.error("Error fetching or processing heatmap data:", err);
          setError(`Failed to load heatmap data: ${(err as Error).message}`);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error initializing map:", err);
        setError(`Failed to initialize map: ${(err as Error).message}`);
        setIsLoading(false);
      }
    };
    
    initMap();
    
    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [cellSize]); // Re-run if cell size changes
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pt-0 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
            <div className="text-center">
              <Skeleton className="h-12 w-12 rounded-full mx-auto" />
              <div className="mt-2">Loading heatmap data...</div>
            </div>
          </div>
        )}
        
        {error && (
          <Alert variant="destructive" className="m-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div 
          ref={mapContainerRef} 
          className="map-container rounded-b-lg overflow-hidden" 
          style={{ height, width }}
        />
      </CardContent>
    </Card>
  );
};

export default GridHeatmap;