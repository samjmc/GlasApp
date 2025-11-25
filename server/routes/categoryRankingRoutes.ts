import { Router } from 'express';
import { db } from '../db.js';
import { userCategoryRankings, pledges } from '../../shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// Submit user's category ranking
router.post('/submit-ranking', async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const rankingSchema = z.object({
      rankings: z.array(z.object({
        category: z.string(),
        rank: z.number().min(1).max(4)
      }))
    });

    const { rankings } = rankingSchema.parse(req.body);
    const userId = req.session.userId;

    // Validate that all 4 categories are present and ranks are unique
    const categories = ['taxation', 'housing', 'health', 'infrastructure'];
    const submittedCategories = rankings.map(r => r.category).sort();
    const submittedRanks = rankings.map(r => r.rank).sort();

    if (JSON.stringify(submittedCategories) !== JSON.stringify(categories.sort()) ||
        JSON.stringify(submittedRanks) !== JSON.stringify([1, 2, 3, 4])) {
      return res.status(400).json({ 
        success: false, 
        message: 'All categories must be ranked with unique positions 1-4' 
      });
    }

    // Delete existing rankings for this user
    await db.delete(userCategoryRankings)
      .where(eq(userCategoryRankings.userId, userId.toString()));

    // Insert new rankings
    const rankingData = rankings.map(ranking => ({
      userId: userId.toString(),
      category: ranking.category,
      rank: ranking.rank
    }));

    await db.insert(userCategoryRankings).values(rankingData);

    res.json({ success: true, message: 'Rankings submitted successfully' });

  } catch (error) {
    console.error('Error submitting rankings:', error);
    res.status(500).json({ success: false, message: 'Failed to submit rankings' });
  }
});

// Get current weighted performance based on all user rankings
router.get('/weighted-performance/:partyId?', async (req, res) => {
  try {
    const partyId = req.params.partyId ? parseInt(req.params.partyId) : null;

    // Calculate average rank for each category across all users
    const avgRanks = await db
      .select({
        category: userCategoryRankings.category,
        avgRank: sql<number>`AVG(${userCategoryRankings.rank})`.as('avgRank'),
        voteCount: sql<number>`COUNT(*)`.as('voteCount')
      })
      .from(userCategoryRankings)
      .groupBy(userCategoryRankings.category);

    // Convert average ranks to weights (lower rank = higher weight)
    // Rank 1 = 40%, Rank 2 = 30%, Rank 3 = 20%, Rank 4 = 10%
    const categoryWeights: Record<string, number> = {};
    const defaultWeights = { taxation: 30, housing: 35, health: 15, infrastructure: 20 };

    if (avgRanks.length === 0) {
      // Use default weights if no votes yet
      Object.assign(categoryWeights, defaultWeights);
    } else {
      // Calculate weights based on average ranks
      const totalWeight = 100;
      const weightDistribution = [40, 30, 20, 10]; // For ranks 1, 2, 3, 4
      
      // Sort categories by average rank
      const sortedCategories = avgRanks.sort((a, b) => a.avgRank - b.avgRank);
      
      sortedCategories.forEach((cat, index) => {
        categoryWeights[cat.category] = weightDistribution[index] || 10;
      });

      // Fill in missing categories with default weights
      ['taxation', 'housing', 'health', 'infrastructure'].forEach(cat => {
        if (!(cat in categoryWeights)) {
          categoryWeights[cat] = defaultWeights[cat as keyof typeof defaultWeights];
        }
      });
    }

    let result: any = {
      categoryWeights,
      totalVotes: avgRanks.reduce((sum, cat) => sum + cat.voteCount, 0)
    };

    // If party ID provided, calculate weighted performance
    if (partyId) {
      // Get pledge performance by category for this party
      const pledgeStats = await db
        .select({
          category: pledges.category,
          avgScore: sql<number>`AVG(CAST(${pledges.score} AS DECIMAL))`.as('avgScore'),
          pledgeCount: sql<number>`COUNT(*)`.as('pledgeCount')
        })
        .from(pledges)
        .where(eq(pledges.partyId, partyId))
        .groupBy(pledges.category);

      const categoryBreakdown: Record<string, any> = {};
      let weightedTotal = 0;
      let totalWeight = 0;

      pledgeStats.forEach(stat => {
        // Map pledge categories to weight categories
        const categoryMap: Record<string, string> = {
          'Housing': 'housing',
          'Taxation': 'taxation',
          'Health': 'health',
          'health': 'health',
          'Infrastructure': 'infrastructure',
          'housing': 'housing',
          'taxation': 'taxation',
          'infrastructure': 'infrastructure'
        };
        
        const weightKey = categoryMap[stat.category] || stat.category.toLowerCase();
        const weight = categoryWeights[weightKey] || 0;
        const score = stat.avgScore || 0;
        
        categoryBreakdown[stat.category] = {
          score,
          weight,
          pledgeCount: stat.pledgeCount,
          contribution: (score * weight) / 100
        };

        weightedTotal += (score * weight) / 100;
        totalWeight += weight;
      });

      result.weightedScore = totalWeight > 0 ? weightedTotal : 0;
      result.categoryBreakdown = categoryBreakdown;
      result.partyId = partyId;
    }

    res.json({ success: true, data: result });

  } catch (error) {
    console.error('Error calculating weighted performance:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate performance' });
  }
});

// Get user's current rankings
router.get('/user-rankings', async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const userId = req.session.userId;
    const rankings = await db
      .select()
      .from(userCategoryRankings)
      .where(eq(userCategoryRankings.userId, userId.toString()));

    res.json({ success: true, data: rankings });

  } catch (error) {
    console.error('Error fetching user rankings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rankings' });
  }
});

export default router;