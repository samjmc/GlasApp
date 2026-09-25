import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './OfficialElectoralMap.css';
import { ELECTION_RESULTS } from '../assets/election-results';
import { fetchConstituencyBoundaries } from '../helpers/fetchConstituencyGeoJSON';
import OfficialElectoralMapLoading from './OfficialElectoralMapLoading';
import { AlertTriangle } from 'lucide-react';
import { partyStyle } from '@/lib/parties';

/**
 * Leaflet writes colours into SVG attributes, where CSS variables do not resolve,
 * so theme tokens (stored as "H S% L%") are read and turned into hsl() strings.
 */
function token(name: string, alpha = 1): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value ? `hsl(${value} / ${alpha})` : 'currentColor';
}

// Create a global cache for GeoJSON data to persist between component mounts
const globalGeoJsonCache: {
  data: GeoJSON.FeatureCollection | null;
  promise: Promise<GeoJSON.FeatureCollection> | null;
} = {
  data: null,
  promise: null
};

type MapLayer = 'party' | 'performance' | 'gender' | 'government';

interface ConstituencyPartyData {
  party: string;
  count: number;
  percentage?: number;
}

interface ConstituencyTD {
  party?: string | null;
  name?: string;
}

interface ConstituencyData {
  name?: string;
  tdCount?: number;
  parties?: ConstituencyPartyData[];
  tds?: ConstituencyTD[];
  averageScore?: number | null;
  genderBreakdown?: { male?: number; female?: number; femalePercentage?: number };
}

interface ConstituencyGeoJsonLayer {
  feature?: {
    properties?: {
      CONSTITUENCY?: string;
      CONSTITUENCY_EN?: string;
      NAME_EN?: string;
      name?: string;
      SEATS?: number;
    };
  };
  setStyle?: (style: L.PathOptions) => void;
  getTooltip?: () => unknown;
  setTooltipContent?: (content: string) => void;
}

interface OfficialElectoralMapProps {
  onConstituencySelect: (name: string) => void;
  width?: string;
  height?: string;
  activeLayer?: MapLayer;
  constituenciesData?: ConstituencyData[];
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

  const getPartyColorHex = (party: string): string => partyStyle(party).dot;

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
        constituency.tds.forEach((td) => {
          const party = td.party || 'Unknown';
          partyCounts.set(party, (partyCounts.get(party) || 0) + 1);
        });
      } else if (constituency.parties && constituency.parties.length > 0) {
        // Fallback to parties array if TDs list not available
        constituency.parties.forEach((p) => {
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
              <span class="tooltip-party-dot" style="background: ${partyStyle(null).dot};"></span>
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

  // Score colour follows the app-wide rule (lib/score): >=80 high, 50-79 mid, <50 low.
  const scoreColor = (value: number): string =>
    token(value >= 80 ? '--score-high' : value >= 50 ? '--score-mid' : '--score-low');
  const noData = () => token('--muted-foreground', 0.35);

  // Function to get the color for a constituency based on active layer
  const getConstituencyColor = (constituencyName: string): string => {
    // Normalize constituency name for matching (handles case, spaces, dashes)
    const normalizeName = (name: string) => 
      name.toLowerCase().replace(/[- ]/g, '').trim();
    
    // Find constituency data from the API with flexible matching
    const constituency = constituenciesData.find(c =>
      c.name === constituencyName ||
      normalizeName(c.name || '') === normalizeName(constituencyName)
    );

    if (!constituency) {
      if (activeLayer === 'gender' || activeLayer === 'performance') {
        return noData();
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

      return maxCount > 0 ? partyStyle(dominantParty).dot : noData();
    }

    // Color based on active layer
    switch (activeLayer) {
      case 'party': {
        // Color by dominant party in constituency (same logic as government layer)
        // Calculate party counts from TDs for accuracy
        const partyCounts = new Map<string, number>();
        
        if (constituency.tds && constituency.tds.length > 0) {
          constituency.tds.forEach((td) => {
            const party = td.party || 'Unknown';
            partyCounts.set(party, (partyCounts.get(party) || 0) + 1);
          });
        } else if (constituency.parties && constituency.parties.length > 0) {
          constituency.parties.forEach((p) => {
            partyCounts.set(p.party, p.count);
          });
        }
        
        if (partyCounts.size === 0) {
          return noData();
        }
        
        // Find the party with the most TDs
        const sortedParties = Array.from(partyCounts.entries())
          .map(([party, count]) => ({ party, count }))
          .sort((a, b) => b.count - a.count);
        
        const maxCount = sortedParties[0].count;
        const tiedParties = sortedParties.filter(p => p.count === maxCount);
        
        // Return color based on dominant party (only if no tie)
        if (tiedParties.length > 1 || maxCount === 0) {
          return noData(); // mixed representation / tie
        }

        return partyStyle(sortedParties[0].party).dot;
      }

      case 'performance':
        // A missing score is "no data", never a made-up 50.
        return constituency.averageScore === null || constituency.averageScore === undefined
          ? noData()
          : scoreColor(constituency.averageScore);

      case 'gender': {
        // Stepped: more women TDs = a stronger brand tint (0-5). Unrecorded gender = no data.
        const g = constituency.genderBreakdown;
        if (!g || ((g.male ?? 0) + (g.female ?? 0)) === 0) return noData();
        return token('--primary', 0.15 + Math.min(5, g.female ?? 0) * 0.17);
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
          constituency.tds.forEach((td) => {
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
          constituency.parties.forEach((p) => {
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
          return noData();
        }

        // Even split = mid, government majority = primary, opposition majority = warn
        if (governmentTDs === oppositionTDs) {
          return token('--score-mid');
        }
        return governmentTDs > oppositionTDs ? token('--primary') : token('--warn');
      }

      default:
        return noData();
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
                  color: token('--background'),
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
                        color: token('--foreground'),
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
      geoJsonLayer.eachLayer((layer: unknown) => {
        const mapLayer = layer as ConstituencyGeoJsonLayer;
        const props = mapLayer.feature?.properties;
        if (props) {
          const constituencyName = props.CONSTITUENCY || 
                                  props.CONSTITUENCY_EN || 
                                  props.NAME_EN || 
                                  props.name ||
                                  "Unknown";
          
          const newColor = getConstituencyColor(constituencyName);
          
          if (mapLayer.setStyle) {
            mapLayer.setStyle({
              fillColor: newColor,
              fillOpacity: 0.75
            });
          }

          const seats = props.SEATS || 3;
          const nameIrish = props.CONSTITUENCY || '';
          if (mapLayer.getTooltip && mapLayer.getTooltip()) {
            if (mapLayer.setTooltipContent) {
              mapLayer.setTooltipContent(createTooltipContent(constituencyName, seats, nameIrish));
            }
          }
        }
      });
    }
  }, [activeLayer, constituenciesData, geoJsonLayer]);

  return (
    <div className="official-electoral-map" style={{ width, height, position: 'relative' }}>
      {showPlaceholder && (
        <div className="absolute inset-0 z-[500]">
          <OfficialElectoralMapLoading />
        </div>
      )}
      
      <div 
        ref={mapContainerRef} 
        className="map-container overflow-hidden"
        style={{ width: '100%', height: '100%' }}
      ></div>
      
      {isLoading && !showPlaceholder && (
        <div className="absolute right-4 top-4 z-[500] rounded-full border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground" role="status">
          Loading map…
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-[600] flex items-center justify-center bg-background/80 p-4">
          <div className="flex max-w-sm flex-col items-center gap-2 rounded-2xl border bg-card p-6 text-center" role="alert">
            <AlertTriangle className="h-8 w-8 text-warn" aria-hidden="true" />
            <div className="font-display text-lg font-bold">Could not load the map</div>
            <div className="text-sm text-muted-foreground">{error}</div>
          </div>
        </div>
      )}

      {/* Discreet custom attribution at bottom right */}
      <div className="pointer-events-none absolute bottom-1 right-1 z-[400] rounded bg-card/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
        © OpenStreetMap | © Electoral Commission
      </div>
    </div>
  );
};

export default OfficialElectoralMap;
