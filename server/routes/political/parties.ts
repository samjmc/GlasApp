/**
 * Consolidated Party Routes
 * Handles all party-related operations:
 * - Party matching algorithm (with optional dimension weighting)
 * - Party dimensional positions
 * - Party information retrieval
 * 
 * Consolidated from:
 * - partyMatchRoutes.ts
 * - partyDimensionsRoutes.ts
 */

import { Router } from 'express';
import { db, supabaseDb } from '../../db';
import { parties } from '@shared/schema';
import { cached, TTL, CacheKeys } from '../../services/cacheService';

const router = Router();

// ============================================
// Type Definitions
// ============================================

interface IdeologicalDimensions {
  economic: number;
  social: number;
  cultural: number;
  globalism: number;
  environmental: number;
  authority: number;
  welfare: number;
  technocratic: number;
}

interface DimensionWeights {
  economic: number;
  social: number;
  cultural: number;
  globalism: number;
  environmental: number;
  authority: number;
  welfare: number;
  technocratic: number;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate match percentage using optimized cosine similarity
 * This measures the directional alignment between two ideology vectors
 */
function calculateMatchPercentage(
  user: IdeologicalDimensions,
  party: any,
  weights?: Partial<DimensionWeights>
): number {
  // Default weights
  const defaultWeights: DimensionWeights = {
    economic: 1.0,
    social: 1.0,
    cultural: 1.0,
    globalism: 1.0,
    environmental: 1.0,
    authority: 1.0,
    welfare: 1.0,
    technocratic: 1.0
  };
  
  // Merge provided weights with defaults
  const finalWeights: DimensionWeights = { ...defaultWeights, ...weights };
  
  // Log for debugging
  console.log("Calculating match with weights:", finalWeights);

  // List of dimensions to compare
  const axes: Array<keyof IdeologicalDimensions> = [
    "economic", "social", "cultural", "globalism",
    "environmental", "authority", "welfare", "technocratic"
  ];

  // Calculate weighted cosine similarity components
  let dotProduct = 0;
  let userMagnitudeSq = 0;
  let partyMagnitudeSq = 0;
  
  for (const axis of axes) {
    // Normalize user value to [-1, 1] range
    const userValue = Number(user[axis]) / 10;
    
    // Get and normalize party value to same [-1, 1] range
    // Party values are on [-2, 2] scale, so divide by 2
    const partyValue = (axis === "technocratic"
      ? Number(party.technocraticScore ?? party.governanceScore ?? 0)
      : Number(party[`${axis}Score`] ?? 0)) / 2;
    
    // Apply weight directly as a multiplier
    const weight = finalWeights[axis];
    
    // Log the raw values and weights to see what's happening
    console.log(`WEIGHTED ${axis}: user=${userValue}, party=${partyValue}, weight=${weight}, weighted_diff=${weight * Math.pow(userValue - partyValue, 2)}`);
    
    // Direct multiplication by weight (no square root) for proper weight application
    // This gives true weight importance to each dimension
    const weightedUserValue = userValue * weight;
    const weightedPartyValue = partyValue * weight;
    
    dotProduct += weightedUserValue * weightedPartyValue;
    userMagnitudeSq += weightedUserValue * weightedUserValue;
    partyMagnitudeSq += weightedPartyValue * weightedPartyValue;
  }

  // Handle edge cases with zero magnitudes
  const userMagnitude = Math.sqrt(userMagnitudeSq);
  const partyMagnitude = Math.sqrt(partyMagnitudeSq);
  
  if (userMagnitude === 0 || partyMagnitude === 0) return 0;
  
  // Calculate cosine similarity [-1, 1]
  const similarity = dotProduct / (userMagnitude * partyMagnitude);
  
  // Rescale from [-1, 1] to [0, 1] (distance = 1 - similarity)
  const scaled = (similarity + 1) / 2;
  
  // Calculate a more aggressive non-linear decay for better separation
  // Especially important when certain dimensions are heavily weighted
  const distance = 1 - scaled;
  
  // Use a higher exponent (4 instead of 2) for much sharper contrast
  // This creates dramatically more separation between matches
  const nonLinearMatch = Math.pow(1 - distance, 4);
  
  // Convert to percentage and round to one decimal place
  return Math.round(nonLinearMatch * 1000) / 10;
}

/**
 * Generate a match reason based on dimensions
 */
function generateMatchReason(
  userDimensions: IdeologicalDimensions, 
  partyDimensions: any,
  partyName: string,
  rationales?: Record<string, string>
): string {
  // Get dimensional differences (absolute values)
  const diffs = {
    economic: Math.abs(Number(userDimensions.economic) - Number(partyDimensions.economicScore)),
    social: Math.abs(Number(userDimensions.social) - Number(partyDimensions.socialScore)),
    cultural: Math.abs(Number(userDimensions.cultural) - Number(partyDimensions.culturalScore)),
    globalism: Math.abs(Number(userDimensions.globalism) - Number(partyDimensions.globalismScore)),
    environmental: Math.abs(Number(userDimensions.environmental) - Number(partyDimensions.environmentalScore)),
    authority: Math.abs(Number(userDimensions.authority) - Number(partyDimensions.authorityScore)),
    welfare: Math.abs(Number(userDimensions.welfare) - Number(partyDimensions.welfareScore)),
    technocratic: Math.abs(Number(userDimensions.technocratic) - Number(partyDimensions.technocraticScore))
  };

  // Sort dimensions by how closely they match (ascending order)
  const sortedDimensions = Object.entries(diffs)
    .sort((a, b) => a[1] - b[1])
    .map(entry => entry[0]);

  // Get the top 3 closest matching dimensions
  const topMatches = sortedDimensions.slice(0, 3);

  // Get the worst 2 matching dimensions
  const worstMatches = sortedDimensions.slice(-2);

  // Generate reason text
  let reason = `${partyName} aligns with your `;

  // Add top matching dimensions with their rationales if available
  topMatches.forEach((dim, index) => {
    const dimensionName = getDimensionDisplayName(dim);

    if (index > 0) {
      reason += index === topMatches.length - 1 ? " and " : ", ";
    }

    reason += `${dimensionName} views`;
  });

  // Add sentence about worst matches if significant difference exists
  if (worstMatches.some(dim => diffs[dim as keyof typeof diffs] > 1.5)) {
    reason += `. There are some differences regarding `;

    worstMatches.forEach((dim, index) => {
      if (diffs[dim as keyof typeof diffs] <= 1.5) return;

      const dimensionName = getDimensionDisplayName(dim);

      if (index > 0 && index < worstMatches.length) {
        reason += " and ";
      }

      reason += `${dimensionName} issues`;
    });
  }

  // Add rationale for top matching dimension if available
  if (rationales && Object.keys(rationales).length > 0) {
    try {
      const primaryDimension = topMatches[0];
      const rationale = rationales[primaryDimension];

      if (rationale) {
        reason += `. ${rationale}`;
      }
    } catch (error) {
      console.error("Error adding rationale:", error);
    }
  }

  return reason;
}

/**
 * Convert dimension key to display name
 */
function getDimensionDisplayName(dimensionKey: string): string {
  const displayNames: Record<string, string> = {
    economic: "economic",
    social: "social",
    cultural: "cultural",
    globalism: "national/global",
    environmental: "environmental",
    authority: "authority",
    welfare: "welfare",
    technocratic: "governance"
  };

  return displayNames[dimensionKey] || dimensionKey;
}

// ============================================
// Party Matching Routes
// ============================================

/**
 * POST /api/party-match/party-matches - Get party matches using dimension comparison
 * Supports optional dimension weighting for personalized matching
 */
router.post("/party-matches", async (req, res, next) => {
  try {
    // Pull dimensions and weights from the request body
    const { dimensions, weights } = req.body;
    
    // Log the entire request body to debug weights issue
    console.log("RECEIVED REQUEST BODY:", JSON.stringify(req.body, null, 2));
    console.log("WEIGHTS FROM REQUEST:", weights ? JSON.stringify(weights, null, 2) : "No weights provided");

    if (!dimensions) {
      return res.status(400).json({
        success: false,
        error: "Dimensions are required"
      });
    }
    
    // Validate and clean the user's ideological dimensions
    const validatedDimensions: IdeologicalDimensions = {
      economic: parseFloat(dimensions.economic) || 0,
      social: parseFloat(dimensions.social) || 0,
      cultural: parseFloat(dimensions.cultural) || 0,
      globalism: parseFloat(dimensions.globalism) || 0,
      environmental: parseFloat(dimensions.environmental) || 0,
      authority: parseFloat(dimensions.authority) || 0,
      welfare: parseFloat(dimensions.welfare) || 0,
      technocratic: parseFloat(dimensions.technocratic) || 0
    };
    
    // Parse and validate weights if provided, otherwise use defaults
    let dimensionWeights: DimensionWeights | undefined = undefined;
    
    if (weights) {
      // Ensure we don't have falsy values like 0 being replaced with defaults
      // by checking if the value is a number (not just truthy)
      dimensionWeights = {
        economic: typeof weights.economic === 'number' ? weights.economic : 
                 (parseFloat(weights.economic) || 1.0),
        social: typeof weights.social === 'number' ? weights.social : 
               (parseFloat(weights.social) || 1.0),
        cultural: typeof weights.cultural === 'number' ? weights.cultural : 
                 (parseFloat(weights.cultural) || 1.0),
        globalism: typeof weights.globalism === 'number' ? weights.globalism : 
                  (parseFloat(weights.globalism) || 1.0),
        environmental: typeof weights.environmental === 'number' ? weights.environmental : 
                      (parseFloat(weights.environmental) || 1.0),
        authority: typeof weights.authority === 'number' ? weights.authority : 
                  (parseFloat(weights.authority) || 1.0),
        welfare: typeof weights.welfare === 'number' ? weights.welfare : 
                (parseFloat(weights.welfare) || 1.0),
        technocratic: typeof weights.technocratic === 'number' ? weights.technocratic : 
                     (parseFloat(weights.technocratic) || 1.0)
      };
      
      console.log("PROCESSED WEIGHTS:", JSON.stringify(dimensionWeights, null, 2));
    }

    // Get all parties from database (with caching)
    // Use Supabase REST client since db (Drizzle) is disabled
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        error: "Database connection not available"
      });
    }

    const allParties = await cached(
      CacheKeys.parties.all(),
      TTL.ONE_DAY,
      async () => {
        const { data, error } = await supabaseDb
          .from('parties')
          .select('*');
        
        if (error) {
          console.error('Error fetching parties:', error);
          throw new Error(`Database error: ${error.message}`);
        }
        
        return data || [];
      }
    );

    if (!allParties || allParties.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No parties found in database"
      });
    }

    // Calculate match percentages using our weighted Euclidean distance function
    let partyMatches = allParties
      .filter(party => {
        // Only include parties with enough dimensional data
        return party.economicScore !== null && 
               party.socialScore !== null &&
               party.culturalScore !== null;
      })
      .map(party => {
        // Parse rationales if available
        let rationales = {};
        if (party.dimensionRationales) {
          try {
            rationales = JSON.parse(party.dimensionRationales);
          } catch (e) {
            console.error(`Invalid rationales JSON for ${party.name}:`, e);
          }
        }

        // Calculate match percentage with custom weights if provided
        // This uses our deterministic Euclidean distance algorithm that factors in weights
        const matchPercentage = calculateMatchPercentage(validatedDimensions, party, dimensionWeights);

        // Generate reason for the match (this could be enhanced to mention which weighted dimensions were most influential)
        const matchReason = generateMatchReason(validatedDimensions, party, party.name, rationales);

        return {
          party: party.name,
          abbreviation: party.abbreviation || "",
          matchPercentage,
          matchReason,
          color: party.color
        };
      })
      // Sort by match percentage in descending order (highest matches first)
      .sort((a, b) => b.matchPercentage - a.matchPercentage);
    
    // No normalization - show the raw match percentages
    // This preserves the actual algorithmically calculated match values
    // and prevents parties from always having a 100% top match

    // Get top 3 matches (highest percentage)
    const topMatches = partyMatches.slice(0, 3);

    // Get bottom 3 matches (lowest percentage)
    const bottomMatches = partyMatches.length > 3 ? 
      partyMatches.slice(-3).reverse() : [];

    return res.json({
      success: true,
      data: {
        topParties: topMatches,
        bottomParties: bottomMatches
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Party Dimensions & Information
// ============================================

/**
 * GET /api/party-dimensions - Get all party dimensional positions (with caching)
 */
router.get("/dimensions", async (req, res, next) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        error: "Database connection not available"
      });
    }

    // Party data rarely changes - cache for 24 hours
    const partyDimensions = await cached(
      CacheKeys.parties.positions(),
      TTL.ONE_DAY,
      async () => {
        const { data, error } = await supabaseDb
          .from('parties')
          .select('id, name, economicScore, socialScore, culturalScore, globalismScore, environmentalScore, authorityScore, welfareScore, technocraticScore');
        
        if (error) {
          console.error('Error fetching party dimensions:', error);
          throw new Error(`Database error: ${error.message}`);
        }
        
        // Map to expected format
        return (data || []).map(party => ({
          id: party.id,
          name: party.name,
          economic_score: party.economicScore,
          social_score: party.socialScore,
          cultural_score: party.culturalScore,
          globalism_score: party.globalismScore,
          environmental_score: party.environmentalScore,
          authority_score: party.authorityScore,
          welfare_score: party.welfareScore,
          technocratic_score: party.technocraticScore
        }));
      }
    );
    
    return res.json(partyDimensions);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/parties - Get all parties (with full info, cached)
 */
router.get("/", async (req, res, next) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        error: "Database connection not available"
      });
    }

    const allParties = await cached(
      CacheKeys.parties.all(),
      TTL.ONE_DAY,
      async () => {
        const { data, error } = await supabaseDb
          .from('parties')
          .select('*');
        
        if (error) {
          console.error('Error fetching parties:', error);
          throw new Error(`Database error: ${error.message}`);
        }
        
        return data || [];
      }
    );
    
    return res.json({
      success: true,
      parties: allParties
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Party Dimension Explanations/Rationales
// From dimensionExplanations.ts + dimensionExplanationsRoutes.ts
// ============================================

// Map of party codes to their database names
const partyCodeToName: Record<string, string> = {
  'ie-sf': 'Sinn Féin',
  'ie-fg': 'Fine Gael',
  'ie-ff': 'Fianna Fáil',
  'ie-labour': 'Labour Party',
  'ie-green': 'Green Party',
  'ie-sd': 'Social Democrats',
  'ie-pbp': 'People Before Profit',
  'ie-aontu': 'Aontú',
  'ie-independent-ireland': 'Independent Ireland',
  'ie-irish-freedom': 'Irish Freedom Party'
};

/**
 * GET /api/parties/explanations/:partyId - Get dimension explanations for a party
 * Supports both integer ID and party code (e.g., 'ie-sf')
 */
router.get("/explanations/:partyId", async (req, res, next) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        error: "Database connection not available"
      });
    }

    const { partyId } = req.params;
    
    let party;
    
    // Check if it's a numeric ID or a party code
    if (!isNaN(Number(partyId))) {
      // Numeric ID - query by ID
      const { data, error } = await supabaseDb
        .from('parties')
        .select('dimensionRationales')
        .eq('id', parseInt(partyId))
        .single();
      
      if (error) {
        console.error('Error fetching party rationales:', error);
        return res.status(404).json({ error: 'Party not found' });
      }
      
      party = data;
    } else {
      // Party code - convert to name and query
      const partyName = partyCodeToName[partyId];
      if (!partyName) {
        return res.status(404).json({ error: 'Unknown party code' });
      }
      
      const { data, error } = await supabaseDb
        .from('parties')
        .select('dimensionRationales')
        .eq('name', partyName)
        .single();
      
      if (error) {
        console.error('Error fetching party rationales:', error);
        return res.status(404).json({ error: 'Party not found' });
      }
      
      party = data;
    }
    
    if (!party) {
      return res.status(404).json({ error: 'Party not found' });
    }
    
    // Parse the JSON from dimensionRationales field or return empty object
    const explanations = party.dimensionRationales 
      ? JSON.parse(party.dimensionRationales) 
      : {};
    
    return res.json(explanations);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/parties/explanations/:partyId - Update dimension explanations for a party
 * Supports both integer ID and party code
 */
router.post("/explanations/:partyId", async (req, res, next) => {
  try {
    if (!supabaseDb) {
      return res.status(503).json({
        success: false,
        error: "Database connection not available"
      });
    }

    const { partyId } = req.params;
    const explanations = req.body;
    
    // Determine how to query based on ID type
    let filterColumn: string;
    let filterValue: string | number;
    
    if (!isNaN(Number(partyId))) {
      // Numeric ID
      filterColumn = 'id';
      filterValue = parseInt(partyId);
    } else {
      // Party code - convert to name
      const partyName = partyCodeToName[partyId];
      if (!partyName) {
        return res.status(404).json({ error: 'Unknown party code' });
      }
      filterColumn = 'name';
      filterValue = partyName;
    }
    
    // Verify party exists
    const { data: existingParty, error: checkError } = await supabaseDb
      .from('parties')
      .select('id, name')
      .eq(filterColumn, filterValue)
      .single();
    
    if (checkError || !existingParty) {
      return res.status(404).json({ error: 'Party not found in database' });
    }
    
    // Store the explanations as a JSON string in the dimensionRationales field
    const { data: result, error: updateError } = await supabaseDb
      .from('parties')
      .update({ 
        dimensionRationales: JSON.stringify(explanations)
      })
      .eq(filterColumn, filterValue)
      .select();
    
    if (updateError || !result || result.length === 0) {
      console.error('Error updating party explanations:', updateError);
      return res.status(500).json({ error: 'Failed to update explanations' });
    }
    
    // Clear cache when party data is updated
    const { cache } = await import('../../services/cacheService');
    cache.delete('parties:all');
    cache.delete('parties:positions');
    
    return res.json({ 
      success: true, 
      message: `Explanations updated successfully for ${existingParty[0].name}` 
    });
  } catch (error) {
    next(error);
  }
});

export default router;

