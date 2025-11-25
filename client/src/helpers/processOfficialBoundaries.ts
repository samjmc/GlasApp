import proj4 from 'proj4';
import { FeatureCollection, Feature, Geometry, Position } from 'geojson';
import L from 'leaflet';
import 'proj4leaflet';

// Define the Irish Transverse Mercator (ITM) / EPSG:2157 projection
proj4.defs("EPSG:2157", "+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=0.99982 +x_0=600000 +y_0=750000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

// Define the WGS84 / EPSG:4326 projection (standard for web maps)
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");

/**
 * Initialize Proj4Leaflet CRS for Irish Transverse Mercator
 * This allows Leaflet to use the ITM projection
 */
export const itm = new (L as any).Proj.CRS(
  'EPSG:2157',
  proj4.defs('EPSG:2157'),
  {
    origin: [600000, 750000],
    resolutions: [
      2000, 1000, 500, 250, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1
    ]
  }
);

/**
 * Converts a coordinate from Irish Transverse Mercator (EPSG:2157) to WGS84 (EPSG:4326)
 * @param coordinate [x, y] coordinate in EPSG:2157
 * @returns [longitude, latitude] coordinate in EPSG:4326
 */
function convertCoordinate(coordinate: Position): Position {
  // The coordinate needs to be in the format [x, y] for proj4
  const result = proj4('EPSG:2157', 'EPSG:4326', coordinate);
  
  // Return as [longitude, latitude] as expected by GeoJSON
  return result;
}

/**
 * Recursively convert coordinates in a GeoJSON geometry from EPSG:2157 to EPSG:4326
 * @param geometry The GeoJSON geometry object
 * @returns Geometry with converted coordinates
 */
function convertGeometry(geometry: Geometry): Geometry {
  if (!geometry) return geometry;

  const convertedGeometry = { ...geometry };
  
  if (geometry.type === 'Point') {
    convertedGeometry.coordinates = convertCoordinate(geometry.coordinates as Position);
  } 
  else if (geometry.type === 'LineString' || geometry.type === 'MultiPoint') {
    convertedGeometry.coordinates = (geometry.coordinates as Position[]).map(convertCoordinate);
  } 
  else if (geometry.type === 'Polygon' || geometry.type === 'MultiLineString') {
    convertedGeometry.coordinates = (geometry.coordinates as Position[][]).map(ring => 
      ring.map(convertCoordinate)
    );
  } 
  else if (geometry.type === 'MultiPolygon') {
    convertedGeometry.coordinates = (geometry.coordinates as Position[][][]).map(polygon => 
      polygon.map(ring => ring.map(convertCoordinate))
    );
  }
  
  return convertedGeometry;
}

/**
 * Process the official Electoral Commission constituency boundaries GeoJSON
 * @param officialGeoJson The GeoJSON data from the Electoral Commission (in EPSG:2157)
 * @returns Processed GeoJSON with coordinates in EPSG:4326 and standardized properties
 */
// Cache processed data to improve performance on subsequent loads
let processedDataCache: FeatureCollection | null = null;

export function processOfficialBoundaries(officialGeoJson: any): FeatureCollection {
  // Return cached data if available
  if (processedDataCache) {
    return processedDataCache;
  }
  
  if (!officialGeoJson || !officialGeoJson.features || !Array.isArray(officialGeoJson.features)) {
    console.error('Invalid GeoJSON data provided');
    return { type: 'FeatureCollection', features: [] };
  }
  
  console.time('Process GeoJSON');
  
  // For performance, limit the number of points in complex polygons
  // This significantly reduces rendering time while maintaining visual quality
  const simplificationFactor = 0.0001; // Adjust based on needed detail level
  
  // Process each feature - convert coordinates and standardize properties
  const processedFeatures = officialGeoJson.features.map((feature: any) => {
    if (!feature || !feature.properties || !feature.geometry) return null;
    
    // Extract relevant property information
    const nameEnglish = feature.properties.ENG_NAME_VALUE || 'Unknown';
    const nameIrish = feature.properties.GLE_NAME_VALUE;
    
    // Extract the number of seats from the name if available (usually in parentheses)
    let seats = 3; // Default value
    const seatsMatch = nameEnglish.match(/\((\d+)\)/);
    if (seatsMatch && seatsMatch[1]) {
      seats = parseInt(seatsMatch[1], 10);
    }
    
    // Create a clean feature with converted coordinates and standardized properties
    const processedFeature: Feature = {
      type: 'Feature',
      geometry: convertGeometry(feature.geometry),
      properties: {
        name: nameEnglish.split(' (')[0], // Remove the seats part from the name
        nameIrish: nameIrish ? nameIrish.split(' (')[0] : undefined,
        seats: seats,
        id: feature.id || feature.properties.GUID || undefined,
        originalId: feature.properties.BDY_ID || undefined
      }
    };
    
    return processedFeature;
  }).filter(Boolean) as Feature[];
  
  // Create the feature collection
  const result = {
    type: 'FeatureCollection',
    features: processedFeatures
  };
  
  // Store in cache for future use
  processedDataCache = result;
  
  console.timeEnd('Process GeoJSON');
  
  return result;
}

/**
 * Load the official Electoral Commission constituency boundaries
 * @param filePath Path to the GeoJSON file
 * @returns Promise with processed GeoJSON in EPSG:4326
 */
export async function loadOfficialBoundaries(filePath: string): Promise<FeatureCollection> {
  try {
    console.time('Total GeoJSON load time');
    
    // Use the relative path to access the attached file
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
    }
    
    console.time('JSON parse');
    const data = await response.json();
    console.timeEnd('JSON parse');
    
    console.time('Process boundaries');
    // First process the coordinates (projection conversion)
    const processedData = processOfficialBoundaries(data);
    console.timeEnd('Process boundaries');
    
    // Import simplification dynamically to avoid circular dependencies
    console.time('Simplify GeoJSON');
    const { simplifyGeoJSON } = await import('./simplifyGeoJSON');
    
    // Then apply aggressive simplification to improve performance
    // Higher tolerance = fewer points = faster rendering but less detail
    // 0.001 is a good balance for constituency-level visualization
    const simplifiedData = simplifyGeoJSON(processedData, 0.001);
    console.timeEnd('Simplify GeoJSON');
    
    console.timeEnd('Total GeoJSON load time');
    return simplifiedData;
  } catch (error) {
    console.error('Error loading official boundaries:', error);
    throw error;
  }
}