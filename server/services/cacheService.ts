/**
 * Caching Service
 * Provides in-memory caching to reduce database load and improve performance
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  
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

// Singleton instance
export const cache = new InMemoryCache();

// Clear expired entries every 5 minutes
setInterval(() => {
  cache.clearExpired();
}, 5 * 60 * 1000);

export const CacheService = {
  clearAllCaches(): void {
    cache.clear();
  },
  clearKey(key: string): void {
    cache.delete(key);
  },
  getStats() {
    return cache.getStats();
  }
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
  const existing = cache.get<T>(key);
  if (existing !== null) {
    return existing;
  }
  
  // Not in cache, execute function
  const result = await fn();
  
  // Store in cache
  cache.set(key, result, ttlMs);
  
  return result;
}

/**
 * Common TTL constants for convenience
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

