/**
 * Consolidated Geographic Routes
 * Handles all geography and location-related operations:
 * - Constituency detection from coordinates
 * - User location tracking
 * - Heatmap data generation
 * - Constituency information and election results
 * - Geographic statistics
 * 
 * Consolidated from:
 * - locationRoutes.ts
 * - heatmapData.ts
 * - constituencyRoutes.ts
 * - geographicData.ts
 */

import express, { Request, Response } from 'express';
import { db } from '../../db';
import { userLocations, users, constituencies, parties, electionResults, elections, quizResults } from '@shared/schema';
import { eq, and, count, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { cached, TTL } from '../../services/cacheService';

const router = express.Router();

// ============================================
// Helper Functions & Data Loading
// ============================================

// Load constituency boundary data (cached in memory)
let constituencyBoundaries: any = null;

function loadConstituencyBoundaries() {
  if (!constituencyBoundaries) {
    try {
      const boundariesPath = path.join(process.cwd(), 'attached_assets', 'ConstituencyBoundariesUngeneralised_National_Electoral_Boundaries_2023_-9076466087770389770.geojson');
      if (fs.existsSync(boundariesPath)) {
        const data = fs.readFileSync(boundariesPath, 'utf8');
        constituencyBoundaries = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load constituency boundaries:', error);
    }
  }
  return constituencyBoundaries;
}

// Point-in-polygon algorithm for constituency detection
function pointInPolygon(point: [number, number], polygon: number[][][]): boolean {
  const [x, y] = point;
  
  for (const ring of polygon) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

// Find constituency from coordinates
function findConstituencyFromCoords(lat: number, lng: number): { constituency?: string; county?: string } {
  const boundaries = loadConstituencyBoundaries();
  
  if (!boundaries || !boundaries.features) {
    return {};
  }

  const point: [number, number] = [lng, lat]; // GeoJSON uses [lng, lat]
  
  for (const feature of boundaries.features) {
    if (feature.geometry.type === 'Polygon') {
      if (pointInPolygon(point, [feature.geometry.coordinates[0]])) {
        return {
          constituency: feature.properties?.PC_NAME || feature.properties?.name,
          county: feature.properties?.COUNTY || feature.properties?.county
        };
      }
    } else if (feature.geometry.type === 'MultiPolygon') {
      for (const polygon of feature.geometry.coordinates) {
        if (pointInPolygon(point, [polygon[0]])) {
          return {
            constituency: feature.properties?.PC_NAME || feature.properties?.name,
            county: feature.properties?.COUNTY || feature.properties?.county
          };
        }
      }
    }
  }
  
  return {};
}

// ============================================
// Location Detection & User Tracking
// From locationRoutes.ts
// ============================================

/**
 * GET /api/location/constituency - Get constituency from coordinates
 */
router.get("/constituency", async (req, res, next) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: "Latitude and longitude are required" });
    }
    
    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }
    
    // Check if coordinates are within Ireland bounds
    if (latitude < 51.4 || latitude > 55.4 || longitude < -10.7 || longitude > -5.4) {
      return res.status(400).json({ error: "Coordinates outside Ireland" });
    }
    
    const result = findConstituencyFromCoords(latitude, longitude);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/location/users/location - Save user location
 */
router.post("/users/location", async (req, res, next) => {
  try {
    const { userId, latitude, longitude, constituency, county, accuracy } = req.body;
    
    if (!userId || !latitude || !longitude) {
      return res.status(400).json({ error: "User ID, latitude, and longitude are required" });
    }
    
    // Check if user location already exists
    const existing = await db
      .select()
      .from(userLocations)
      .where(eq(userLocations.firebaseUid, userId))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing location
      await db
        .update(userLocations)
        .set({
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          constituency,
          county,
          accuracy,
          updatedAt: new Date()
        })
        .where(eq(userLocations.firebaseUid, userId));
    } else {
      // Insert new location
      await db.insert(userLocations).values({
        firebaseUid: userId,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        constituency,
        county,
        accuracy
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/users/by-constituency/:constituency - Get users by constituency
 */
router.get("/users/by-constituency/:constituency", async (req, res, next) => {
  try {
    const { constituency } = req.params;
    
    const users = await db
      .select({
        firebaseUid: userLocations.firebaseUid,
        constituency: userLocations.constituency,
        county: userLocations.county,
        createdAt: userLocations.createdAt
      })
      .from(userLocations)
      .where(eq(userLocations.constituency, constituency));
    
    res.json(users);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/stats/constituencies - Get constituency statistics
 */
router.get("/stats/constituencies", async (req, res, next) => {
  try {
    const stats = await db
      .select({
        constituency: userLocations.constituency,
        userCount: count(userLocations.id)
      })
      .from(userLocations)
      .groupBy(userLocations.constituency);
    
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// ============================================
// Heatmap Data
// From heatmapData.ts
// ============================================

/**
 * GET /api/heatmap - Get heatmap data based on user locations
 */
router.get("/heatmap", async (req: Request, res: Response, next) => {
  try {
    // Get all users with location data
    const usersWithLocation = await db
      .select({
        latitude: users.latitude,
        longitude: users.longitude,
        county: users.county,
      })
      .from(users)
      .where(
        // Only include users who have location data
        sql`${users.latitude} IS NOT NULL AND ${users.longitude} IS NOT NULL`
      );

    // Transform data for heatmap
    const heatmapPoints = usersWithLocation.map(user => ({
      lat: Number(user.latitude),
      lng: Number(user.longitude),
      value: 1 // Default value for each user point
    }));

    res.json({
      success: true,
      data: heatmapPoints,
      message: "Heatmap data retrieved successfully"
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Constituency Information & Election Results
// From constituencyRoutes.ts
// ============================================

interface Party {
  name: string;
  votes: number;
  seats: number;
  color: string;
  percent: number;
}

interface ConstituencyData {
  name: string;
  nameIrish?: string;
  seats: number;
  parties: Party[];
  turnout: number;
  economicScore?: number;
  socialScore?: number;
  issues?: {
    [key: string]: {
      support: number;
      opposition: number;
    };
  };
}

/**
 * GET /api/constituencies - Get all constituencies with latest election data
 */
router.get("/constituencies", async (req: Request, res: Response, next) => {
  try {
    // Get all constituencies from the database (with caching)
    const constituencyRecords = await cached(
      'constituencies:all',
      TTL.ONE_DAY,
      async () => await db.select().from(constituencies)
    );
    
    res.json({
      success: true,
      constituencies: constituencyRecords
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/constituencies/:name - Get specific constituency details
 */
router.get("/constituencies/:name", async (req: Request, res: Response, next) => {
  try {
    const { name } = req.params;
    
    const constituency = await db
      .select()
      .from(constituencies)
      .where(eq(constituencies.name, name))
      .limit(1);
    
    if (constituency.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Constituency not found'
      });
    }
    
    res.json({
      success: true,
      constituency: constituency[0]
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Geographic Data (Sample/Aggregated)
// From geographicData.ts
// ============================================

/**
 * GET /api/geographic/ireland - Get aggregated political data for Ireland
 */
router.get("/ireland", async (req: Request, res: Response, next) => {
  try {
    // In production, aggregate real user data
    // For now, return basic confirmation
    res.json({
      success: true,
      message: "Ireland geographic data endpoint"
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/geographic/states - Get aggregated political data by region
 */
router.get("/states", async (req: Request, res: Response, next) => {
  try {
    // Check if we have quiz results in the database
    const resultsCheck = await db.select({
      count: sql<number>`count(*)`,
    }).from(quizResults);
    
    const hasResults = resultsCheck?.[0]?.count > 0;

    res.json({
      success: true,
      hasData: hasResults,
      message: hasResults ? "Real data available" : "No user data yet"
    });
  } catch (error) {
    next(error);
  }
});

export default router;

