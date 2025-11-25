/**
 * Convert ITM coordinates to WGS84 and create detailed constituency boundaries
 * This will produce shapes that actually resemble the real constituency outlines
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import proj4 from 'proj4';
import * as turf from '@turf/turf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get tolerance from command line (lower = more detail)
const tolerance = parseFloat(process.argv[2]) || 0.001;

console.log(`\n=== Creating Detailed Constituency Boundaries ===`);
console.log(`Tolerance: ${tolerance} (lower = more detailed shapes)\n`);

// Define ITM (Irish Transverse Mercator) projection
// EPSG:2157 - Irish Transverse Mercator
const itm = '+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=0.99982 +x_0=600000 +y_0=750000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
// Define WGS84 (standard web mapping coordinates)
const wgs84 = '+proj=longlat +datum=WGS84 +no_defs';

// Input: Official Electoral Commission boundaries (ITM coordinates)
const inputFile = path.join(__dirname, '../attached_assets/ConstituencyBoundariesUngeneralised_National_Electoral_Boundaries_2023_-9076466087770389770.geojson');
const outputFile = path.join(__dirname, `../public/assets/ireland-constituencies-detailed-${tolerance}.geojson`);

console.log('Reading official boundaries (ITM coordinates)...');
const rawData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

console.log(`Input features: ${rawData.features.length}`);
console.log(`Input file size: ${Math.round(fs.statSync(inputFile).size / 1024 / 1024)} MB`);

// Group features by constituency name
const constituenciesMap = new Map();

rawData.features.forEach((feature) => {
  const engName = feature.properties.ENG_NAME_VALUE || '';
  const constituencyMatch = engName.match(/^(.+?)\s*\(?\d+\)?$/);
  const constituencyName = constituencyMatch ? constituencyMatch[1].trim() : engName.trim();
  
  if (!constituencyName) return;
  
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

console.log(`Found ${constituenciesMap.size} unique constituencies\n`);
console.log('Converting ITM → WGS84 and merging geometries...\n');

/**
 * Convert coordinates from ITM to WGS84
 */
function convertCoordinates(coords, geometryType) {
  if (geometryType === 'Polygon') {
    return coords.map(ring => 
      ring.map(coord => {
        const [lon, lat] = proj4(itm, wgs84, [coord[0], coord[1]]);
        return [lon, lat];
      })
    );
  } else if (geometryType === 'MultiPolygon') {
    return coords.map(polygon =>
      polygon.map(ring =>
        ring.map(coord => {
          const [lon, lat] = proj4(itm, wgs84, [coord[0], coord[1]]);
          return [lon, lat];
        })
      )
    );
  }
  return coords;
}

// Process each constituency
const processedFeatures = [];
let totalPointsBefore = 0;
let totalPointsAfter = 0;

for (const [name, data] of constituenciesMap.entries()) {
  try {
    // Convert and merge all features for this constituency
    const convertedFeatures = data.features.map(feature => {
      const convertedGeometry = {
        ...feature.geometry,
        coordinates: convertCoordinates(feature.geometry.coordinates, feature.geometry.type)
      };
      return {
        ...feature,
        geometry: convertedGeometry
      };
    });
    
    let mergedFeature;
    if (convertedFeatures.length === 1) {
      mergedFeature = convertedFeatures[0];
    } else {
      mergedFeature = turf.union(turf.featureCollection(convertedFeatures));
    }
    
    const pointsBefore = countPoints(mergedFeature.geometry);
    totalPointsBefore += pointsBefore;
    
    // Simplify with low tolerance to keep detail
    const simplified = turf.simplify(mergedFeature, {
      tolerance: tolerance,
      highQuality: true
    });
    
    const pointsAfter = countPoints(simplified.geometry);
    totalPointsAfter += pointsAfter;
    
    const reduction = ((1 - pointsAfter / pointsBefore) * 100).toFixed(1);
    console.log(`${name.padEnd(30)} ${pointsBefore.toString().padStart(6)} → ${pointsAfter.toString().padStart(6)} points (${reduction}% reduction)`);
    
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

const outputGeoJSON = {
  type: 'FeatureCollection',
  features: processedFeatures.sort((a, b) => 
    a.properties.CONSTITUENCY.localeCompare(b.properties.CONSTITUENCY)
  )
};

fs.writeFileSync(outputFile, JSON.stringify(outputGeoJSON, null, 2), 'utf8');

const outputSize = Math.round(fs.statSync(outputFile).size / 1024);
const totalReduction = ((1 - totalPointsAfter / totalPointsBefore) * 100).toFixed(1);

console.log(`\n=== Summary ===`);
console.log(`Constituencies: ${processedFeatures.length}`);
console.log(`Total points: ${totalPointsBefore.toLocaleString()} → ${totalPointsAfter.toLocaleString()} (${totalReduction}% reduction)`);
console.log(`Output file: ${outputFile}`);
console.log(`Output size: ${outputSize} KB`);
console.log(`\n✅ Done! Boundaries will now resemble actual constituency outlines.`);

function countPoints(geometry) {
  let count = 0;
  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(ring => count += ring.length);
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(polygon => 
      polygon.forEach(ring => count += ring.length)
    );
  }
  return count;
}

