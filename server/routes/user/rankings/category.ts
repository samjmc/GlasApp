import { requireAuth } from '../../../auth';
/**
 * Category Ranking Routes
 * Handles user category preference rankings and weighted performance calculations
 */

import { Router } from 'express';
import { db } from '../../../db.js';
import { userCategoryRankings, pledges } from '../../../../shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { asyncHandler } from '../../../middleware/errorHandler.js';
import { formatSuccess, formatError } from '../../../utils/responseFormatters.js';

const router = Router();

/**
 * POST /api/user/rankings/category/submit-ranking
 * Submit user's category ranking
 */
router.post('/submit-ranking', requireAuth, asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json(
      formatError('UNAUTHORIZED', 'Authentication required')
    );
  }

  const rankingSchema = z.object({
    rankings: z.array(z.object({
      category: z.string(),
      rank: z.number().min(1).max(4)
    }))
  });

  const { rankings } = rankingSchema.parse(req.body);
  const userId = req.user.id;

  const categories = ['taxation', 'housing', 'health', 'infrastructure'];
  const submittedCategories = rankings.map(r => r.category).sort();
  const submittedRanks = rankings.map(r => r.rank).sort();

  if (JSON.stringify(submittedCategories) !== JSON.stringify(categories.sort()) ||
      JSON.stringify(submittedRanks) !== JSON.stringify([1, 2, 3, 4])) {
    return res.status(400).json(
      formatError('VALIDATION_ERROR', 'All categories must be ranked with unique positions 1-4')
    );
  }

  await db.delete(userCategoryRankings)
    .where(eq(userCategoryRankings.userId, userId));

  const rankingData = rankings.map(ranking => ({
    userId: userId,
    category: ranking.category,
    rank: ranking.rank
  }));

  await db.insert(userCategoryRankings).values(rankingData);

  res.json(formatSuccess({ message: 'Rankings submitted successfully' }));
}));

/**
 * GET /api/user/rankings/category/weighted-performance/:partyId?
 * Get current weighted performance based on all user rankings
 */
router.get('/weighted-performance/:partyId?', asyncHandler(async (req, res) => {
  const partyId = req.params.partyId ? parseInt(req.params.partyId) : null;

  const avgRanks = await db
    .select({
      category: userCategoryRankings.category,
      avgRank: sql<number>`AVG(${userCategoryRankings.rank})`.as('avgRank'),
      voteCount: sql<number>`COUNT(*)`.as('voteCount')
    })
    .from(userCategoryRankings)
    .groupBy(userCategoryRankings.category);

  const categoryWeights: Record<string, number> = {};
  const defaultWeights = { taxation: 30, housing: 35, health: 15, infrastructure: 20 };

  if (avgRanks.length === 0) {
    Object.assign(categoryWeights, defaultWeights);
  } else {
    const totalWeight = 100;
    const weightDistribution = [40, 30, 20, 10];

    const sortedCategories = avgRanks.sort((a, b) => a.avgRank - b.avgRank);

    sortedCategories.forEach((cat, index) => {
      categoryWeights[cat.category] = weightDistribution[index] || 10;
    });

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

  if (partyId) {
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

  res.json(formatSuccess(result));
}));

/**
 * GET /api/user/rankings/category/user-rankings
 * Get user's current rankings
 */
router.get('/user-rankings', asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json(
      formatError('UNAUTHORIZED', 'Authentication required')
    );
  }

  const userId = req.user.id;
  const rankings = await db
    .select()
    .from(userCategoryRankings)
    .where(eq(userCategoryRankings.userId, userId));

  res.json(formatSuccess({ data: rankings }));
}));

export default router;
