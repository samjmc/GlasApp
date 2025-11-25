import { ConstituencyStory } from './storyGenerator';

// Create an interface for the cached data
interface CachedStoryData {
  stories: Record<string, ConstituencyStory>;
  timestamp: number;
}

// Storage key for localStorage
const STORY_CACHE_KEY = 'constituency_stories_cache';

// How long the cache remains valid (24 hours in milliseconds)
const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

/**
 * Gets a constituency story from cache
 * @param constituencyName - The name of the constituency
 * @returns The cached story if available, null otherwise
 */
export function getCachedStory(constituencyName: string): ConstituencyStory | null {
  try {
    // Try to get from localStorage
    const cacheData = localStorage.getItem(STORY_CACHE_KEY);
    
    if (!cacheData) {
      return null;
    }
    
    const cache: CachedStoryData = JSON.parse(cacheData);
    
    // Check if cache has expired
    const now = Date.now();
    if (now - cache.timestamp > CACHE_EXPIRY) {
      // Cache has expired, clear it and return null
      localStorage.removeItem(STORY_CACHE_KEY);
      return null;
    }
    
    // Return the cached story if available
    return cache.stories[constituencyName] || null;
  } catch (error) {
    console.error('Error retrieving cached story:', error);
    return null;
  }
}

/**
 * Saves a constituency story to cache
 * @param constituencyName - The name of the constituency
 * @param story - The story data to cache
 */
export function cacheStory(constituencyName: string, story: ConstituencyStory): void {
  try {
    // Try to get existing cache data
    const existingCache = localStorage.getItem(STORY_CACHE_KEY);
    let cache: CachedStoryData;
    
    if (existingCache) {
      cache = JSON.parse(existingCache);
      // Update with new story
      cache.stories[constituencyName] = story;
    } else {
      // Create new cache
      cache = {
        stories: { [constituencyName]: story },
        timestamp: Date.now()
      };
    }
    
    // Save to localStorage
    localStorage.setItem(STORY_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error caching story:', error);
  }
}

/**
 * Clears all cached stories
 */
export function clearStoryCache(): void {
  localStorage.removeItem(STORY_CACHE_KEY);
}