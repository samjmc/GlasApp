/**
 * Cache Management Routes
 * Endpoints for monitoring and managing the cache
 */

import { Router } from 'express';
import { cache } from '../services/cacheService';

const router = Router();

/**
 * GET /api/cache/stats - Get cache statistics
 */
router.get('/stats', async (req, res) => {
  const stats = await cache.getStats();
  
  res.json({
    success: true,
    cache: {
      size: stats.size,
      keys: stats.keys,
      message: `${stats.size} entries cached`
    }
  });
});

/**
 * POST /api/cache/clear - Clear all cache (admin only)
 */
router.post('/clear', async (req, res) => {
  await cache.clear();
  
  res.json({
    success: true,
    message: 'Cache cleared successfully'
  });
});

/**
 * DELETE /api/cache/:key - Delete specific cache key (admin only)
 */
router.delete('/:key', async (req, res) => {
  const { key } = req.params;
  await cache.del(key);
  
  res.json({
    success: true,
    message: `Cache key '${key}' deleted`
  });
});

export default router;

