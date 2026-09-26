/**
 * Consolidated Geographic Routes
 * Handles all geography and location-related operations:
 * - Constituency detection from coordinates
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
import { constituencies, parties, electionResults, elections } from '@shared/schema';
import { quizResults } from '@shared/schema/quiz';
import { eq, and, count, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { cached, TTL } from '../../services/cacheService';

const router = express.Router();

// ============================================
// Helper Functions & Data Loading
// ============================================

// Load constituency boundary data (cached in memory)
interface ConstituencyBoundaries {
  features: {
    geometry: { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
    properties?: { PC_NAME?: string; name?: string; COUNTY?: string; county?: string };
  }[];
}
let constituencyBoundaries: ConstituencyBoundaries | null = null;

function loadConstituencyBoundaries(): ConstituencyBoundaries | null {
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

