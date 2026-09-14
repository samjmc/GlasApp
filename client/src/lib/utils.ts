import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges Tailwind class names using clsx and tailwind-merge. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Utility function to calculate Euclidean distance between two points
/** Calculates the Euclidean distance between two 2D points. */
export function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// Generate a unique share code
/** Generates a random alphanumeric share code of the given length. */
export function generateShareCode(length: number = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Simple formatter for compass scores
/** Formats a compass score to one decimal place. */
export function formatCompassScore(score: number): string {
  return score.toFixed(1);
}

// Determine quadrant name
/** Returns the political compass quadrant name for the given economic and social scores. */
export function getQuadrantName(economic: number, social: number): string {
  if (economic >= 0 && social >= 0) return "Authoritarian Right";
  if (economic < 0 && social >= 0) return "Authoritarian Left";
  if (economic >= 0 && social < 0) return "Libertarian Right";
  return "Libertarian Left";
}

// Convert scores to percentages for positioning on the compass
/** Converts a -10..10 score to a 0..100 compass position percentage for an axis. */
export function scoreToPosition(score: number, axis: 'economic' | 'social'): number {
  // Convert -10 to 10 scale to 0 to 100%
  if (axis === 'economic') {
    // Economic: -10 (left) = 0%, 10 (right) = 100%
    return ((score + 10) / 20) * 100;
  } else {
    // Social: -10 (libertarian) = 100%, 10 (authoritarian) = 0%
    // Inverted since top is authoritarian in UI
    return ((10 - score) / 20) * 100;
  }
}

// Function to get compass color based on position
/** Returns an RGB color string blended by position on the political compass. */
export function getCompassColor(economic: number, social: number): string {
  // Blend colors based on position
  const redComponent = Math.min(255, Math.max(0, 128 + economic * 12));
  const greenComponent = Math.min(255, Math.max(0, 128 - Math.abs(economic) * 5 - Math.abs(social) * 5));
  const blueComponent = Math.min(255, Math.max(0, 128 - social * 12));
  
  return `rgb(${Math.round(redComponent)}, ${Math.round(greenComponent)}, ${Math.round(blueComponent)})`;
}
