/**
 * Political Routes Index
 * Consolidated router setup for all political analysis routes:
 * - Party matching and dimensions
 * - Pledge tracking and scoring
 * - Party sentiment analysis
 */

import { Router } from 'express';
import partyRoutes from './parties';
import pledgeRoutes from './pledges';
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
 * Pledge routes
 * - POST /pledges - Create pledge
 * - GET  /pledges/:pledgeId - Get pledge details
 * - PUT  /pledges/:pledgeId - Update pledge
 * - DELETE /pledges/:pledgeId - Delete pledge
 * - GET  /pledges/party/:partyId - Get party pledges with efficiency
 * - POST /pledges/:pledgeId/actions - Add pledge action
 * - POST /pledges/:pledgeId/recalculate - Recalculate pledge score
 * - GET  /pledges/performance/:partyId - Get performance scores
 * - POST /pledges/performance/:partyId/recalculate - Recalculate performance
 * - GET  /pledges/weighted-performance/:partyId - Get weighted performance
 * - GET  /pledges/category-weights - Get category weights
 * - GET  /pledges/user-category-votes - Get user votes
 * - POST /pledges/category-votes - Submit category votes
 * - GET  /pledges/individual-weighted-performance/:partyId - Get individual weights
 * - GET  /pledges/available-parties - Get parties with weights
 */
router.use('/pledges', pledgeRoutes);

/**
 * Sentiment routes
 * - POST /sentiment/vote - Submit sentiment vote
 * - GET  /sentiment/:partyId - Get sentiment data
 * - GET  /sentiment/user/:partyId - Get user's vote
 */
router.use('/sentiment', sentimentRoutes);

export default router;
