/**
 * User Rankings Routes
 * Consolidated module for personal rankings, policy voting, and category rankings
 *
 * Routes organized by concern:
 * - /personal - Personal TD rankings, quiz results, user profiles
 * - /policy - Policy votes, opportunity stats
 * - /category - Category-based rankings and weighted performance
 */

import { Router } from 'express';
import personalRoutes from './personal.js';
import policyRoutes from './policy.js';
import categoryRoutes from './category.js';

const router = Router();

// Mount sub-routers with their concerns
router.use('/personal', personalRoutes);
router.use('/policy', policyRoutes);
router.use('/category', categoryRoutes);

export default router;
