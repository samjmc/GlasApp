/**
 * Parliamentary Routes
 * - Activity: questions, attendance (static Oireachtas data)
 * - Voting: policy voting analysis
 * TD, party and constituency scores live in /api/scores (server/routes/scores.ts).
 */

import { Router } from 'express';
import activityRouter from './activity';
import votingRouter from './voting';

const router = Router();

router.use('/activity', activityRouter);
router.use('/voting', votingRouter);

export default router;
