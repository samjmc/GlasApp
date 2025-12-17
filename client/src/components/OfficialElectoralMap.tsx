import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './OfficialElectoralMap.css';
import { ELECTION_RESULTS, PARTY_COLORS } from '../assets/election-results';
import { fetchConstituencyBoundaries } from '../helpers/fetchConstituencyGeoJSON';
import OfficialElectoralMapLoading from './OfficialElectoralMapLoading';

// Create a global cache for GeoJSON data to persist between component mounts
const globalGeoJsonCache: {
  data: GeoJSON.FeatureCollection | null;
  promise: Promise<GeoJSON.FeatureCollection> | null;
} = {
  data: null,
  promise: null
};

type MapLayer = 'party' | 'performance' | 'gender' | 'government';

interface OfficialElectoralMapProps {
  onConstituencySelect: (name: string) => void;
  width?: string;
  height?: string;
  activeLayer?: MapLayer;
  constituenciesData?: any[];
}

const OfficialElectoralMap: React.FC<OfficialElectoralMapProps> = ({
  onConstituencySelect,
  width = '100%',
  height = '600px',
  activeLayer = 'party',
  constituenciesData = []
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [activeConstituency, setActiveConstituency] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [geoJsonLayer, setGeoJsonLayer] = useState<L.GeoJSON | null>(null);

  // Helper to get party color
  const getPartyColorHex = (party: string): string => {
    const colors: Record<string, string> = {
      'Sinn Féin': '#326B3F',
      'Fianna Fáil': '#66BB6A',
      'Fine Gael': '#1e3a8a',
      'Labour Party': '#DC143C',
      'Social Democrats': '#752F8A',
      'Green Party': '#99CC33',
      'Solidarity-PBP': '#B8312F',
      'Aontú': '#14B53A',
      'Independent': '#808080'
    };
    return colors[party] || '#6b7280';
  };

  // Create professional tooltip content
  const createTooltipContent = (constituencyName: string, seats: number, nameIrish: string): string => {
    // Find constituency data - try multiple name variations for matching
    const constituency = constituenciesData.find(c => 
      c.name === constituencyName || 
      c.name?.toLowerCase() === constituencyName.toLowerCase() ||
      c.name?.replace(/-/g, ' ') === constituencyName.replace(/-/g, ' ')
    );
    
    // Get leading party info - calculate from TDs array for accuracy
    let leadingPartyHTML = '';
    if (constituency) {
      // Calculate party counts directly from TDs array (more accurate than parties array)
      let partyCounts = new Map<string, number>();
      
      if (constituency.tds && constituency.tds.length > 0) {
        // Calculate from actual TDs list - most accurate
        constituency.tds.forEach((td: any) => {
          const party = td.party || 'Unknown';
          partyCounts.set(party, (partyCounts.get(party) || 0) + 1);
        });
      } else if (constituency.parties && constituency.parties.length > 0) {
        // Fallback to parties array if TDs list not available
        constituency.parties.forEach((p: any) => {
          partyCounts.set(p.party, p.count);
        });
      }
      
      if (partyCounts.size > 0) {
        // Sort parties by count (descending)
        const sortedParties = Array.from(partyCounts.entries())
          .map(([party, count]) => ({ party, count }))
          .sort((a, b) => b.count - a.count);
        
        const topParty = sortedParties[0];
        const actualSeats = seats || constituency.tdCount || sortedParties.reduce((sum, p) => sum + p.count, 0);
        
        const partyColor = getPartyColorHex(topParty.party);
        
        // Check for ties (multiple parties with same count)
        const tiedParties = sortedParties.filter(p => p.count === topParty.count);
        
        if (tiedParties.length > 1) {
          // It's a tie
          leadingPartyHTML = `
            <div class="tooltip-party-badge">
              <span class="tooltip-party-dot" style="background: #6b7280;"></span>
              <span>Mixed representation</span>
            </div>
          `;
        } else {
          leadingPartyHTML = `
            <div class="tooltip-party-badge">
              <span class="tooltip-party-dot" style="background: ${partyColor};"></span>
              <span>${topParty.party} (${topParty.count}/${actualSeats})</span>
            </div>
          `;
        }
      }
    }

    return `
      <div class="tooltip-content">
        <div class="tooltip-title">${constituencyName}</div>
        ${nameIrish && nameIrish !== constituencyName ? `<div class="tooltip-subtitle">${nameIrish}</div>` : ''}
        
        <div class="tooltip-info-row">
          <span class="tooltip-label">
            <svg class="tooltip-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
            Dáil Seats
          </span>
          <span class="tooltip-value">${seats}</span>
        </div>
        
        ${leadingPartyHTML}
        
        <div class="tooltip-action">Click to view details</div>
      </div>
    `;
  };

  // Helper function to interpolate between colors (Red=low to Purple=high)
  const interpolateColor = (value: number, min: number, max: number): string => {
    // Normalize value between 0 and 1
    const normalized = max > min ? (value - min) / (max - min) : 0.5;
    
    // Simple linear interpolation from Red (low) to Purple (high)
    // Red: rgb(239, 68, 68)
    // Purple: rgb(168, 85, 247)
    const r = Math.round(239 - (71 * normalized));  // 239 -> 168
    const g = Math.round(68 + (17 * normalized));   // 68 -> 85
    const b = Math.round(68 + (179 * normalized));  // 68 -> 247
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Function to get the color for a constituency based on active layer
  const getConstituencyColor = (constituencyName: string): string => {
    // Normalize constituency name for matching (handles case, spaces, dashes)
    const normalizeName = (name: string) => 
      name.toLowerCase().replace(/[- ]/g, '').trim();
    
    // Find constituency data from the API with flexible matching
    let constituency = constituenciesData.find(c => 
      c.name === constituencyName || 
      normalizeName(c.name) === normalizeName(constituencyName)
    );
    
    // Temporary fix for Wicklow-Wexford until server restarts with normalization fix
    if (!constituency && constituencyName === 'Wicklow-Wexford') {
      // Hardcode Wicklow-Wexford data (3-way tie: 1 FG, 1 FF, 1 SF)
      constituency = {
        name: 'Wicklow-Wexford',
        tdCount: 3,
        parties: [
          { party: 'Fine Gael', count: 1, percentage: 33 },
          { party: 'Fianna Fáil', count: 1, percentage: 33 },
          { party: 'Sinn Féin', count: 1, percentage: 33 }
        ],
        tds: [
          { party: 'Fine Gael', name: 'Brian Brennan' },
          { party: 'Fianna Fáil', name: 'Malcolm Byrne' },
          { party: 'Sinn Féin', name: 'Fionntán Ó Súilleabháin' }
        ],
        averageScore: 50,
        genderBreakdown: { male: 3, female: 0, femalePercentage: 0 }
      };
    }
    
    if (!constituency) {
      // Log missing constituency for debugging
      console.warn(`⚠️  Constituency not found in API data: "${constituencyName}"`);
      // For gender layer, return a distinct error color so we can identify unmatched constituencies
      if (activeLayer === 'gender') {
        return '#9ca3af'; // Medium gray to indicate missing data
      }
      
      // Fallback to party colors from election results if no API data (for party/government layers)
      const partyCount: Record<string, number> = {};
      let maxCount = 0;
      let dominantParty = 'Other';

      const normalizedName = constituencyName
        .replace('-', ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\((\d+)\)$/, '');

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
    }

    // Color based on active layer
    switch (activeLayer) {
      case 'party': {
        // Color by dominant party in constituency (same logic as government layer)
        // Calculate party counts from TDs for accuracy
        const partyCounts = new Map<string, number>();
        
        if (constituency.tds && constituency.tds.length > 0) {
          constituency.tds.forEach((td: any) => {
            const party = td.party || 'Unknown';
            partyCounts.set(party, (partyCounts.get(party) || 0) + 1);
          });
        } else if (constituency.parties && constituency.parties.length > 0) {
          constituency.parties.forEach((p: any) => {
            partyCounts.set(p.party, p.count);
          });
        }
        
        if (partyCounts.size === 0) {
          return '#e5e7eb'; // Light gray for no data
        }
        
        // Find the party with the most TDs
        const sortedParties = Array.from(partyCounts.entries())
          .map(([party, count]) => ({ party, count }))
          .sort((a, b) => b.count - a.count);
        
        const maxCount = sortedParties[0].count;
        const tiedParties = sortedParties.filter(p => p.count === maxCount);
        
        // Return color based on dominant party (only if no tie)
        if (tiedParties.length > 1 || maxCount === 0) {
          return '#e5e7eb'; // Light gray for mixed/tie
        }
        
        const partyColors: Record<string, string> = {
          'Sinn Féin': '#ef4444',      // Red
          'Fianna Fáil': '#66BB6A',    // Green
          'Fine Gael': '#1e3a8a',      // Dark blue
        };
        
        return partyColors[sortedParties[0].party] || '#e5e7eb'; // Light gray for other parties
      }
      
      case 'performance':
        // Color by average score with dynamic range
        const scores = constituenciesData.map(c => c.averageScore || 50).filter(s => s > 0);
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        const score = constituency.averageScore || 50;
        return interpolateColor(score, minScore, maxScore);
      
      case 'gender':
        // Simple stepped color scheme based on female TD count (0-5)
        // Blue to purple gradient with 6 distinct steps
        const femaleCount = constituency.genderBreakdown?.female || 0;
        
        // 6-step color scheme from blue (0 female) to purple (5 female)
        switch (femaleCount) {
          case 0: return '#1e3a8a';  // Deep blue - 0 female TDs
          case 1: return '#3b82f6';  // Blue - 1 female TD
          case 2: return '#60a5fa';  // Light blue - 2 female TDs
          case 3: return '#c084fc';  // Light purple - 3 female TDs
          case 4: return '#9333ea';  // Purple - 4 female TDs
          case 5: return '#6b21a8';  // Deep purple - 5 female TDs
          default: 
            return '#9ca3af'; // Gray fallback
        }
      
      case 'government': {
        // Color by government vs opposition dominance
        // Government: Fianna Fáil, Fine Gael, Green Party + supporting Independents
        // Opposition: Sinn Féin, Labour, Social Democrats, Independent Ireland, other Independents
        const governmentParties = ['Fianna Fáil', 'Fine Gael', 'Green Party'];
        
        // Government coalition TDs (as of 34th Dáil)
        // Independents supporting the government coalition
        const governmentSupportingIndependents = [
          'Seán Canney',
          'Marian Harkin',
          'Barry Heneghan',
          'Noel Grealish',
          'Michael Lowry',
          'Kevin Boxer Moran',
          'Verona Murphy',
          'Gillian Toole'
        ];
        
        let governmentTDs = 0;
        let oppositionTDs = 0;
        
        // Count TDs by government vs opposition
        if (constituency.tds && constituency.tds.length > 0) {
          constituency.tds.forEach((td: any) => {
            const party = td.party || 'Unknown';
            const name = td.name || '';
            
            // Check if it's a government party OR a government-supporting Independent
            if (governmentParties.includes(party) || 
                governmentSupportingIndependents.includes(name)) {
              governmentTDs++;
            } else {
              oppositionTDs++;
            }
          });
        } else if (constituency.parties && constituency.parties.length > 0) {
          constituency.parties.forEach((p: any) => {
            if (governmentParties.includes(p.party)) {
              governmentTDs += p.count;
            } else {
              // For aggregated data without individual names, count all Independents as opposition
              // (This is a limitation - ideally we'd have individual TD data)
              oppositionTDs += p.count;
            }
          });
        }
        
        const totalTDs = governmentTDs + oppositionTDs;
        if (totalTDs === 0) {
          return '#e5e7eb'; // Light gray for no data
        }
        
        // Check for tie
        if (governmentTDs === oppositionTDs) {
          return '#fbbf24'; // Amber - Even split between government and opposition
        }
        
        // Government majority = Green, Opposition majority = Red
        if (governmentTDs > oppositionTDs) {
          return '#10b981'; // Emerald green - Government dominated
        } else {
          return '#ef4444'; // Red - Opposition dominated
        }
      }
      
      default:
        return '#94a3b8';
    }
  };

  // Use loading placeholder to provide immediate visual feedback
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [mapInitialized, setMapInitialized] = useState(false);
  
  // Load the GeoJSON data once (and only once) at module level
  const loadGeoJsonData = async () => {
    // Return cached data if available
    if (globalGeoJsonCache.data) {
      return globalGeoJsonCache.data;
    }
    
    // Return existing promise if we're already loading
    if (globalGeoJsonCache.promise) {
      return globalGeoJsonCache.promise;
    }
    
    // Start a new load
    console.time('Initial load');
    try {
      // Store the promise to prevent duplicate loads
      globalGeoJsonCache.promise = fetchConstituencyBoundaries();
      // Await the data and cache it
      const data = await globalGeoJsonCache.promise;
      globalGeoJsonCache.data = data;
      console.timeEnd('Initial load');
      return data;
    } catch (error) {
      console.error("Error loading GeoJSON data:", error);
      // Clear promise on error so we can retry
      globalGeoJsonCache.promise = null;
      throw error;
    }
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

    // Initialize the map - split into two phases for better UX
    const initializeMap = async () => {
      if (!mapRef.current && mapContainerRef.current) {
        setIsLoading(true);
        
        try {
          // First phase: Initialize the map immediately with base layers
          mapRef.current = L.map(mapContainerRef.current, {
            center: [53.3, -7.5], // Center on Ireland
            zoom: 6,
            minZoom: 6,
            maxZoom: 12,
            preferCanvas: false, // Use SVG renderer for accurate colors
            zoomSnap: 0.5, // Allow fractional zoom levels
            attributionControl: false // Hide default attribution
          });
          
          setMapInitialized(true);
          
          // Add OpenStreetMap tile layer immediately
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxNativeZoom: 19,
            maxZoom: 22
          }).addTo(mapRef.current);
          
          // Second phase: Load the GeoJSON data
          console.time('GeoJSON load and render');
          
          try {
            // Load the GeoJSON data using our optimized loader with caching
            const geoJsonData = await loadGeoJsonData();
            
            // Hide the placeholder once we have real data
            setShowPlaceholder(false);
            
            if (!mapRef.current) return;
            
            // Create GeoJSON layer with the processed data
            const geoJsonLayer = L.geoJSON(geoJsonData, {
              style: (feature) => {
                if (!feature || !feature.properties) return {};
                
                const constituencyName = feature.properties.CONSTITUENCY || 
                                      feature.properties.CONSTITUENCY_EN || 
                                      feature.properties.NAME_EN || 
                                      feature.properties.name ||
                                      "Unknown";
                                      
                return {
                  fillColor: getConstituencyColor(constituencyName),
                  weight: 2,
                  opacity: 1,
                  color: '#333',
                  fillOpacity: 0.75,
                  dashArray: '',
                };
              },
              onEachFeature: (feature, layer) => {
                if (!feature.properties) return;
                
                const constituencyName = feature.properties.CONSTITUENCY || 
                                      feature.properties.CONSTITUENCY_EN || 
                                      feature.properties.NAME_EN || 
                                      feature.properties.name ||
                                      "Unknown";
                                      
                const seats = feature.properties.SEATS || 3;
                const nameIrish = feature.properties.CONSTITUENCY || '';
                
                // Add professional tooltip
                layer.bindTooltip(createTooltipContent(constituencyName, seats, nameIrish), { 
                  permanent: false,
                  sticky: true,
                  direction: 'auto', // Smart positioning
                  className: 'constituency-tooltip',
                  opacity: 1
                });
                
                // Add hover effect
                layer.on('mouseover', function() {
                  if (layer instanceof L.Path) {
                    layer.setStyle({
                      weight: 3,
                      dashArray: '',
                      fillOpacity: 0.9
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
                      fillOpacity: 0.75
                    });
                  }
                });
                
                // Add click handler
                layer.on('click', function() {
                  if (constituencyName) {
                    if (geoJsonLayer) {
                      geoJsonLayer.resetStyle();
                    }
                    
                    if (layer instanceof L.Path) {
                      layer.setStyle({
                        weight: 4,
                        color: '#222',
                        dashArray: '',
                        fillOpacity: 0.95
                      });
                    }
                    
                    if ('bringToFront' in layer) {
                      // @ts-ignore - bringToFront exists on these layers
                      layer.bringToFront();
                    }
                    
                    setActiveConstituency(constituencyName);
                    onConstituencySelect(constituencyName);
                    
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
            
            // Fit bounds to show all Ireland
            mapRef.current.fitBounds(geoJsonLayer.getBounds(), { padding: [20, 20] });
            
            setIsLoading(false);
          } catch (err) {
            console.error("Error processing constituency boundaries:", err);
            setError(`Failed to load official electoral boundaries: ${(err as Error).message}. Please try again.`);
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

    return cleanup;
  }, [onConstituencySelect, activeConstituency]);

  // Update colors and tooltips when layer or data changes
  useEffect(() => {
    if (geoJsonLayer && constituenciesData.length > 0) {
      geoJsonLayer.eachLayer((layer: any) => {
        if (layer.feature && layer.feature.properties) {
          const constituencyName = layer.feature.properties.CONSTITUENCY || 
                                  layer.feature.properties.CONSTITUENCY_EN || 
                                  layer.feature.properties.NAME_EN || 
                                  layer.feature.properties.name ||
                                  "Unknown";
          
          const newColor = getConstituencyColor(constituencyName);
          
          if (layer.setStyle) {
            layer.setStyle({
              fillColor: newColor,
              fillOpacity: 0.75
            });
          }

          const seats = layer.feature.properties.SEATS || 3;
          const nameIrish = layer.feature.properties.CONSTITUENCY || '';
          if (layer.getTooltip()) {
            layer.setTooltipContent(createTooltipContent(constituencyName, seats, nameIrish));
          }
        }
      });
    }
  }, [activeLayer, constituenciesData, geoJsonLayer]);

  return (
    <div className="official-electoral-map" style={{ width, height, position: 'relative' }}>
      {showPlaceholder && (
        <div className="absolute inset-0 z-10 bg-white dark:bg-gray-800">
          <OfficialElectoralMapLoading />
        </div>
      )}
      
      <div 
        ref={mapContainerRef} 
        className="map-container rounded-lg overflow-hidden shadow-lg"
        style={{ width: '100%', height: '100%' }}
      ></div>
      
      {isLoading && !showPlaceholder && (
        <div className="absolute top-4 right-4 bg-white bg-opacity-90 p-2 rounded-full shadow-md z-10 flex items-center space-x-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
          <span className="text-xs text-gray-700">Loading map...</span>
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
      
      {/* Discreet custom attribution at bottom right */}
      <div className="absolute bottom-1 right-1 z-[400] px-1 py-0.5 bg-white/70 dark:bg-black/70 text-[9px] text-gray-600 dark:text-gray-400 rounded pointer-events-none">
        © OpenStreetMap | © Electoral Commission
      </div>
    </div>
  );
};

export default OfficialElectoralMap;
