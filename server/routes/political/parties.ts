import { requireJob } from '../../auth';
/**
 * Party Routes
 * Handles all party-related operations:
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

  const client = supabaseDb;
  const partyDimensions = await cached(
    CacheKeys.parties.positions(),
    TTL.ONE_DAY,
    async () => {
      const { data, error } = await client
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

  const client = supabaseDb;
  const allParties = await cached(
    CacheKeys.parties.all(),
    TTL.ONE_DAY,
    async () => {
      const { data, error } = await client
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
router.post("/explanations/:partyId", requireJob, asyncHandler(async (req, res) => {
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
  await cache.del('parties:all');
  await cache.del('parties:positions');

  return res.json(formatSuccess(
    { message: `Explanations updated for ${existingParty.name}` },
    { partyId: existingParty.id }
  ));
}));

export default router;

