
import { Router } from 'express';
import { getVotingStats, getRecentVotes, getRebelVotes } from '../../services/politicianAgent';

const router = Router();

router.get('/stats/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const stats = await getVotingStats(name);
    if (!stats) return res.status(404).json({ error: 'Politician not found' });
    res.json(stats);
  } catch (error) {
    console.error('Error fetching voting stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/recent/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const limit = parseInt(req.query.limit as string) || 5;
    const votes = await getRecentVotes(name, limit);
    res.json({ votes });
  } catch (error) {
    console.error('Error fetching recent votes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/rebel/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const limit = parseInt(req.query.limit as string) || 10;
    const votes = await getRebelVotes(name, limit);
    res.json({ votes });
  } catch (error) {
    console.error('Error fetching rebel votes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


