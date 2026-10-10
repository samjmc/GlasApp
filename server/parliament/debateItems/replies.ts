/**
 * Rules r2: a reply ("response") is shown and scored only when its own sentence names the member
 * it is linked to. Pure. Code checks the model's link; the model never decides it alone.
 *
 * Why: in Sam's check of v2 items (2026-10-04) about 3 replies in 8 were linked wrongly, in two
 * ways. The wrong member ("I commend Deputy Coppinger", linked to another speaker), which this
 * check rejects; and the right member but the wrong earlier passage, which is why the record
 * shows the reply's own words ("Deputy Cullinane referred to the industry") and never the
 * passage the model picked as its target.
 *
 * Named means: the target's surname ("Deputy Boyd Barrett", "an Teachta Ó Snodaigh"), or, when
 * the target spoke in a government office, an office word ("the Minister", "an tAire").
 */
import { normalise } from '../../stances/verify';

/**
 * Office words that name the holder, normalised (no fadas), in families: an Irish reply says "an
 * tAire" to a member listed as "Minister for …". "Government" names nobody.
 */
const OFFICE_FAMILIES = [['minister', 'aire', 'taire'], ['taoiseach'], ['tanaiste']];

/** Lower case, no fadas, letters, digits, apostrophes and hyphens only: " deputy boyd barrett ". */
const words = (text: string) => ` ${normalise(text).text.replace(/[^a-z0-9'-]+/g, ' ').trim()} `;

/** The forms a surname is spoken in: "Richard Boyd Barrett" → "boyd barrett", "barrett". */
export function surnameForms(name: string): string[] {
  const parts = words(name).trim().split(' ').filter(Boolean);
  if (parts.length < 2) return parts.filter((p) => p.length > 2);
  const forms = new Set([parts.slice(1).join(' '), parts[parts.length - 1]!]);
  return Array.from(forms).filter((f) => f.length > 2);
}

/**
 * The sentence or sentences of `text` that hold [start, end): from the end of the sentence before
 * to the end of the sentence after, so "As Deputy Whitmore said, <quote>" counts.
 */
export function sentenceAround(text: string, start: number, end: number): string {
  // A paragraph break ends a sentence too: transcripts end paragraphs with ".\n", not ". ".
  const before = text.slice(0, start);
  const from = Math.max(before.lastIndexOf('. '), before.lastIndexOf('? '), before.lastIndexOf('! '), before.lastIndexOf('\n')) + 1;
  const rest = text.slice(end);
  const next = rest.search(/[.?!](\s|$)|\n/);
  return text.slice(from, next === -1 ? text.length : end + next + 1);
}

export interface ReplyCheck {
  /** The reply speech's text and the quote's offsets in it. */
  speechText: string;
  quoteStart: number;
  quoteEnd: number;
  /** The member the reply is linked to, and the role they spoke in (null for none). */
  targetName: string;
  targetRole: string | null;
}

export function namesTarget(r: ReplyCheck): boolean {
  const sentence = words(sentenceAround(r.speechText, r.quoteStart, r.quoteEnd));
  if (surnameForms(r.targetName).some((s) => sentence.includes(` ${s} `) || sentence.includes(` ${s}'`))) return true;
  if (!r.targetRole) return false;
  const role = words(r.targetRole);
  const has = (text: string, family: string[]) => family.some((w) => text.includes(` ${w} `));
  return OFFICE_FAMILIES.some((family) => has(role, family) && has(sentence, family));
}
