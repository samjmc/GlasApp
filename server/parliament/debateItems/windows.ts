/**
 * A debate as the model reads it: its speeches in record order, cut into windows of whole
 * speeches. Pure.
 *
 * A window is at most WINDOW_WORDS of speeches to extract from, plus up to CONTEXT_SPEECHES
 * before them that the model may point to but not extract from, so a response at a window's
 * edge can still name the point it takes up. Every speech keeps one label for the whole debate
 * ("s12"), whichever window it is in.
 */

/** About 13,000 tokens: long enough to hold an exchange, short enough to read closely. */
export const WINDOW_WORDS = 10_000;
export const CONTEXT_SPEECHES = 3;

export interface DebateSpeech {
  id: string;
  memberCode: string;
  /** The speaker as the prompt names them: their name, and the role they spoke in if any. */
  speaker: string;
  date: string;
  text: string;
  wordCount: number;
}

export interface LabelledSpeech extends DebateSpeech {
  /** "s1", "s2", … in record order across the whole debate. */
  label: string;
  /** Position in the debate, from 0. */
  index: number;
}

export interface DebateWindow {
  /** Earlier speeches shown for reference only. */
  context: LabelledSpeech[];
  /** The speeches to extract items from. */
  speeches: LabelledSpeech[];
}

export function labelSpeeches(speeches: DebateSpeech[]): LabelledSpeech[] {
  return speeches.map((s, index) => ({ ...s, label: `s${index + 1}`, index }));
}

/** Whole speeches only: a speech longer than the limit is a window of its own. */
export function buildWindows(speeches: LabelledSpeech[], maxWords = WINDOW_WORDS, contextSpeeches = CONTEXT_SPEECHES): DebateWindow[] {
  const windows: DebateWindow[] = [];
  let start = 0;
  while (start < speeches.length) {
    let end = start;
    let words = 0;
    do {
      words += speeches[end].wordCount;
      end++;
    } while (end < speeches.length && words + speeches[end].wordCount <= maxWords);
    windows.push({ context: speeches.slice(Math.max(0, start - contextSpeeches), start), speeches: speeches.slice(start, end) });
    start = end;
  }
  return windows;
}

/**
 * Words that are common in Irish and rare in English. A speech is counted as Irish when they
 * make up at least IRISH_SHARE of its words. Used only to compare rejection rates by language.
 */
const IRISH_WORDS = new Set(['agus', 'tá', 'níl', 'atá', 'freisin', 'chun', 'nach', 'gur', 'bhí', 'bheidh', 'raibh', 'leis', 'ach', 'faoi', 'ar', 'go', 'sé', 'sí', 'seo', 'mar', 'ag', 'na', 'don', 'sa', 'ní', 'rud', 'aon', 'níos', 'ó', 'dúirt', 'aire', 'teachta']);
export const IRISH_SHARE = 0.2;

export function isIrish(text: string): boolean {
  const words = text.toLowerCase().split(/[^a-záéíóú']+/).filter(Boolean);
  if (words.length === 0) return false;
  return words.filter((w) => IRISH_WORDS.has(w)).length / words.length >= IRISH_SHARE;
}
