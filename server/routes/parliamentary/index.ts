/**
 * Parliamentary Routes
 * - Voting: policy voting analysis
 * TD, party and constituency scores live in /api/scores (server/routes/scores.ts).
 * Dáil divisions, debates and attendance live in /api/parliament (server/routes/parliament.ts).
 */

import { Router } from 'express';
import votingRouter from './voting';

const router = Router();

router.use('/voting', votingRouter);

export default router;
