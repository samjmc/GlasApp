/**
 * Parliamentary Routes - Consolidated Index
 * Organizes all parliamentary-related endpoints under a unified structure
 * - Scores & Trust: TD scoring, trust metrics, performance
 * - Profiles: Enhanced TD & party information
 * - Activity: Parliamentary voting, attendance, questions
 * - Voting: Voting analysis by division
 * - Constituencies: Constituency analytics and TD listings
 */

import { Router } from 'express';
import scoresRouter from './scores';
import profilesRouter from './profiles';
import activityRouter from './activity';
import votingRouter from './voting';
import constituenciesRouter from './constituencies';

const router = Router();

// Mount all parliamentary sub-routers
router.use('/scores', scoresRouter);
router.use('/profiles', profilesRouter);
router.use('/activity', activityRouter);
router.use('/voting', votingRouter);
router.use('', constituenciesRouter);  // Constituencies at root level for backward compatibility

export default router;
