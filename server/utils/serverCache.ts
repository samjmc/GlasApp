/**
 * Server-side Cache Utility
 * Delegates to the shared cache adapter (memory by default, Redis when
 * REDIS_URL is set) for in-memory/distributed caching of expensive queries.
 */

import { cache } from '../services/cacheService';

// Cache keys
/** Cache key constants for server-side caching. */
export const CACHE_KEYS = {
  TD_SCORES: 'td_scores',
  TD_WIDGET: 'td_widget',
  NEWS_FEED: 'news_feed',
  NEWS_FEED_HIGHEST: 'news_feed_highest',
  CONSTITUENCIES: 'constituencies',
  CONSTITUENCIES_SUMMARY: 'constituencies_summary',
  PARTY_ANALYTICS: 'party_analytics',
  PARTY_RANKINGS: 'party_rankings',
} as const;

// TTL values in seconds
/** TTL values in seconds for cached data. */
export const CACHE_TTL = {
  SHORT: 60,        // 1 minute - for rapidly changing data
  MEDIUM: 300,      // 5 minutes - for moderately changing data
  LONG: 900,        // 15 minutes - for slow-changing data
  VERY_LONG: 3600,  // 1 hour - for rarely changing data
} as const;

/**
 * Get cached data or fetch from source
 * @param key Cache key
 * @param fetchFn Function to fetch data if not cached
 * @param ttl Time to live in seconds (optional, defaults to 5 minutes)
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try to get from cache
  const cached = await cache.get<T>(key);
  if (cached !== null) {
    console.log(`📦 Cache HIT: ${key}`);
    return cached;
  }

  console.log(`🔄 Cache MISS: ${key} - fetching from source...`);

  // Fetch from source
  const data = await fetchFn();

  // Store in cache
  await cache.set(key, data, ttl ?? CACHE_TTL.MEDIUM);

  console.log(`💾 Cached: ${key} (TTL: ${ttl ?? CACHE_TTL.MEDIUM}s)`);

  return data;
}

/**
 * Invalidate a specific cache key
 */
export async function invalidateCache(key: string): Promise<boolean> {
  console.log(`🗑️ Invalidating cache: ${key}`);
  await cache.del(key);
  return true;
}

/**
 * Invalidate all cache keys matching a prefix
 */
export async function invalidateCacheByPrefix(prefix: string): Promise<number> {
  const keys = (await cache.keys()).filter(k => k.startsWith(prefix));
  console.log(`🗑️ Invalidating ${keys.length} cache keys with prefix: ${prefix}`);
  await Promise.all(keys.map(key => cache.del(key)));
  return keys.length;
}

/**
 * Clear entire cache
 */
export async function clearAllCache(): Promise<void> {
  console.log('🗑️ Clearing entire cache');
  await cache.clear();
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  const stats = await cache.getStats();
  return {
    keys: stats.size,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: stats.hits + stats.misses > 0
      ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1) + '%'
      : 'N/A'
  };
}
