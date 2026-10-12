/**
 * Helper function to fetch Irish electoral constituency boundaries GeoJSON
 * Uses EPSG:4326 (WGS84) coordinates for proper representation in Leaflet
 */

// Main Ireland constituencies GeoJSON file (detailed with actual constituency shapes)
// Using detailed-0.001.geojson which has converted ITM→WGS84 coordinates and detailed shapes (32K points, 3.3 MB)
const IRELAND_CONSTITUENCIES = '/assets/ireland-constituencies-detailed-0.001.geojson';

// Backup sources for the boundaries
const BACKUP_BOUNDARIES = '/assets/ireland-constituencies-full.geojson';

const SOURCES = [IRELAND_CONSTITUENCIES, BACKUP_BOUNDARIES];

// Kept for the page's lifetime so a remount does not download 3 MB again.
let cached: Promise<GeoJSON.FeatureCollection> | null = null;

async function loadBoundaries(): Promise<GeoJSON.FeatureCollection> {
  for (const source of SOURCES) {
    try {
      const response = await fetch(source);
      if (response.ok) return await response.json();
    } catch {
      // Try the next source.
    }
  }
  throw new Error('the boundary files could not be downloaded');
}

/**
 * Fetches Irish electoral constituency boundaries. Rejects when every source fails, so the map
 * can show its error and "Try again"; a failure is never cached, so the retry fetches afresh.
 */
export function fetchConstituencyBoundaries(): Promise<GeoJSON.FeatureCollection> {
  if (!cached) {
    const pending = loadBoundaries();
    cached = pending;
    pending.catch(() => {
      if (cached === pending) cached = null;
    });
  }
  return cached;
}
