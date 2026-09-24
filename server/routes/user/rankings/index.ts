/**
 * User rankings: only the category rankings the pledge screen uses (owned by the voting and
 * pledges rebuild). Personal TD rankings are /api/ideology/me/matches; policy votes are
 * /api/votes.
 */

import { Router } from 'express';
import categoryRoutes from './category.js';

const router = Router();

router.use('/category', categoryRoutes);

export default router;
