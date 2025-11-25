/**
 * BoundaryProcessor.ts
 * 
 * Utility to process electoral boundary data that might have null geometry
 * This helps work with the Electoral Commission data format
 */

/**
 * Default fallback boundaries with simple coordinates for display
 */
const DEFAULT_BOUNDARIES = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "CONSTITUENCY": "Carlow-Kilkenny",
        "NAME_EN": "CARLOW-KILKENNY",
        "SEATS": 5,
        "TOTAL": 147701
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-7.1, 52.4], [-6.8, 52.5], [-6.9, 52.7], [-7.1, 52.9], [-7.3, 52.8],
          [-7.5, 52.7], [-7.7, 52.5], [-7.5, 52.2], [-7.2, 52.1], [-7.0, 52.2],
          [-6.9, 52.3], [-7.1, 52.4]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "CONSTITUENCY": "Cavan-Monaghan",
        "NAME_EN": "CAVAN-MONAGHAN",
        "SEATS": 5,
        "TOTAL": 132918
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-7.8, 54.0], [-7.4, 54.4], [-6.8, 54.4], [-6.7, 54.2],
          [-6.7, 53.9], [-6.8, 53.7], [-7.0, 53.6], [-7.3, 53.6],
          [-7.5, 53.7], [-7.7, 53.8], [-7.8, 54.0]
        ]]
      }
    }
  ]
};

/**
 * Extract usable data from boundary GeoJSON even when geometry is null
 * Based on properties from the Electoral Commission boundaries
 * 
 * @param geojsonData The original GeoJSON data which may have null geometry 
 * @returns GeoJSON with valid geometry for display on maps
 */
export function processElectoralBoundaryData(geojsonData: any): any {
  if (!geojsonData || !geojsonData.features || !Array.isArray(geojsonData.features)) {
    console.error('Invalid GeoJSON data provided');
    return DEFAULT_BOUNDARIES;
  }
  
  // Check if the input data has null geometry
  const hasNullGeometry = geojsonData.features.some((feature: any) => !feature.geometry || feature.geometry === null);
  
  // If geometry is not null, return the original data
  if (!hasNullGeometry) {
    return geojsonData;
  }
  
  console.log('Electoral boundaries have null geometry, creating display geometry');
  
  // Create a new GeoJSON object with the same structure
  const processedData = {
    type: 'FeatureCollection',
    features: [] as any[]
  };

  // Populate each constituency with usable information from both files
  geojsonData.features.forEach((feature: any) => {
    if (feature?.properties) {
      // Get constituency details
      const name = feature.properties.NAME_EN || 
                  feature.properties.CONSTITUENCY_EN || 
                  feature.properties.CONSTITUENCY || 
                  'Unknown';
      
      const code = feature.properties.CODE || 
                  feature.properties.REGION_CONSTITUENCY_CODE || 
                  'Unknown';
                  
      const seats = feature.properties.SEATS || 0;
      const total = feature.properties.TOTAL || 0;
      
      // Find a matching predefined boundary if possible
      const matchingConstituency = DEFAULT_BOUNDARIES.features.find(
        (f: any) => f.properties.CONSTITUENCY === name || f.properties.NAME_EN === name
      );
      
      // Create a feature for the constituency
      processedData.features.push({
        type: 'Feature',
        properties: {
          CONSTITUENCY: name,
          CONSTITUENCY_EN: name,
          SEATS: seats || (matchingConstituency?.properties.SEATS || 0),
          TOTAL: total || (matchingConstituency?.properties.TOTAL || 0),
          CODE: code
        },
        geometry: matchingConstituency ? matchingConstituency.geometry : {
          type: 'Polygon',
          coordinates: [[
            [-9.0, 53.5], [-8.5, 53.5], [-8.5, 53.0], [-9.0, 53.0], [-9.0, 53.5]
          ]]
        }
      });
    }
  });
  
  return processedData;
}