/**
 * Caching Service
 * Provides a swappable cache backend (in-memory by default, Redis when
 * REDIS_URL is set) to reduce database load and improve performance.
 *
 * The public surface is unchanged from the previous in-memory implementation:
 * `cache`, `CacheService`, `cached`, `TTL` and `CacheKeys`. The only difference
 * is that `cache` operations are now asynchronous, so call sites that used them
 * synchronously were migrated to `await` (see cacheRoutes.ts / parties.ts).
 */

import { createClient } from 'redis';

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class InMemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  /**
   * Get value from cache
   * Returns null if not found or expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set value in cache with TTL in milliseconds
   */
  set<T>(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, {
      data: value,
      expiry: Date.now() + ttlMs,
    });
  }

  /**
   * Delete specific key from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries (called periodically)
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

/**
 * Common cache statistics shape exposed by every adapter.
 */
export interface CacheStats {
  size: number;
  keys: string[];
  hits: number;
  misses: number;
}

/**
 * Contract every cache backend must satisfy.
 */
export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

/**
 * In-memory backend. Wraps the existing InMemoryCache implementation so the
 * proven cache logic is reused unchanged (no behavior change when REDIS_URL
 * is not set).
 */
class MemoryCacheAdapter implements CacheAdapter {
  private store: InMemoryCache;
  private hits = 0;
  private misses = 0;

  constructor(store: InMemoryCache) {
    this.store = store;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = this.store.get<T>(key);
    if (value === null) {
      this.misses++;
      return null;
    }
    this.hits++;
    return value;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const ttlMs = ttlSeconds > 0 ? ttlSeconds * 1000 : Number.MAX_SAFE_INTEGER;
    this.store.set(key, value, ttlMs);
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async getStats(): Promise<CacheStats> {
    const stats = this.store.getStats();
    return {
      size: stats.size,
      keys: stats.keys,
      hits: this.hits,
      misses: this.misses,
    };
  }

  async keys(): Promise<string[]> {
    return this.store.getStats().keys;
  }

  clearExpired(): void {
    this.store.clearExpired();
  }
}

/**
 * Redis backend. Uses the official node-redis client. Connections are lazy and
 * errors are logged, never thrown, so an unreachable Redis degrades gracefully
 * (cache reads behave as misses and writes are no-ops) instead of crashing the
 * process. TTLs are natively handled by Redis.
 */
class RedisCacheAdapter implements CacheAdapter {
  private client: ReturnType<typeof createClient>;

  constructor(url: string) {
    this.client = createClient({ url });

    // Prevent unhandled 'error' events from crashing the process.
    this.client.on('error', (err) => {
      console.error('[RedisCacheAdapter] Redis connection error:', err.message);
    });

    // Lazy-connect: if Redis is unreachable at startup the promise rejects and
    // is logged; the client keeps retrying in the background.
    this.client.connect().catch((err: unknown) => {
      console.error('[RedisCacheAdapter] Redis connect failed (will retry):', err);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error(`[RedisCacheAdapter] GET failed for key "${key}":`, err);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (serialized === undefined) {
        return;
      }
      if (ttlSeconds > 0) {
        await this.client.set(key, serialized, { expiration: { type: 'EX', value: ttlSeconds } });
      } else {
        await this.client.set(key, serialized);
      }
    } catch (err) {
      console.error(`[RedisCacheAdapter] SET failed for key "${key}":`, err);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err) {
      console.error(`[RedisCacheAdapter] DEL failed for key "${key}":`, err);
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await this.scanKeys();
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (err) {
      console.error('[RedisCacheAdapter] clear failed:', err);
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const size = await this.client.dbSize();
      const keys = await this.scanKeys();

      let hits = 0;
      let misses = 0;
      try {
        const info = await this.client.info('stats');
        const hitMatch = info.match(/keyspace_hits:(\d+)/);
        const missMatch = info.match(/keyspace_misses:(\d+)/);
        hits = hitMatch ? parseInt(hitMatch[1], 10) : 0;
        misses = missMatch ? parseInt(missMatch[1], 10) : 0;
      } catch {
        // Stats section unavailable; report zeros rather than failing.
      }

      return { size, keys, hits, misses };
    } catch (err) {
      console.error('[RedisCacheAdapter] getStats failed:', err);
      return { size: 0, keys: [], hits: 0, misses: 0 };
    }
  }

  async keys(): Promise<string[]> {
    try {
      return await this.scanKeys();
    } catch (err) {
      console.error('[RedisCacheAdapter] keys scan failed:', err);
      return [];
    }
  }

  clearExpired(): void {
    // Redis expires keys natively; nothing to do.
  }

  private async scanKeys(): Promise<string[]> {
    const keys: string[] = [];
    for await (const batch of this.client.scanIterator()) {
      keys.push(...batch);
    }
    return keys;
  }
}

// Single cache instance, backed by Redis when REDIS_URL is set, otherwise the
// existing in-memory implementation. No call sites need to know which backend
// is active.
export const cache = process.env.REDIS_URL
  ? new RedisCacheAdapter(process.env.REDIS_URL)
  : new MemoryCacheAdapter(new InMemoryCache());

// Clear expired entries every 5 minutes (only relevant for the memory backend;
// Redis expires keys natively).
setInterval(() => {
  cache.clearExpired();
}, 5 * 60 * 1000);

export const CacheService = {
  async clearAllCaches(): Promise<void> {
    await cache.clear();
  },
  async clearKey(key: string): Promise<void> {
    await cache.del(key);
  },
  async getStats(): Promise<CacheStats> {
    return await cache.getStats();
  },
};

/**
 * Helper function to cache async function results
 *
 * Usage:
 * const parties = await cached('parties:all', 24 * 60 * 60 * 1000, async () => {
 *   return await db.select().from(parties);
 * });
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  // Try to get from cache
  const existing = await cache.get<T>(key);
  if (existing !== null) {
    return existing;
  }

  // Not in cache, execute function
  const result = await fn();

  // Store in cache
  await cache.set(key, result, ttlMs / 1000);

  return result;
}

/**
 * Common TTL constants for convenience (in milliseconds)
 */
export const TTL = {
  ONE_MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  TEN_MINUTES: 10 * 60 * 1000,
  THIRTY_MINUTES: 30 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  SIX_HOURS: 6 * 60 * 60 * 1000,
  TWELVE_HOURS: 12 * 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Cache key generators for consistent naming
 */
export const CacheKeys = {
  // Party data (rarely changes)
  parties: {
    all: () => 'parties:all',
    byId: (id: number) => `parties:${id}`,
    positions: () => 'parties:positions',
  },

  // Quiz data (static)
  quiz: {
    questions: () => 'quiz:questions',
    dimensions: () => 'quiz:dimensions',
  },

  // Constituency data (static)
  constituencies: {
    all: () => 'constituencies:all',
    byId: (id: number) => `constituencies:${id}`,
    boundaries: () => 'constituencies:boundaries',
  },

  // TD scores (update hourly)
  tdScores: {
    all: () => 'td-scores:all',
    top: (limit: number) => `td-scores:top:${limit}`,
    byName: (name: string) => `td-scores:${name}`,
  },

  // Pledges (update when modified)
  pledges: {
    byParty: (partyId: number) => `pledges:party:${partyId}`,
    performance: (partyId: number) => `pledges:performance:${partyId}`,
  },
};
