/**
 * Helper functions to simplify GeoJSON data for faster rendering
 */
import { Feature, FeatureCollection, Geometry, Position } from 'geojson';

/**
 * Simplifies a GeoJSON object by reducing the number of points
 * This dramatically improves rendering performance
 * 
 * @param geojson The original GeoJSON FeatureCollection
 * @param tolerance The tolerance level for simplification (higher = more simplified)
 * @returns Simplified GeoJSON object
 */
export function simplifyGeoJSON(geojson: FeatureCollection, tolerance = 0.001): FeatureCollection {
  if (!geojson || !geojson.features || !Array.isArray(geojson.features)) {
    return geojson;
  }

  const simplifiedFeatures = geojson.features.map(feature => {
    if (!feature.geometry) return feature;
    
    return {
      ...feature,
      geometry: simplifyGeometry(feature.geometry, tolerance)
    };
  });

  return {
    type: 'FeatureCollection',
    features: simplifiedFeatures
  };
}

/**
 * Simplifies a GeoJSON geometry by reducing the number of points
 * 
 * @param geometry GeoJSON geometry object
 * @param tolerance The tolerance level (higher = more simplified)
 * @returns Simplified geometry
 */
function simplifyGeometry(geometry: Geometry, tolerance: number): Geometry {
  if (!geometry) return geometry;

  switch (geometry.type) {
    case 'Point':
    case 'MultiPoint':
      return geometry; // No simplification needed
      
    case 'LineString':
      return {
        ...geometry,
        coordinates: simplifyLineString(geometry.coordinates as Position[], tolerance)
      };
      
    case 'MultiLineString':
      return {
        ...geometry,
        coordinates: (geometry.coordinates as Position[][]).map(line => 
          simplifyLineString(line, tolerance)
        )
      };
      
    case 'Polygon':
      return {
        ...geometry,
        coordinates: (geometry.coordinates as Position[][]).map(ring => 
          simplifyLineString(ring, tolerance)
        )
      };
      
    case 'MultiPolygon':
      return {
        ...geometry,
        coordinates: (geometry.coordinates as Position[][][]).map(polygon => 
          polygon.map(ring => simplifyLineString(ring, tolerance))
        )
      };
      
    default:
      return geometry; // Return as-is for unsupported types
  }
}

/**
 * Simplifies a line string using the Ramer-Douglas-Peucker algorithm
 * 
 * @param points Array of coordinate points [lon, lat]
 * @param tolerance Tolerance level (higher = fewer points)
 * @returns Simplified line with fewer points
 */
function simplifyLineString(points: Position[], tolerance: number): Position[] {
  if (points.length <= 2) return points; // No simplification needed
  
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  
  // Find the point with the maximum distance
  let maxDistance = 0;
  let maxIndex = 0;
  
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], firstPoint, lastPoint);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }
  
  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    // Recursive call
    const firstHalf = simplifyLineString(points.slice(0, maxIndex + 1), tolerance);
    const secondHalf = simplifyLineString(points.slice(maxIndex), tolerance);
    
    // Concatenate the two simplified line segments
    // Remove the duplicated point
    return [...firstHalf.slice(0, -1), ...secondHalf];
  } else {
    // Below tolerance, return just the endpoints
    return [firstPoint, lastPoint];
  }
}

/**
 * Calculates the perpendicular distance from a point to a line
 * 
 * @param point The point to measure distance from
 * @param lineStart Start point of the line
 * @param lineEnd End point of the line
 * @returns Distance from the point to the line
 */
function perpendicularDistance(point: Position, lineStart: Position, lineEnd: Position): number {
  // Handle case where line is a point
  if (lineStart[0] === lineEnd[0] && lineStart[1] === lineEnd[1]) {
    return distanceBetweenPoints(point, lineStart);
  }
  
  // Calculate perpendicular distance
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];
  const numerator = Math.abs(dy * point[0] - dx * point[1] + lineEnd[0] * lineStart[1] - lineEnd[1] * lineStart[0]);
  const denominator = Math.sqrt(dx * dx + dy * dy);
  
  return numerator / denominator;
}

/**
 * Calculates the distance between two points
 * 
 * @param p1 First point [lon, lat]
 * @param p2 Second point [lon, lat]
 * @returns Euclidean distance between the points
 */
function distanceBetweenPoints(p1: Position, p2: Position): number {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
}