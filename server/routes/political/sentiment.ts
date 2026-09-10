/**
 * Party Sentiment Routes
 * Handles party sentiment analysis and public trust voting
 */

import { Router } from 'express';
import { storage } from '../../storage';
import { z } from 'zod';
import { isAuthenticated } from '../../replitAuth';
import { asyncHandler } from '../../middleware/errorHandler';
import { formatSuccess, formatError, ErrorCodes } from '../../utils/responseFormatters';

const router = Router();

// Schema for party sentiment vote
const sentimentVoteSchema = z.object({
  partyId: z.string(),
  sentimentScore: z.number().min(0).max(100)
});

/**
 * POST /api/party-sentiment/vote - Submit a sentiment vote
 */
router.post('/vote', isAuthenticated, asyncHandler(async (req: any, res) => {
  const userId = req.user?.claims?.sub;
  if (!userId) {
    return res.status(401).json(
      formatError('UNAUTHORIZED', 'Authentication required')
    );
  }

  const { partyId, sentimentScore } = sentimentVoteSchema.parse(req.body);

  await storage.upsertPartySentimentVote(userId, partyId, sentimentScore);

  return res.json(formatSuccess({ message: 'Vote submitted successfully' }));
}));

/**
 * GET /api/party-sentiment/:partyId - Get sentiment data for a party
 */
router.get('/:partyId', asyncHandler(async (req, res) => {
  const { partyId } = req.params;

  const sentimentData = await storage.getPartySentimentData(partyId);

  return res.json(formatSuccess(sentimentData));
}));

/**
 * GET /api/party-sentiment/user/:partyId - Get user's vote for a party
 */
router.get('/user/:partyId', isAuthenticated, asyncHandler(async (req: any, res) => {
  const userId = req.user?.claims?.sub;
  if (!userId) {
    return res.status(401).json(
      formatError('UNAUTHORIZED', 'Authentication required')
    );
  }

  const { partyId } = req.params;

  const userVote = await storage.getUserPartySentimentVote(userId, partyId);

  return res.json(formatSuccess(userVote));
}));

export default router;
