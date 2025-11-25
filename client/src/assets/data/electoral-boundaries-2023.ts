// Updated Electoral Boundaries 2023
// This file provides access to the latest constituency boundaries
// from the Electoral Commission (2023 boundaries)

// The detailed GeoJSON boundaries are too large to embed directly in the code
// Instead, we load them dynamically from the attached file

/**
 * Function to load the detailed electoral boundaries
 * @returns Promise with the GeoJSON data
 */
export async function loadElectoralBoundaries() {
  // Access the attached constituency boundaries file
  try {
    const response = await fetch('/assets/ConstituencyBoundariesUngeneralised_National_Electoral_Boundaries_2023.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch electoral boundaries: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading electoral boundaries:', error);
    return fallbackBoundaries();
  }
}

/**
 * Provides a simplified fallback if the detailed boundaries can't be loaded
 */
function fallbackBoundaries() {
  return {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "CONSTITUENCY": "Carlow-Kilkenny",
          "SEATS": 5
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
          "SEATS": 5
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
}