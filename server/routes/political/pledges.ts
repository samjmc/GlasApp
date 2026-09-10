/**
 * Pledge Routes
 * Handles all pledge-related operations:
 * - CRUD operations for pledges
 * - Pledge actions tracking
 * - Party performance scoring
 * - Category weighting/voting
 * - Individual pledge weighting
 */

import { Router } from 'express';
import { db } from '../../db';
import { pledges, pledgeActions, partyPerformanceScores, parties } from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import {
  calculatePledgeScore,
  calculatePartyPerformanceScores,
  type PartyPerformanceMetrics
} from '../../services/pledgeScoring';
import { insertPledgeSchema } from '@shared/schema';
import { isAuthenticated } from '../../replitAuth';
import { asyncHandler } from '../../middleware/errorHandler';
import { formatSuccess, formatError, ErrorCodes } from '../../utils/responseFormatters';

const router = Router();

// ============================================
// CRUD Operations for Pledges
// ============================================

/**
 * POST /api/pledges - Create a new pledge
 */
router.post('/', asyncHandler(async (req, res) => {
  const validatedData = insertPledgeSchema.parse(req.body);

  const [party] = await db
    .select()
    .from(parties)
    .where(eq(parties.id, validatedData.partyId));

  if (!party) {
    return res.status(404).json(
      formatError('NOT_FOUND', 'Party not found')
    );
  }

  const governmentParties = ['Fine Gael', 'Fianna Fáil'];
  const scoreType = governmentParties.includes(party.name) ? 'fulfillment' : 'advocacy';

  const [newPledge] = await db
    .insert(pledges)
    .values({
      ...validatedData,
      scoreType: scoreType,
      targetDate: validatedData.targetDate ? new Date(validatedData.targetDate) : null
    })
    .returning();

  return res.status(201).json(formatSuccess(newPledge));
}));

/**
 * GET /api/pledges/:pledgeId - Get pledge details with actions
 */
router.get('/:pledgeId', asyncHandler(async (req, res) => {
  const pledgeId = parseInt(req.params.pledgeId);

  const [pledge] = await db
    .select({
      pledge: pledges,
      partyName: parties.name,
    })
    .from(pledges)
    .innerJoin(parties, eq(pledges.partyId, parties.id))
    .where(eq(pledges.id, pledgeId));

  if (!pledge) {
    return res.status(404).json(
      formatError('NOT_FOUND', 'Pledge not found')
    );
  }

  const actions = await db
    .select()
    .from(pledgeActions)
    .where(eq(pledgeActions.pledgeId, pledgeId))
    .orderBy(desc(pledgeActions.actionDate));

  return res.json(formatSuccess({
    ...pledge,
    actions
  }));
}));

/**
 * PUT /api/pledges/:pledgeId - Update pledge
 */
router.put('/:pledgeId', asyncHandler(async (req, res) => {
  const pledgeId = parseInt(req.params.pledgeId);
  const updateData = req.body;

  const [updatedPledge] = await db
    .update(pledges)
    .set({
      ...updateData,
      targetDate: updateData.targetDate ? new Date(updateData.targetDate) : null,
      lastUpdated: new Date()
    })
    .where(eq(pledges.id, pledgeId))
    .returning();

  if (!updatedPledge) {
    return res.status(404).json(
      formatError('NOT_FOUND', 'Pledge not found')
    );
  }

  return res.json(formatSuccess(updatedPledge));
}));

/**
 * DELETE /api/pledges/:pledgeId - Delete pledge
 */
router.delete('/:pledgeId', asyncHandler(async (req, res) => {
  const pledgeId = parseInt(req.params.pledgeId);

  await db
    .delete(pledgeActions)
    .where(eq(pledgeActions.pledgeId, pledgeId));

  const [deletedPledge] = await db
    .delete(pledges)
    .where(eq(pledges.id, pledgeId))
    .returning();

  if (!deletedPledge) {
    return res.status(404).json(
      formatError('NOT_FOUND', 'Pledge not found')
    );
  }

  return res.json(formatSuccess({ message: 'Pledge deleted successfully' }));
}));

// ============================================
// Party Pledges & Efficiency Scoring
// ============================================

/**
 * GET /api/pledges/party/:partyId - Get all pledges for a party with efficiency scoring
 */
router.get('/party/:partyId', asyncHandler(async (req, res) => {
  const partyId = parseInt(req.params.partyId);

  const tdCounts: Record<number, number> = {
    1: 37, // Sinn Féin
    2: 38, // Fine Gael
    3: 38, // Fianna Fáil
    6: 6,  // Social Democrats
    8: 2   // Aontú
  };

  const partyPledges = await db
    .select({
      pledges: pledges,
      parties: parties
    })
    .from(pledges)
    .innerJoin(parties, eq(pledges.partyId, parties.id))
    .where(eq(pledges.partyId, partyId))
    .orderBy(desc(pledges.lastUpdated));

  const numberOfTDs = tdCounts[partyId] || 1;
  const pledgesWithEfficiency = partyPledges.map(item => {
    const pledge = item.pledges;
    const partyName = item.parties.name;
    const score = Number(pledge.score) || 0;
    const weight = Number(pledge.defaultWeight) || 0;
    const contribution = (score * weight) / 100;
    const efficiencyScore = contribution / numberOfTDs;

    return {
      pledge: {
        ...pledge,
        contribution: Math.round(contribution * 100) / 100,
        efficiencyScore: Math.round(efficiencyScore * 100) / 100,
        numberOfTDs,
        defaultWeight: weight
      },
      partyName
    };
  });

  const totalContribution = pledgesWithEfficiency.reduce((sum, item) =>
    sum + (item.pledge.contribution || 0), 0);
  const overallEfficiency = totalContribution / numberOfTDs;

  return res.json(formatSuccess(pledgesWithEfficiency, {
    partyId,
    numberOfTDs,
    totalContribution: Math.round(totalContribution * 100) / 100,
    overallEfficiency: Math.round(overallEfficiency * 100) / 100,
    pledgeCount: pledgesWithEfficiency.length
  }));
}));

// ============================================
// Pledge Actions
// ============================================

/**
 * POST /api/pledges/:pledgeId/actions - Add a new pledge action
 */
router.post('/:pledgeId/actions', asyncHandler(async (req, res) => {
  const pledgeId = parseInt(req.params.pledgeId);
  const { actionType, description, actionDate, impactScore, sourceUrl, evidenceDetails } = req.body;

  const [newAction] = await db
    .insert(pledgeActions)
    .values({
      pledgeId,
      actionType,
      description,
      actionDate: new Date(actionDate),
      impactScore: impactScore?.toString() || '5',
      sourceUrl,
      evidenceDetails
    })
    .returning();

  await calculatePledgeScore(pledgeId);

  return res.json(formatSuccess(newAction));
}));

/**
 * POST /api/pledges/:pledgeId/recalculate - Recalculate pledge score
 */
router.post('/:pledgeId/recalculate', asyncHandler(async (req, res) => {
  const pledgeId = parseInt(req.params.pledgeId);

  const newScore = await calculatePledgeScore(pledgeId);

  return res.json(formatSuccess({
    pledgeId,
    newScore
  }));
}));

// ============================================
// Party Performance Scoring
// ============================================

/**
 * GET /api/pledges/performance/:partyId - Get party performance scores
 */
router.get('/performance/:partyId', asyncHandler(async (req, res) => {
  const partyId = parseInt(req.params.partyId);

  const latestScores = await db
    .select()
    .from(partyPerformanceScores)
    .where(eq(partyPerformanceScores.partyId, partyId))
    .orderBy(desc(partyPerformanceScores.calculatedAt))
    .limit(2);

  if (latestScores.length === 0) {
    const metrics = await calculatePartyPerformanceScores(partyId);
    return res.json(formatSuccess(metrics));
  }

  const performanceScore = latestScores.find(s => s.scoreType === 'performance');
  const trustworthinessScore = latestScores.find(s => s.scoreType === 'trustworthiness');

  const [party] = await db
    .select()
    .from(parties)
    .where(eq(parties.id, partyId));

  const formattedMetrics: PartyPerformanceMetrics = {
    partyId: partyId,
    partyName: party?.name || 'Unknown Party',
    governmentStatus: performanceScore?.governmentStatus as unknown || 'opposition',
    overallPerformanceScore: parseFloat(performanceScore?.overallScore || '50'),
    overallTrustworthinessScore: parseFloat(trustworthinessScore?.overallScore || '50'),
    pledgeFulfillmentScore: parseFloat(performanceScore?.pledgeFulfillmentScore || '50'),
    policyConsistencyScore: parseFloat(performanceScore?.policyConsistencyScore || '50'),
    parliamentaryActivityScore: parseFloat(performanceScore?.parliamentaryActivityScore || '50'),
    integrityScore: parseFloat(performanceScore?.integrityScore || '50'),
    transparencyScore: parseFloat(trustworthinessScore?.transparencyScore || '50'),
    factualAccuracyScore: parseFloat(trustworthinessScore?.factualAccuracyScore || '50'),
    publicAccountabilityScore: parseFloat(trustworthinessScore?.publicAccountabilityScore || '50'),
    conflictAvoidanceScore: parseFloat(trustworthinessScore?.conflictAvoidanceScore || '50'),
  };

  return res.json(formatSuccess(formattedMetrics));
}));

/**
 * POST /api/pledges/performance/:partyId/recalculate - Recalculate all performance scores for a party
 */
router.post('/performance/:partyId/recalculate', asyncHandler(async (req, res) => {
  const partyId = parseInt(req.params.partyId);

  const metrics = await calculatePartyPerformanceScores(partyId);

  return res.json(formatSuccess(metrics));
}));

// ============================================
// Category Weighting/Voting
// (From pledgeVotingRoutes.ts)
// ============================================

/**
 * GET /api/pledges/weighted-performance/:partyId - Get weighted pledge performance by category
 */
router.get('/weighted-performance/:partyId', asyncHandler(async (req, res) => {
  const { partyId } = req.params;

  const partyPledges = await db
    .select()
    .from(pledges)
    .where(eq(pledges.partyId, parseInt(partyId)));

  const defaultWeights: Record<string, number> = {
    'taxation': 30,
    'housing': 35,
    'health': 15,
    'infrastructure': 20,
    'social_welfare': 10,
    'childcare': 10,
    'justice': 5
  };

  const categoryPerformance: any = {};
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const pledge of partyPledges) {
    if (!categoryPerformance[pledge.category]) {
      categoryPerformance[pledge.category] = {
        pledges: [],
        categoryWeight: defaultWeights[pledge.category] || 5
      };
    }
    categoryPerformance[pledge.category].pledges.push(pledge);
  }

  for (const [category, data] of Object.entries(categoryPerformance)) {
    const categoryData = data as any;
    const categoryWeight = categoryData.categoryWeight;

    const categoryAverage = categoryData.pledges.reduce((sum: number, pledge: any) => {
      return sum + parseFloat(pledge.score);
    }, 0) / categoryData.pledges.length;

    totalWeightedScore += categoryAverage * (categoryWeight / 100);
    totalWeight += categoryWeight;
  }

  return res.json(formatSuccess({
    overallScore: Math.round(totalWeightedScore),
    categoryBreakdown: categoryPerformance,
    defaultWeights: defaultWeights
  }));
}));

/**
 * GET /api/pledges/category-weights - Get category weights
 */
router.get('/category-weights', asyncHandler(async (req, res) => {
  const defaultWeights = [
    { category: 'taxation', defaultWeight: '30.00', displayName: 'Cost of Living & Tax' },
    { category: 'housing', defaultWeight: '35.00', displayName: 'Housing' },
    { category: 'health', defaultWeight: '15.00', displayName: 'Health' },
    { category: 'infrastructure', defaultWeight: '20.00', displayName: 'Infrastructure' }
  ];
  return res.json(formatSuccess(defaultWeights));
}));

/**
 * GET /api/pledges/user-category-votes - Get user category votes
 */
router.get('/user-category-votes', asyncHandler(async (req, res) => {
  const defaultWeights = [
    { category: 'taxation', weight: '30.00', displayName: 'Cost of Living & Tax' },
    { category: 'housing', weight: '35.00', displayName: 'Housing' },
    { category: 'health', weight: '15.00', displayName: 'Health' },
    { category: 'infrastructure', weight: '20.00', displayName: 'Infrastructure' }
  ];
  return res.json(formatSuccess(defaultWeights, { isDefault: true }));
}));

/**
 * POST /api/pledges/category-votes - Submit category votes
 */
router.post('/category-votes', isAuthenticated, asyncHandler(async (req, res) => {
  const { votes } = req.body;

  const totalWeight = votes.reduce((sum: number, vote: any) => sum + parseFloat(vote.weight), 0);
  if (Math.abs(totalWeight - 100) > 0.01) {
    return res.status(400).json(
      formatError('VALIDATION_ERROR', 'Category weights must sum to 100%')
    );
  }

  console.log('Category votes received:', votes);

  return res.json(formatSuccess({ message: 'Category votes submitted successfully' }));
}));

// ============================================
// Individual Pledge Weighting
// (From pledgeWeightingRoutes.ts)
// ============================================

// Individual pledge weightings based on importance
const pledgeWeightings: Record<number, Record<string, number>> = {
  // Fine Gael (party_id: 2) individual pledge weights
  2: {
    "Cap day-to-day spending growth at 5% p.a.": 10.0,
    "Transfer 0.8% GDP into sovereign-wealth & infrastructure funds annually": 15.0,
    "Cut income tax by raising lower- & higher-rate thresholds": 10.0,
    "Reduce VAT on food businesses from 13% to 11%": 5.0,
    "Boost first-time-buyer tax rebate": 5.0,
    "Extend shared-equity scheme to all home purchasers": 5.0,
    "Maintain rent-pressure zones (RPZs)": 5.0,
    "Increase renter tax credit": 5.0,
    "Legally binding asylum-processing timeframes": 5.0,
    "Strengthen border security & create High Court division": 5.0,
    "Restrict movement of asylum applicants in state accommodation": 5.0,
    "Deploy €14 billion Apple-tax windfall to housing, grid, water, transport": 15.0,
    "Deepen 'Shared Island' North–South cooperation": 10.0
  },
  
  // Fianna Fáil (party_id: 3) individual pledge weights
  3: {
    "Cut USC lower rate from 3% to 1.5%": 8.0,
    "Raise higher-rate tax entry point to €50,000": 8.0,
    "Increase state pension to €350/week": 12.0,
    "Cap childcare costs at €200/month": 10.0,
    "Abolish means test for Carer's Allowance": 6.0,
    "Build 60,000 homes per year by 2030": 15.0,
    "Protect and extend Help-to-Buy and First Home schemes to 2030": 4.0,
    "Increase vacancy/refurbishment grants by €10,000": 3.0,
    "Create 2,000 Housing First tenancies": 3.0,
    "Introduce €2,500 legal-fees tax credit for first-time buyers": 2.0,
    "Raise rent tax credit to €2,000": 5.0,
    "Add 4,000 hospital beds and 100 ICU beds": 10.0,
    "Extend free GP care to under-12s": 8.0,
    "Reduce Drugs Payment Scheme cap from €80 to €40": 4.0,
    "Provide free Hormone Replacement Therapy (HRT)": 2.0,
    "Decriminalise certain drugs including cannabis": 3.0,
    "Ring-fence €3 billion from AIB shares for infrastructure": 8.0,
    "Allocate €1 billion to Irish Water capital upgrades": 5.0,
    "Invest €750 million in electricity grid upgrades": 4.0
  }
};

/**
 * GET /api/pledges/individual-weighted-performance/:partyId - Get weighted performance using individual pledge weights
 */
router.get('/individual-weighted-performance/:partyId', asyncHandler(async (req, res) => {
  const partyId = parseInt(req.params.partyId);

  if (!partyId) {
    return res.status(400).json(
      formatError('VALIDATION_ERROR', 'Valid party ID required')
    );
  }

  const partyPledges = await db
    .select({
      id: pledges.id,
      title: pledges.title,
      score: pledges.score,
      category: pledges.category
    })
    .from(pledges)
    .where(sql`${pledges.partyId} = ${partyId}`);

  const pledgeWeights = pledgeWeightings[partyId] || {};

  let weightedTotal = 0;
  let totalWeight = 0;
  const pledgeBreakdown: Record<string, any> = {};

  partyPledges.forEach(pledge => {
    const pledgeTitle = pledge.title || '';
    let weight = pledgeWeights[pledgeTitle] || 0;
    if (weight === 0 && pledgeTitle.startsWith('"') && pledgeTitle.endsWith('"')) {
      const titleWithoutQuotes = pledgeTitle.slice(1, -1);
      weight = pledgeWeights[titleWithoutQuotes] || 0;
    }
    const score = parseFloat(pledge.score || '0') || 0;
    const contribution = (score * weight) / 100;

    pledgeBreakdown[pledge.title || ''] = {
      score,
      weight,
      category: pledge.category,
      contribution
    };

    weightedTotal += contribution;
    totalWeight += weight;
  });

  const categoryBreakdown: Record<string, any> = {};
  partyPledges.forEach(pledge => {
    const category = pledge.category || 'Uncategorized';
    const weight = pledgeWeights[pledge.title || ''] || 0;
    const score = parseFloat(pledge.score || '0') || 0;

    if (!categoryBreakdown[category]) {
      categoryBreakdown[category] = {
        totalWeight: 0,
        weightedScore: 0,
        pledgeCount: 0,
        pledges: []
      };
    }

    categoryBreakdown[category].totalWeight += weight;
    categoryBreakdown[category].weightedScore += (score * weight) / 100;
    categoryBreakdown[category].pledgeCount += 1;
    categoryBreakdown[category].pledges.push({
      title: pledge.title,
      score,
      weight
    });
  });

  Object.keys(categoryBreakdown).forEach(category => {
    const catData = categoryBreakdown[category];
    catData.averageScore = catData.totalWeight > 0
      ? (catData.weightedScore / catData.totalWeight) * 100
      : 0;
  });

  const result = {
    partyId,
    weightedScore: totalWeight > 0 ? weightedTotal : 0,
    totalWeight,
    pledgeCount: partyPledges.length,
    weightedPledgeCount: Object.keys(pledgeWeights).length,
    pledgeBreakdown,
    categoryBreakdown
  };

  return res.json(formatSuccess(result));
}));

/**
 * GET /api/pledges/available-parties - Get available parties with pledge weightings
 */
router.get('/available-parties', asyncHandler(async (req, res) => {
  const availableParties = Object.keys(pledgeWeightings).map(partyId => ({
    partyId: parseInt(partyId),
    weightedPledgeCount: Object.keys(pledgeWeightings[parseInt(partyId)]).length
  }));

  return res.json(formatSuccess(availableParties));
}));

export default router;

