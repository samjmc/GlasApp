/**
 * Simplify constituency boundaries GeoJSON with configurable tolerance
 * 
 * Usage: node scripts/simplify-constituencies.js [tolerance]
 * 
 * Tolerance values:
 * - 0.001 = Very detailed (many polygon points, large file)
 * - 0.01  = Detailed (good balance)
 * - 0.05  = Medium (fewer points, smaller file)
 * - 0.1   = Simple (basic shapes, very small file)
 * - 0.5   = Very simple (rough approximation)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as turf from '@turf/turf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get tolerance from command line argument or use default
const tolerance = parseFloat(process.argv[2]) || 0.01;

console.log(`\n=== Constituency Boundary Simplification ===`);
console.log(`Tolerance: ${tolerance} (lower = more detail, higher = simpler)\n`);

// Input: Use the file with WGS84 coordinates (lat/lon)
// The attached_assets file has ITM coordinates, which don't work with Leaflet
const inputFile = path.join(__dirname, '../public/assets/ireland-constituencies-full.geojson');
const outputFile = path.join(__dirname, `../public/assets/ireland-constituencies-simplified-${tolerance}.geojson`);

console.log('Reading detailed GeoJSON...');
const rawData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

console.log(`Input features: ${rawData.features.length}`);
console.log(`Input file size: ${Math.round(fs.statSync(inputFile).size / 1024 / 1024)} MB`);

// Group features by constituency name and merge geometries
const constituenciesMap = new Map();

rawData.features.forEach((feature) => {
  // Try multiple property names
  const engName = feature.properties.ENG_NAME_VALUE || 
                  feature.properties.name || 
                  feature.properties.CONSTITUENCY ||
                  '';
  // Extract constituency name (remove seat count if present)
  const constituencyMatch = engName.match(/^(.+?)\s*\(?\d+\)?$/);
  const constituencyName = constituencyMatch ? constituencyMatch[1].trim() : engName.trim();
  
  if (!constituencyName) return;
  
  // Extract seat count
  const seatMatch = engName.match(/\((\d+)\)/);
  const seats = seatMatch ? parseInt(seatMatch[1], 10) : 3;
  
  if (!constituenciesMap.has(constituencyName)) {
    constituenciesMap.set(constituencyName, {
      name: constituencyName,
      seats: seats,
      features: []
    });
  }
  
  constituenciesMap.get(constituencyName).features.push(feature);
});

console.log(`\nFound ${constituenciesMap.size} unique constituencies`);
console.log('Processing and simplifying geometries...\n');

// Process each constituency
const processedFeatures = [];
let totalPointsBefore = 0;
let totalPointsAfter = 0;

for (const [name, data] of constituenciesMap.entries()) {
  try {
    // Merge all features for this constituency
    let mergedFeature;
    
    if (data.features.length === 1) {
      mergedFeature = data.features[0];
    } else {
      // Union all polygons for this constituency
      mergedFeature = turf.union(turf.featureCollection(data.features));
    }
    
    // Count points before simplification
    const pointsBefore = countPoints(mergedFeature.geometry);
    totalPointsBefore += pointsBefore;
    
    // Simplify the geometry
    const simplified = turf.simplify(mergedFeature, {
      tolerance: tolerance,
      highQuality: true
    });
    
    // Count points after simplification
    const pointsAfter = countPoints(simplified.geometry);
    totalPointsAfter += pointsAfter;
    
    const reduction = ((1 - pointsAfter / pointsBefore) * 100).toFixed(1);
    console.log(`${name.padEnd(30)} ${pointsBefore.toString().padStart(6)} → ${pointsAfter.toString().padStart(6)} points (${reduction}% reduction)`);
    
    // Create the processed feature
    processedFeatures.push({
      type: 'Feature',
      properties: {
        CONSTITUENCY: name,
        CONSTITUENCY_EN: name,
        NAME_EN: name,
        SEATS: data.seats,
        name: name
      },
      geometry: simplified.geometry
    });
  } catch (error) {
    console.error(`Error processing ${name}:`, error.message);
  }
}

// Create the output GeoJSON
const outputGeoJSON = {
  type: 'FeatureCollection',
  features: processedFeatures.sort((a, b) => 
    a.properties.CONSTITUENCY.localeCompare(b.properties.CONSTITUENCY)
  )
};

// Write the output file
fs.writeFileSync(outputFile, JSON.stringify(outputGeoJSON, null, 2), 'utf8');

const outputSize = Math.round(fs.statSync(outputFile).size / 1024);
const totalReduction = ((1 - totalPointsAfter / totalPointsBefore) * 100).toFixed(1);

console.log(`\n=== Summary ===`);
console.log(`Constituencies: ${processedFeatures.length}`);
console.log(`Total points: ${totalPointsBefore.toLocaleString()} → ${totalPointsAfter.toLocaleString()} (${totalReduction}% reduction)`);
console.log(`Output file: ${outputFile}`);
console.log(`Output size: ${outputSize} KB`);
console.log(`\n✅ Done! Use this file in your app for ${tolerance} tolerance boundaries.`);

/**
 * Count the number of coordinate points in a geometry
 */
function countPoints(geometry) {
  let count = 0;
  
  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(ring => {
      count += ring.length;
    });
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(polygon => {
      polygon.forEach(ring => {
        count += ring.length;
      });
    });
  }
  
  return count;
}

