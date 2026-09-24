/**
 * Political Routes Index
 * Consolidated router setup for all political analysis routes:
 * - Party matching and dimensions
 * - Party sentiment analysis
 * Pledge tracking lives in server/pledges (/api/pledges).
 */

import { Router } from 'express';
import partyRoutes from './parties';
import sentimentRoutes from './sentiment';

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

/**
 * Sentiment routes
 * - POST /sentiment/vote - Submit sentiment vote
 * - GET  /sentiment/:partyId - Get sentiment data
 * - GET  /sentiment/user/:partyId - Get user's vote
 */
router.use('/sentiment', sentimentRoutes);

export default router;
