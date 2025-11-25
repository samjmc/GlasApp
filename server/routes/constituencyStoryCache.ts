import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory path in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define cache location
const CACHE_DIR = path.join(__dirname, '../../data');
const CACHE_FILE = path.join(CACHE_DIR, 'constituency-stories-cache.json');

// Ensure the data directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Story interface
export interface ConstituencyStory {
  historicalFact?: string;
  politicalTrend?: string;
  notablePoliticians?: string[];
  keyIssues?: string[];
  economicFocus?: string;
}

// Cache interface
interface StoryCache {
  [constituencyName: string]: ConstituencyStory;
}

// Load the story cache from file
export function loadStoryCache(): StoryCache {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cacheData = fs.readFileSync(CACHE_FILE, 'utf8');
      return JSON.parse(cacheData);
    }
  } catch (error) {
    console.error('Error loading constituency story cache:', error);
  }
  return {};
}

// Save to the story cache
export function saveStoryCache(cache: StoryCache): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error('Error saving constituency story cache:', error);
  }
}

// Get a story from cache
export function getStoryFromCache(constituencyName: string): ConstituencyStory | null {
  const cache = loadStoryCache();
  return cache[constituencyName] || null;
}

// Add a story to cache
export function addStoryToCache(constituencyName: string, story: ConstituencyStory): void {
  const cache = loadStoryCache();
  cache[constituencyName] = story;
  saveStoryCache(cache);
}