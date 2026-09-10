/**
 * Party Routes
 * Handles all party-related operations:
 * - Party matching algorithm (with optional dimension weighting)
 * - Party dimensional positions
 * - Party information retrieval
 * - Party dimension explanations
 */

import { Router } from 'express';
import { supabaseDb } from '../../db';
import { cached, TTL, CacheKeys } from '../../services/cacheService';
import { asyncHandler } from '../../middleware/errorHandler';
import { formatSuccess, formatError, ErrorCodes } from '../../utils/responseFormatters';

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
  party: unknown,
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
  partyDimensions: unknown,
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
 * POST /api/parties/matches - Get party matches using dimension comparison
 * Supports optional dimension weighting for personalized matching
 */
router.post("/matches", asyncHandler(async (req, res) => {
  const { dimensions, weights } = req.body;

  if (!dimensions) {
    return res.status(400).json(
      formatError('MISSING_REQUIRED_FIELD', 'Dimensions are required')
    );
  }

  if (!supabaseDb) {
    return res.status(503).json(
      formatError('EXTERNAL_SERVICE_ERROR', 'Database connection not available')
    );
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

  // Parse and validate weights if provided
  let dimensionWeights: DimensionWeights | undefined = undefined;

  if (weights) {
    dimensionWeights = {
      economic: typeof weights.economic === 'number' ? weights.economic : (parseFloat(weights.economic) || 1.0),
      social: typeof weights.social === 'number' ? weights.social : (parseFloat(weights.social) || 1.0),
      cultural: typeof weights.cultural === 'number' ? weights.cultural : (parseFloat(weights.cultural) || 1.0),
      globalism: typeof weights.globalism === 'number' ? weights.globalism : (parseFloat(weights.globalism) || 1.0),
      environmental: typeof weights.environmental === 'number' ? weights.environmental : (parseFloat(weights.environmental) || 1.0),
      authority: typeof weights.authority === 'number' ? weights.authority : (parseFloat(weights.authority) || 1.0),
      welfare: typeof weights.welfare === 'number' ? weights.welfare : (parseFloat(weights.welfare) || 1.0),
      technocratic: typeof weights.technocratic === 'number' ? weights.technocratic : (parseFloat(weights.technocratic) || 1.0)
    };
  }

  // Get all parties from database (with caching)
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
    return res.status(404).json(
      formatError('NOT_FOUND', 'No parties found in database')
    );
  }

  // Calculate match percentages using weighted cosine similarity
  const partyMatches = allParties
    .filter(party => {
      return party.economicScore !== null &&
        party.socialScore !== null &&
        party.culturalScore !== null;
    })
    .map(party => {
      let rationales = {};
      if (party.dimensionRationales) {
        try {
          rationales = JSON.parse(party.dimensionRationales);
        } catch (e) {
          console.error(`Invalid rationales JSON for ${party.name}:`, e);
        }
      }

      const matchPercentage = calculateMatchPercentage(validatedDimensions, party, dimensionWeights);
      const matchReason = generateMatchReason(validatedDimensions, party, party.name, rationales);

      return {
        party: party.name,
        abbreviation: party.abbreviation || "",
        matchPercentage,
        matchReason,
        color: party.color
      };
    })
    .sort((a, b) => b.matchPercentage - a.matchPercentage);

  const topMatches = partyMatches.slice(0, 3);
  const bottomMatches = partyMatches.length > 3 ? partyMatches.slice(-3).reverse() : [];

  return res.json(formatSuccess({
    topParties: topMatches,
    bottomParties: bottomMatches
  }));
}));

// ============================================
// Party Dimensions & Information
// ============================================

/**
 * GET /api/parties/dimensions - Get all party dimensional positions (cached)
 */
router.get("/dimensions", asyncHandler(async (req, res) => {
  if (!supabaseDb) {
    return res.status(503).json(
      formatError('EXTERNAL_SERVICE_ERROR', 'Database connection not available')
    );
  }

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

  return res.json(formatSuccess(partyDimensions));
}));

/**
 * GET /api/parties - Get all parties with full information (cached)
 */
router.get("/", asyncHandler(async (req, res) => {
  if (!supabaseDb) {
    return res.status(503).json(
      formatError('EXTERNAL_SERVICE_ERROR', 'Database connection not available')
    );
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

  return res.json(formatSuccess(allParties));
}));

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
router.get("/explanations/:partyId", asyncHandler(async (req, res) => {
  if (!supabaseDb) {
    return res.status(503).json(
      formatError('EXTERNAL_SERVICE_ERROR', 'Database connection not available')
    );
  }

  const { partyId } = req.params;
  let party;

  if (!isNaN(Number(partyId))) {
    const { data, error } = await supabaseDb
      .from('parties')
      .select('dimensionRationales')
      .eq('id', parseInt(partyId))
      .single();

    if (error || !data) {
      console.error('Error fetching party rationales:', error);
      return res.status(404).json(
        formatError('NOT_FOUND', 'Party not found')
      );
    }

    party = data;
  } else {
    const partyName = partyCodeToName[partyId];
    if (!partyName) {
      return res.status(404).json(
        formatError('NOT_FOUND', 'Unknown party code')
      );
    }

    const { data, error } = await supabaseDb
      .from('parties')
      .select('dimensionRationales')
      .eq('name', partyName)
      .single();

    if (error || !data) {
      console.error('Error fetching party rationales:', error);
      return res.status(404).json(
        formatError('NOT_FOUND', 'Party not found')
      );
    }

    party = data;
  }

  const explanations = party.dimensionRationales ? JSON.parse(party.dimensionRationales) : {};

  return res.json(formatSuccess(explanations));
}));

/**
 * POST /api/parties/explanations/:partyId - Update dimension explanations for a party
 * Supports both integer ID and party code
 */
router.post("/explanations/:partyId", asyncHandler(async (req, res) => {
  if (!supabaseDb) {
    return res.status(503).json(
      formatError('EXTERNAL_SERVICE_ERROR', 'Database connection not available')
    );
  }

  const { partyId } = req.params;
  const explanations = req.body;

  let filterColumn: string;
  let filterValue: string | number;

  if (!isNaN(Number(partyId))) {
    filterColumn = 'id';
    filterValue = parseInt(partyId);
  } else {
    const partyName = partyCodeToName[partyId];
    if (!partyName) {
      return res.status(404).json(
        formatError('NOT_FOUND', 'Unknown party code')
      );
    }
    filterColumn = 'name';
    filterValue = partyName;
  }

  const { data: existingParty, error: checkError } = await supabaseDb
    .from('parties')
    .select('id, name')
    .eq(filterColumn, filterValue)
    .single();

  if (checkError || !existingParty) {
    return res.status(404).json(
      formatError('NOT_FOUND', 'Party not found in database')
    );
  }

  const { data: result, error: updateError } = await supabaseDb
    .from('parties')
    .update({
      dimensionRationales: JSON.stringify(explanations)
    })
    .eq(filterColumn, filterValue)
    .select();

  if (updateError || !result || result.length === 0) {
    console.error('Error updating party explanations:', updateError);
    return res.status(500).json(
      formatError('OPERATION_FAILED', 'Failed to update explanations')
    );
  }

  // Clear cache when party data is updated
  const { cache } = await import('../../services/cacheService');
  cache.delete('parties:all');
  cache.delete('parties:positions');

  return res.json(formatSuccess(
    { message: `Explanations updated for ${existingParty.name}` },
    { partyId: existingParty.id }
  ));
}));

export default router;

