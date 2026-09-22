/**
 * User Rankings Routes
 * Consolidated module for personal rankings, policy voting, and category rankings
 *
 * Routes organized by concern:
 * - /personal - Personal TD rankings, quiz results, user profiles
 * - /category - Category-based rankings and weighted performance
 * Policy votes live in server/voting (/api/votes).
 */

import { Router } from 'express';
import personalRoutes from './personal.js';
import categoryRoutes from './category.js';

const router = Router();

// Mount sub-routers with their concerns
router.use('/personal', personalRoutes);
router.use('/category', categoryRoutes);

export default router;
