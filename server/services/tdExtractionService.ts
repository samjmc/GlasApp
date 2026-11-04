/**
 * TD Extraction Service
 * Identifies mentions of Irish TDs in news articles, by name, matched as whole words.
 *
 * Each mention carries the TD's row (id, party, offices), loaded once an hour with the active
 * list, so the pipeline needs no lookup per mention.
 */

import { listActive } from '../scoring/repository';

/** A TD as the pipeline needs them: `offices` is `[{ title, since }]` in the tds table. */
export interface ActiveTd {
  id: number;
  name: string;
  party: string | null;
  constituency: string | null;
  offices: Array<{ title: string }> | null;
}

export interface TDMention {
  name: string;
  td: ActiveTd;
  /** Surrounding text, or how the TD was named. */
  context: string;
}

// Cache of current TDs loaded from database
let CURRENT_TDS: ActiveTd[] = [];
let lastLoaded: Date | null = null;
const CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour

/**
 * Load TDs from database (with caching)
 */
async function ensureTDsLoaded(): Promise<void> {
  // Use cache if recently loaded
  if (CURRENT_TDS.length > 0 && lastLoaded && Date.now() - lastLoaded.getTime() < CACHE_DURATION_MS) {
    return;
  }

  try {
    const tds = await listActive();

    if (tds.length > 0) {
      CURRENT_TDS = tds.map(({ td }) => ({ id: td.id, name: td.name, party: td.party, constituency: td.constituency, offices: td.offices }));
      lastLoaded = new Date();
      console.log(`📋 Loaded ${CURRENT_TDS.length} active TDs from database`);
    }
  } catch (error) {
    console.error('⚠️  Failed to load TDs from database:', error);
    // Keep existing cached TDs if load fails
  }
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * `phrase` as whole words: no letter right before or after it, so "Mark Ward" is not found in
 * "Mark Wardrobe". An apostrophe after it is fine ("Ward's"). Case-insensitive.
 */
function wordPattern(phrase: string, flags = 'iu'): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{M}])${escape(phrase)}(?![\\p{L}\\p{M}])`, flags);
}

/** The ways an article may name a TD: the full name, and forms with an initial. */
function nameForms(fullName: string): string[] {
  const parts = fullName.toLowerCase().split(' ');
  if (parts.length === 2) {
    const [first, last] = parts;
    return [`${first} ${last}`, `${first.charAt(0)}. ${last}`, `${first} ${last.charAt(0)}.`];
  }
  if (parts.length === 3) {
    // Handle middle names/prefixes
    const [first, middle, last] = parts;
    return [`${first} ${middle} ${last}`, `${first} ${last}`, `${first.charAt(0)}. ${middle} ${last}`, `${first.charAt(0)}. ${last}`];
  }
  return [fullName.toLowerCase()];
}

/**
 * The offices an article may name instead of the holder ("the Tánaiste said…"). The holder is
 * read from the TDs' current offices (the roster sync keeps them), never written here.
 */
const TITLE_OFFICES = ['Taoiseach', 'Tánaiste'];

/**
 * Extract TD mentions from article text. A form that two TDs share ("M. Murphy") names neither.
 */
export async function extractTDMentions(text: string): Promise<TDMention[]> {
  await ensureTDsLoaded();

  // Which TDs each form could mean.
  const owners = new Map<string, number>();
  for (const td of CURRENT_TDS) for (const form of new Set(nameForms(td.name))) owners.set(form, (owners.get(form) ?? 0) + 1);

  const mentions = new Map<number, TDMention>();
  for (const td of CURRENT_TDS) {
    for (const form of nameForms(td.name)) {
      if (owners.get(form)! > 1) continue;
      const found = wordPattern(form).exec(text);
      if (!found) continue;
      const context = text.substring(Math.max(0, found.index - 50), Math.min(text.length, found.index + form.length + 50));
      mentions.set(td.id, { name: td.name, td, context });
      break; // Found this TD, move to next
    }
  }

  // Title-only mentions: "the Tánaiste said…" with the holder's name nowhere in the text.
  for (const title of TITLE_OFFICES) {
    if (!wordPattern(title).test(text)) continue;
    const holder = CURRENT_TDS.find((td) => (td.offices ?? []).some((office) => office.title === title));
    if (holder && !mentions.has(holder.id)) {
      mentions.set(holder.id, { name: holder.name, td: holder, context: `Referenced as "${title}"` });
      console.log(`   🎯 Detected ${holder.name} via title "${title}"`);
    }
  }
  return Array.from(mentions.values());
}

/**
 * Check if article is substantially about a TD (not just passing mention)
 * IMPORTANT: Only count FULL NAME mentions to avoid false positives
 */
/** Check whether an article is substantially about a TD. */
export function isSubstantialMention(text: string, tdName: string): boolean {
  const nameLower = tdName.toLowerCase();
  const has = (phrase: string) => wordPattern(phrase).test(text);

  // Also check for title + last name (e.g., "Minister O'Callaghan", "Deputy Connolly", "Ms Gibney", "Mr Carthy")
  const parts = nameLower.split(' ');
  const lastName = parts.length >= 2 ? parts[parts.length - 1] : '';
  const titleWithLastName = lastName !== '' && ['minister', 'deputy', 'td', 'senator', 'mr', 'ms', 'mrs'].some((title) => has(`${title} ${lastName}`));

  // Also check for first name + title patterns (e.g., "Minister... Colm", "TD... Sinéad")
  const firstName = parts.length >= 2 ? parts[0] : '';
  const titleWithFirstName = firstName !== '' && ['minister', 'deputy', 'td', 'senator'].some((title) => has(`${title} ${firstName}`));

  // Substantial: the full name at least once, or a title with the last or first name anywhere.
  return has(nameLower) || titleWithLastName || titleWithFirstName;
}

/**
 * Force reload TDs from database (clears cache)
 */
export async function reloadTDs(): Promise<void> {
  CURRENT_TDS = [];
  lastLoaded = null;
  await ensureTDsLoaded();
}

/** Get the current count of loaded TDs. */
export function getTDCount(): number {
  return CURRENT_TDS.length;
}

/** TD extraction service methods. */
export const TDExtractionService = {
  extractTDMentions,
  isSubstantialMention,
  reloadTDs,
  getTDCount,
};
