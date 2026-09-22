/**
 * Parliamentary Routes
 * - Activity: questions, attendance (static Oireachtas data)
 * TD, party and constituency scores live in /api/scores (server/routes/scores.ts).
 * Users voting on policy questions lives in server/voting (/api/votes).
 */

import { Router } from 'express';
import activityRouter from './activity';

const router = Router();

router.use('/activity', activityRouter);

export default router;
