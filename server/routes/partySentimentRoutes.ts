import { Router } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import { isAuthenticated } from '../replitAuth';

const router = Router();

// Schema for party sentiment vote
const sentimentVoteSchema = z.object({
  partyId: z.string(),
  sentimentScore: z.number().min(0).max(100)
});

// POST /api/party-sentiment/vote - Submit a sentiment vote
router.post('/vote', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { partyId, sentimentScore } = sentimentVoteSchema.parse(req.body);
    
    await storage.upsertPartySentimentVote(userId, partyId, sentimentScore);
    
    res.json({ success: true, message: 'Vote submitted successfully' });
  } catch (error) {
    console.error('Error submitting sentiment vote:', error);
    res.status(500).json({ success: false, message: 'Failed to submit vote' });
  }
});

// GET /api/party-sentiment/:partyId - Get sentiment data for a party
router.get('/:partyId', async (req, res) => {
  try {
    const { partyId } = req.params;
    
    const sentimentData = await storage.getPartySentimentData(partyId);
    
    res.json({ success: true, data: sentimentData });
  } catch (error) {
    console.error('Error fetching sentiment data:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sentiment data' });
  }
});

// GET /api/party-sentiment/user/:partyId - Get user's vote for a party
router.get('/user/:partyId', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { partyId } = req.params;
    
    const userVote = await storage.getUserPartySentimentVote(userId, partyId);
    
    res.json({ success: true, data: userVote });
  } catch (error) {
    console.error('Error fetching user vote:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user vote' });
  }
});

export default router;