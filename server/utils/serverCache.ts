/**
 * Server-side Cache Utility
 * Uses node-cache for in-memory caching of expensive database queries
 */

import NodeCache from 'node-cache';

// Create cache instance with default TTL of 5 minutes
const cache = new NodeCache({
  stdTTL: 300, // 5 minutes default
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false // Don't clone objects (faster, but be careful with mutations)
});

// Cache keys
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
 * @param ttl Time to live in seconds (optional, uses default if not provided)
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try to get from cache
  const cached = cache.get<T>(key);
  if (cached !== undefined) {
    console.log(`📦 Cache HIT: ${key}`);
    return cached;
  }

  console.log(`🔄 Cache MISS: ${key} - fetching from source...`);
  
  // Fetch from source
  const data = await fetchFn();
  
  // Store in cache
  if (ttl) {
    cache.set(key, data, ttl);
  } else {
    cache.set(key, data);
  }
  
  console.log(`💾 Cached: ${key} (TTL: ${ttl || 300}s)`);
  
  return data;
}

/**
 * Invalidate a specific cache key
 */
export function invalidateCache(key: string): boolean {
  console.log(`🗑️ Invalidating cache: ${key}`);
  return cache.del(key) > 0;
}

/**
 * Invalidate all cache keys matching a prefix
 */
export function invalidateCacheByPrefix(prefix: string): number {
  const keys = cache.keys().filter(k => k.startsWith(prefix));
  console.log(`🗑️ Invalidating ${keys.length} cache keys with prefix: ${prefix}`);
  return cache.del(keys);
}

/**
 * Clear entire cache
 */
export function clearAllCache(): void {
  console.log('🗑️ Clearing entire cache');
  cache.flushAll();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const stats = cache.getStats();
  return {
    keys: cache.keys().length,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: stats.hits + stats.misses > 0 
      ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1) + '%'
      : 'N/A'
  };
}

export default cache;




