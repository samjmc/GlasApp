/**
 * TD Extraction Service
 * Identifies mentions of Irish TDs in news articles
 */

import { supabaseDb as supabase } from '../db.js';

// Cache of current TDs loaded from database
let CURRENT_TDS: Array<{ name: string; constituency: string; party: string }> = [];
let lastLoaded: Date | null = null;
const CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour

interface TDMention {
  name: string;
  constituency: string;
  party: string;
  confidence: number; // 0-1 how confident we are this is about this person
  context: string; // Surrounding text
}

/**
 * Load TDs from database (with caching)
 */
async function ensureTDsLoaded(): Promise<void> {
  // Use cache if recently loaded
  if (CURRENT_TDS.length > 0 && lastLoaded && 
      (Date.now() - lastLoaded.getTime()) < CACHE_DURATION_MS) {
    return;
  }
  
  try {
    const { data: tds, error } = await supabase
      .from('td_scores')
      .select('politician_name, constituency, party')
      .eq('is_active', true);
    
    if (error) throw error;
    
    if (tds && tds.length > 0) {
      CURRENT_TDS = tds.map(td => ({
        name: td.politician_name,
        constituency: td.constituency || '',
        party: td.party || ''
      }));
      lastLoaded = new Date();
      console.log(`📋 Loaded ${CURRENT_TDS.length} active TDs from database`);
    }
  } catch (error) {
    console.error('⚠️  Failed to load TDs from database:', error);
    // Keep existing cached TDs if load fails
  }
}

/**
 * Extract TD mentions from article text
 */
export async function extractTDMentions(text: string): Promise<TDMention[]> {
  // Ensure TDs are loaded from database
  await ensureTDsLoaded();
  
  const mentions: TDMention[] = [];
  const textLower = text.toLowerCase();
  
  // FIRST: Check for special title-only mentions (Taoiseach, Tánaiste, etc.)
  const titleMentions = await extractTitleOnlyMentions(textLower);
  mentions.push(...titleMentions);
  
  // THEN: Check for regular name mentions
  for (const td of CURRENT_TDS) {
    const nameLower = td.name.toLowerCase();
    
    // Check for various forms of the name
    const patterns = [
      nameLower, // Full name
      `td ${nameLower}`,
      `${nameLower} td`,
      `deputy ${nameLower}`,
      `minister ${nameLower}`,
      `senator ${nameLower}`,
      ...generateNameVariations(td.name)
    ];
    
    for (const pattern of patterns) {
      const index = textLower.indexOf(pattern);
      
      if (index !== -1) {
        // Extract context (50 chars before and after)
        const contextStart = Math.max(0, index - 50);
        const contextEnd = Math.min(text.length, index + pattern.length + 50);
        const context = text.substring(contextStart, contextEnd);
        
        // Calculate confidence based on how name appears
        let confidence = 0.7; // Base confidence
        
        // Higher confidence if title is included
        if (pattern.includes('td') || pattern.includes('minister') || pattern.includes('deputy')) {
          confidence = 0.95;
        }
        
        // Higher confidence if constituency is mentioned nearby
        if (textLower.includes(td.constituency.toLowerCase())) {
          confidence = Math.min(1.0, confidence + 0.2);
        }
        
        mentions.push({
          name: td.name,
          constituency: td.constituency,
          party: td.party,
          confidence,
          context
        });
        
        break; // Found this TD, move to next
      }
    }
  }
  
  // Deduplicate (might find same TD multiple times)
  const uniqueMentions = Array.from(
    new Map(mentions.map(m => [m.name, m])).values()
  );
  
  // Disambiguation: If multiple TDs share the same last name and article only mentions last name,
  // keep only if first name is also present
  const disambiguatedMentions = disambiguateCommonSurnames(uniqueMentions, textLower);
  
  return disambiguatedMentions;
}

/**
 * Extract mentions of TDs referenced only by title (Taoiseach, Tánaiste, etc.)
 * This catches articles that say "The Tánaiste said..." without naming them
 */
async function extractTitleOnlyMentions(textLower: string): Promise<TDMention[]> {
  const mentions: TDMention[] = [];
  
  // Map of titles to likely TDs (based on current government formation)
  // NOTE: This needs updating when government changes!
  const titleMappings: { [key: string]: { name: string; role: string } } = {
    'tánaiste': { name: 'Simon Harris', role: 'Tánaiste (Fine Gael leader)' },
    'taoiseach': { name: 'Micheál Martin', role: 'Taoiseach (Fianna Fáil leader)' },
  };
  
  for (const [title, info] of Object.entries(titleMappings)) {
    // Check if title appears WITHOUT the person's name nearby
    if (textLower.includes(title)) {
      // Only add if their full name ISN'T already in the text
      // (to avoid double-counting)
      if (!textLower.includes(info.name.toLowerCase())) {
        const td = CURRENT_TDS.find(t => t.name === info.name);
        if (td) {
          mentions.push({
            name: td.name,
            constituency: td.constituency,
            party: td.party,
            confidence: 0.90, // High confidence for title mentions
            context: `Referenced as "${title}" (${info.role})`
          });
          console.log(`   🎯 Detected ${info.name} via title "${title}"`);
        }
      }
    }
  }
  
  return mentions;
}

/**
 * Disambiguate TDs with common surnames
 * If article says "Callaghan" but there are 3 TDs named Callaghan,
 * only keep the ones whose first names also appear
 */
function disambiguateCommonSurnames(mentions: TDMention[], textLower: string): TDMention[] {
  // Group mentions by last name
  const byLastName = new Map<string, TDMention[]>();
  
  for (const mention of mentions) {
    const parts = mention.name.toLowerCase().split(' ');
    const lastName = parts[parts.length - 1];
    
    if (!byLastName.has(lastName)) {
      byLastName.set(lastName, []);
    }
    byLastName.get(lastName)!.push(mention);
  }
  
  const disambiguated: TDMention[] = [];
  
  for (const [lastName, tdsWithSameSurname] of byLastName.entries()) {
    // If only 1 TD has this surname, keep them
    if (tdsWithSameSurname.length === 1) {
      disambiguated.push(tdsWithSameSurname[0]);
      continue;
    }
    
    // Multiple TDs share this surname - need disambiguation
    console.log(`   🔍 Disambiguating ${tdsWithSameSurname.length} TDs with surname "${lastName}"`);
    
    for (const td of tdsWithSameSurname) {
      const parts = td.name.toLowerCase().split(' ');
      const firstName = parts[0];
      
      // Keep TD only if their first name appears in the article
      // OR if their constituency is mentioned
      if (textLower.includes(firstName) || textLower.includes(td.constituency.toLowerCase())) {
        disambiguated.push(td);
        console.log(`     ✅ Kept ${td.name} (first name or constituency found)`);
      } else {
        console.log(`     ❌ Skipped ${td.name} (ambiguous - only surname mentioned)`);
      }
    }
  }
  
  return disambiguated;
}

/**
 * Generate name variations for better matching
 */
function generateNameVariations(fullName: string): string[] {
  const variations: string[] = [];
  const parts = fullName.toLowerCase().split(' ');
  
  if (parts.length === 2) {
    const [first, last] = parts;
    variations.push(
      `${first} ${last}`, // Full name ONLY (removed bare last name to prevent false matches)
      `${first.charAt(0)}. ${last}`, // Initial + last (e.g., "M. Martin")
      `${first} ${last.charAt(0)}.`, // First + initial (e.g., "Micheál M.")
    );
  } else if (parts.length === 3) {
    // Handle middle names/prefixes
    const [first, middle, last] = parts;
    variations.push(
      `${first} ${middle} ${last}`, // Full name with middle
      `${first} ${last}`, // First + last (skip middle)
      `${first.charAt(0)}. ${middle} ${last}`, // Initial + middle + last
      `${first.charAt(0)}. ${last}`, // Initial + last
    );
  }
  
  return variations;
}

/**
 * Filter TD mentions by confidence threshold
 */
export function filterHighConfidenceMentions(
  mentions: TDMention[],
  threshold: number = 0.7
): TDMention[] {
  return mentions.filter(m => m.confidence >= threshold);
}

/**
 * Check if article is substantially about a TD (not just passing mention)
 * IMPORTANT: Only count FULL NAME mentions to avoid false positives
 */
export function isSubstantialMention(text: string, tdName: string): boolean {
  const textLower = text.toLowerCase();
  const nameLower = tdName.toLowerCase();
  
  // Count ONLY full name mentions (not last name alone)
  const fullNamePattern = new RegExp(nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const fullNameMentions = (textLower.match(fullNamePattern) || []).length;
  
  // Check if FULL NAME appears in title or first 300 chars (lead paragraph)
  const titleAndLead = text.substring(0, 300).toLowerCase();
  const inTitleOrLead = titleAndLead.includes(nameLower);
  
  // Also check for title + last name (e.g., "Minister O'Callaghan", "Deputy Connolly", "Ms Gibney", "Mr Carthy")
  const parts = nameLower.split(' ');
  const lastName = parts.length >= 2 ? parts[parts.length - 1] : '';
  const fullTextHasTitleWithLastName = lastName && (
    textLower.includes(`minister ${lastName}`) ||
    textLower.includes(`deputy ${lastName}`) ||
    textLower.includes(`td ${lastName}`) ||
    textLower.includes(`senator ${lastName}`) ||
    textLower.includes(`mr ${lastName}`) ||
    textLower.includes(`ms ${lastName}`) ||
    textLower.includes(`mrs ${lastName}`)
  );
  
  // Also check for first name + title patterns (e.g., "Minister... Colm", "TD... Sinéad")
  const firstName = parts.length >= 2 ? parts[0] : '';
  const hasFirstNameWithTitle = firstName && (
    textLower.includes(`minister ${firstName}`) ||
    textLower.includes(`deputy ${firstName}`) ||
    textLower.includes(`td ${firstName}`) ||
    textLower.includes(`senator ${firstName}`)
  );
  
  // Substantial mention requires:
  // - FULL NAME mentioned at least once (we already filtered by requiring full name match)
  // - OR Title + last name ANYWHERE (e.g., "Minister O'Callaghan", "Ms Gibney")
  // - OR Title + first name ANYWHERE (e.g., "Minister... Colm")
  //
  // Since we removed bare last name from variations, any match here means we found the full name
  // or a title + name combination, so we can be more lenient
  return fullNameMentions >= 1 || fullTextHasTitleWithLastName || hasFirstNameWithTitle;
}

/**
 * Force reload TDs from database (clears cache)
 */
export async function reloadTDs(): Promise<void> {
  CURRENT_TDS = [];
  lastLoaded = null;
  await ensureTDsLoaded();
}

/**
 * Get current TD count
 */
export function getTDCount(): number {
  return CURRENT_TDS.length;
}

export const TDExtractionService = {
  extractTDMentions,
  filterHighConfidenceMentions,
  isSubstantialMention,
  reloadTDs,
  getTDCount
};



