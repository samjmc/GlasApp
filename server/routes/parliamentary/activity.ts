/**
 * Parliamentary Activity Routes
 * Handles parliamentary activity statistics: questions asked, attendance, party stats
 * Consolidated from parliamentaryActivityRoutes.ts
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { asyncHandler } from '../../middleware/errorHandler';
import { formatSuccess, formatError, ErrorCodes } from '../../utils/responseFormatters';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// Load parliamentary activity data
interface ParliamentaryActivityMember {
  fullName?: string;
  party?: string;
  questionsAsked?: number;
  dailAttendance?: number;
  otherAttendance?: number;
  attendancePercentage?: number;
}

interface PartyParliamentaryActivity {
  activityScore?: number;
  combinedActivityScore?: number;
  questionsAsked?: number;
  tdCount?: number;
  questionsPerTD?: number;
  averageAttendance?: number | null;
  attendanceScore?: number | null;
  questionsScore?: number | null;
  weighting?: string;
}

let parliamentaryActivityData: Record<string, ParliamentaryActivityMember> = {};
let partyActivityData: Record<string, PartyParliamentaryActivity> = {};

try {
  const dataPath = path.join(__dirname, '..', '..', 'data', 'parliamentary-activity.json');
  if (fs.existsSync(dataPath)) {
    const rawData = fs.readFileSync(dataPath, 'utf8');
    parliamentaryActivityData = JSON.parse(rawData);
    console.log(`Loaded parliamentary data for ${Object.keys(parliamentaryActivityData).length} politicians`);
  } else {
    console.error('Parliamentary activity data file not found at:', dataPath);
  }
} catch (error) {
  console.error('Error loading parliamentary activity data:', error);
}

try {
  const partyDataPath = path.join(__dirname, '..', '..', 'data', 'party-parliamentary-activity.json');
  if (fs.existsSync(partyDataPath)) {
    const rawPartyData = fs.readFileSync(partyDataPath, 'utf8');
    partyActivityData = JSON.parse(rawPartyData);
    console.log(`Loaded party activity scores for ${Object.keys(partyActivityData).length} parties`);
  } else {
    console.error('Party parliamentary activity data file not found at:', partyDataPath);
  }
} catch (error) {
  console.error('Error loading party parliamentary activity data:', error);
}

// Normalize name for matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[áàâäã]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôöõ]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
    .replace(/[''`]/g, '')
    .replace(/[.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * GET /api/parliamentary/activity/politician/:name - Get parliamentary activity for a specific politician
 */
router.get('/politician/:name', asyncHandler(async (req, res) => {
  const politicianName = req.params.name;
  const normalizedName = normalizeName(politicianName);

  const activityData = parliamentaryActivityData[normalizedName];

  // If exact match fails, try fuzzy matching
  if (!activityData) {
    const availableKeys = Object.keys(parliamentaryActivityData);
    const fuzzyMatch = availableKeys.find(key => {
      const keyWords = key.split(' ');
      const nameWords = normalizedName.split(' ');
      return keyWords.length === nameWords.length &&
        keyWords.every((word, index) => word === nameWords[index]);
    });

    if (fuzzyMatch) {
      return res.json(formatSuccess(parliamentaryActivityData[fuzzyMatch]));
    }

    // Try searching by parts of the name
    const partialMatch = availableKeys.find(key => {
      const lastName = normalizedName.split(' ').pop();
      const firstNames = normalizedName.split(' ').slice(0, -1);
      return lastName && key.includes(lastName) && firstNames.some(fname => key.includes(fname));
    });

    if (partialMatch) {
      return res.json(formatSuccess(parliamentaryActivityData[partialMatch]));
    }
  }

  if (activityData) {
    return res.json(formatSuccess(activityData));
  }

  return res.status(404).json(
    formatError('ENTITY_NOT_FOUND', 'Parliamentary activity data not found for this politician')
  );
}));

/**
 * GET /api/parliamentary/activity/party/:partyId/stats - Get parliamentary activity statistics by party
 */
router.get('/party/:partyId/stats', asyncHandler(async (req, res) => {
  const partyId = req.params.partyId;

  // Map party IDs to party names
  const partyNameMapping: Record<string, string[]> = {
    'ie-ff': ['Fianna Fáil'],
    'ie-fg': ['Fine Gael'],
    'ie-sf': ['Sinn Féin'],
    'ie-labour': ['Labour Party'],
    'ie-sd': ['Social Democrats'],
    'ie-green': ['Green Party'],
    'ie-pbp': ['People Before Profit', 'Solidarity', 'People Before Profit-Solidarity'],
    'ie-aontu': ['Aontú'],
    'ie-independent-ireland': ['Independent Ireland'],
    'ie-independent': ['Independent']
  };

  const partyNames = partyNameMapping[partyId] || [];

  const partyMembers = Object.values(parliamentaryActivityData).filter((member) =>
    partyNames.some(name => member.party && member.party.includes(name))
  );

  if (partyMembers.length === 0) {
    return res.status(404).json(
      formatError('ENTITY_NOT_FOUND', 'No parliamentary activity data found for this party')
    );
  }

  // Calculate party statistics
  const totalMembers = partyMembers.length;
  const totalQuestions = partyMembers.reduce((sum: number, member) => sum + (member.questionsAsked || 0), 0);
  const totalAttendance = partyMembers.reduce((sum: number, member) => sum + (member.dailAttendance || 0), 0);
  const totalOtherAttendance = partyMembers.reduce((sum: number, member) => sum + (member.otherAttendance || 0), 0);

  const avgQuestions = Math.round(totalQuestions / totalMembers);
  const avgAttendance = Math.round((totalAttendance / totalMembers / 29) * 100);
  const avgOtherAttendance = Math.round(totalOtherAttendance / totalMembers);

  // Find top performers
  const topQuestionAsker = partyMembers.reduce((top, member) =>
    (member.questionsAsked || 0) > (top.questionsAsked || 0) ? member : top
  );

  const topAttendee = partyMembers.reduce((top, member) =>
    (member.attendancePercentage || 0) > (top.attendancePercentage || 0) ? member : top
  );

  const stats = {
    totalMembers,
    averageQuestions: avgQuestions,
    averageAttendance: avgAttendance,
    averageOtherAttendance: avgOtherAttendance,
    totalQuestions,
    topQuestionAsker: {
      name: topQuestionAsker.fullName,
      questions: topQuestionAsker.questionsAsked
    },
    topAttendee: {
      name: topAttendee.fullName,
      attendance: topAttendee.attendancePercentage
    },
    members: partyMembers.map((member) => ({
      name: member.fullName,
      questionsAsked: member.questionsAsked,
      attendancePercentage: member.attendancePercentage,
      dailAttendance: member.dailAttendance,
      otherAttendance: member.otherAttendance
    }))
  };

  res.json(formatSuccess(stats));
}));

/**
 * GET /api/parliamentary/activity/stats - Get overall parliamentary activity statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const allMembers = Object.values(parliamentaryActivityData);

  if (allMembers.length === 0) {
    return res.status(404).json(
      formatError('ENTITY_NOT_FOUND', 'No parliamentary activity data available')
    );
  }

  // Calculate overall statistics
  const totalMembers = allMembers.length;
  const totalQuestions = allMembers.reduce((sum: number, member) => sum + (member.questionsAsked || 0), 0);
  const avgQuestions = Math.round(totalQuestions / totalMembers);

  const attendanceRates = allMembers.map((member) => member.attendancePercentage || 0);
  const avgAttendance = Math.round(attendanceRates.reduce((sum, rate) => sum + rate, 0) / totalMembers);

  const otherAttendance = allMembers.map((member) => member.otherAttendance || 0);
  const avgOtherAttendance = Math.round(otherAttendance.reduce((sum, days) => sum + days, 0) / totalMembers);

  // Top performers
  const topQuestionAsker = allMembers.reduce((top, member) =>
    (member.questionsAsked || 0) > (top.questionsAsked || 0) ? member : top
  );

  const topAttendee = allMembers.reduce((top, member) =>
    (member.attendancePercentage || 0) > (top.attendancePercentage || 0) ? member : top
  );

  const stats = {
    totalMembers,
    totalQuestions,
    averageQuestions: avgQuestions,
    averageAttendance: avgAttendance,
    averageOtherAttendance: avgOtherAttendance,
    topQuestionAsker: {
      name: topQuestionAsker.fullName,
      questions: topQuestionAsker.questionsAsked,
      party: topQuestionAsker.party
    },
    topAttendee: {
      name: topAttendee.fullName,
      attendance: topAttendee.attendancePercentage,
      party: topAttendee.party
    }
  };

  res.json(formatSuccess(stats));
}));

/**
 * GET /api/parliamentary/activity/party/:partyName/score - Get party activity scores
 */
router.get('/party/:partyName/score', asyncHandler(async (req, res) => {
  const partyName = req.params.partyName;

  // Create mapping from party IDs to full names
  const partyMapping: Record<string, string> = {
    'ie-sf': 'Sinn Féin',
    'ie-fg': 'Fine Gael',
    'ie-ff': 'Fianna Fáil',
    'ie-labour': 'Labour Party',
    'ie-green': 'Green Party',
    'ie-sd': 'Social Democrats',
    'ie-pbp': 'People Before Profit-Solidarity',
    'ie-aontu': 'Aontú',
    'ie-independent-ireland': 'Independent Ireland'
  };

  const fullPartyName = partyMapping[partyName] || partyName;
  const activityData = partyActivityData[fullPartyName];

  if (activityData) {
    const data = {
      party: fullPartyName,
      activityScore: activityData.combinedActivityScore || activityData.activityScore,
      questionsAsked: activityData.questionsAsked,
      tdCount: activityData.tdCount,
      questionsPerTD: activityData.questionsPerTD,
      averageAttendance: activityData.averageAttendance,
      attendanceScore: activityData.attendanceScore,
      questionsScore: activityData.questionsScore,
      combinedActivityScore: activityData.combinedActivityScore,
      weighting: activityData.weighting
    };
    return res.json(formatSuccess(data));
  }

  // Return default score for parties not in data
  const defaultData = {
    party: fullPartyName,
    activityScore: 50,
    questionsAsked: 0,
    tdCount: 1,
    questionsPerTD: 0,
    averageAttendance: null,
    attendanceScore: null,
    questionsScore: null,
    combinedActivityScore: 50,
    weighting: 'No data available'
  };

  res.json(formatSuccess(defaultData));
}));

/**
 * GET /api/parliamentary/activity/top-performers - Get top performers across all parties
 */
router.get('/top-performers', asyncHandler(async (req, res) => {
  const allMembers = Object.values(parliamentaryActivityData);

  if (allMembers.length === 0) {
    return res.json(formatSuccess([]));
  }

  // Sort by questions asked and get top 10
  const topPerformers = allMembers
    .filter((member) => member.questionsAsked && member.questionsAsked > 0)
    .sort((a, b) => (b.questionsAsked || 0) - (a.questionsAsked || 0))
    .slice(0, 10)
    .map((member) => ({
      name: member.fullName,
      questions: member.questionsAsked,
      party: member.party,
      attendance: member.attendancePercentage || 0
    }));

  res.json(formatSuccess(topPerformers));
}));

export default router;
