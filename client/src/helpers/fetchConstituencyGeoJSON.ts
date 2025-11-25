/**
 * Helper function to fetch Irish electoral constituency boundaries GeoJSON
 * Uses EPSG:4326 (WGS84) coordinates for proper representation in Leaflet
 */
import { processElectoralBoundaryData } from '../components/BoundaryProcessor';

// Main Ireland constituencies GeoJSON file (detailed with actual constituency shapes)
// Using detailed-0.001.geojson which has converted ITM→WGS84 coordinates and detailed shapes (32K points, 3.3 MB)
const IRELAND_CONSTITUENCIES = '/assets/ireland-constituencies-detailed-0.001.geojson';

// External source with all 43 constituencies (fallback) - using a known working source
const EXTERNAL_SOURCE_PRIMARY = 'https://raw.githubusercontent.com/johnppkyaw/ireland-constituencies-map/main/ireland-constituencies.geojson';

// Backup sources for the boundaries
const BACKUP_BOUNDARIES = '/assets/ireland-constituencies-full.geojson';

// Additional external sources in case primary fails
const EXTERNAL_SOURCE_1 = 'https://raw.githubusercontent.com/iross/CartograFi/main/data/ie_constituency.geojson';

/**
 * Fetches Irish electoral constituency boundaries
 * @returns Promise with GeoJSON data
 */
export async function fetchConstituencyBoundaries(): Promise<GeoJSON.FeatureCollection> {
  // First try: Load the main Ireland constituencies file
  try {
    const response = await fetch(IRELAND_CONSTITUENCIES);
    if (response.ok) {
      const data = await response.json();
      console.log('Using Ireland constituencies GeoJSON file');
      return data;
    }
  } catch (primaryErr) {
    console.warn(`Ireland constituencies GeoJSON failed: ${(primaryErr as Error).message}`);
  }
  
  // Second try: Load our backup boundaries with pre-processed geometry
  try {
    const response = await fetch(BACKUP_BOUNDARIES);
    if (response.ok) {
      console.log('Using backup electoral boundaries');
      return await response.json();
    }
  } catch (backupErr) {
    console.warn(`Backup boundaries failed: ${(backupErr as Error).message}`);
  }
  
  // Third try: External sources
  try {
    const response = await fetch(EXTERNAL_SOURCE_1);
    if (response.ok) {
      console.log('Using external electoral boundaries source');
      return await response.json();
    }
  } catch (externalErr) {
    console.warn(`External source failed: ${(externalErr as Error).message}`);
  }
  
  // Last resort: Generate fallback data
  console.error('All boundary sources failed, using minimal fallback data');
  return generateFallbackGeoJSON();
}

/**
 * Generate minimal fallback data with simplified polygons for testing purposes only
 * @returns A minimal GeoJSON feature collection
 */
function generateFallbackGeoJSON(): GeoJSON.FeatureCollection {
  // In a real-world application, this would be replaced with proper cached data
  // This is only used as a last resort to prevent a complete UI failure
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          CONSTITUENCY: "Dublin Central",
          NAME: "Dublin Central",
          ABBREV: "DBC",
          AREA_SQ_KM: 19.24,
          PROVINCE: "Leinster",
          SEATS: 4
        },
        geometry: {
          type: "Polygon",
          coordinates: [[[-6.302, 53.343], [-6.276, 53.376], [-6.251, 53.410], [-6.225, 53.376], [-6.200, 53.343], [-6.225, 53.310], [-6.251, 53.343], [-6.276, 53.310], [-6.302, 53.343]]]
        }
      }
    ]
  };
}

/**
 * Process GeoJSON data to ensure it's properly formatted for Leaflet
 * @param geoJSON GeoJSON feature collection
 * @returns Processed GeoJSON data ready for Leaflet
 */
export function processGeoJSON(geoJSON: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  if (!geoJSON || !geoJSON.features || !Array.isArray(geoJSON.features) || geoJSON.features.length === 0) {
    console.error('Invalid or empty GeoJSON data received');
    return generateFallbackGeoJSON();
  }
  
  // Ensure properties are standardized and accessible
  const processedFeatures = geoJSON.features.map(feature => {
    // Skip invalid features
    if (!feature || !feature.properties || !feature.geometry) {
      console.warn('Skipping invalid feature in GeoJSON data');
      return null;
    }
    
    // Extract name from various potential property keys
    const constituencyName = 
      feature.properties.CONSTITUENCY || 
      feature.properties.CONSTITUENCY_EN ||
      feature.properties.NAME_EN ||
      feature.properties.name || 
      feature.properties.NAME || 
      feature.properties.constituency || 
      'Unknown Constituency';
    
    // Extract seats information
    const seats = 
      feature.properties.SEATS || 
      feature.properties.seats || 
      3; // Default to 3 seats
    
    // Create standardized properties
    return {
      ...feature,
      properties: {
        ...feature.properties,
        CONSTITUENCY: constituencyName,
        CONSTITUENCY_EN: constituencyName,
        NAME_EN: constituencyName,
        SEATS: seats,
        name: constituencyName,
        seats: seats
      }
    };
  }).filter(Boolean) as GeoJSON.Feature[]; // Remove any null entries
  
  return {
    type: "FeatureCollection",
    features: processedFeatures
  };
}