/**
 * User Rankings Routes
 * Consolidated module for personal rankings, policy voting, and category rankings
 *
 * Routes organized by concern:
 * - /personal - Personal TD rankings, quiz results, user profiles
 * Policy votes live in server/voting (/api/votes); policy-area priorities in
 * server/pledges (/api/pledges/priorities).
 */

import { Router } from 'express';
import personalRoutes from './personal.js';

const router = Router();

// Mount sub-routers with their concerns
router.use('/personal', personalRoutes);

export default router;
