/**
 * Political Routes Index
 * Consolidated router setup for party matching and dimensions.
 * Pledge tracking lives in server/pledges (/api/pledges).
 */

import { Router } from 'express';
import partyRoutes from './parties';

const router = Router();

/**
 * Party routes
 * - GET  /parties - Get all parties
 * - GET  /parties/dimensions - Get party dimensional positions
 * - POST /parties/matches - Get party matches using dimensions
 * - GET  /parties/explanations/:partyId - Get dimension explanations
 * - POST /parties/explanations/:partyId - Update dimension explanations
 */
router.use('/parties', partyRoutes);

export default router;
