/**
 * Check the passages the model chose. Pure. A passage is shown only when it is the source's own
 * words: found in `text` (the exact string the model was sent) after normalising quote marks,
 * dashes, fadas and case, the same way stances are checked (server/stances/verify.ts).
 */
import { normalise } from '../stances/verify';
import { QUOTE_MAX_WORDS, QUOTE_MIN_WORDS } from '../stances/extract';
import { SENSITIVE } from './source';

/** Passages shown per TD. */
export const MAX_PASSAGES = 6;
const ELLIPSIS = /\.\.\.|…/;

export const PASSAGE_REJECTS = ['invalid', 'length', 'sensitive', 'not_found', 'duplicate', 'over_limit'] as const;
export type PassageReject = (typeof PASSAGE_REJECTS)[number];

export interface PassageResult {
  /** Each one sliced from `text`, in the source's own wording. */
  accepted: string[];
  rejected: Record<PassageReject, number>;
}

export function emptyRejects(): Record<PassageReject, number> {
  const counts = {} as Record<PassageReject, number>;
  for (const reason of PASSAGE_REJECTS) counts[reason] = 0;
  return counts;
}

/** `chosen` is whatever the model returned; `summary` is not repeated as a passage. */
export function verifyPassages(text: string, summary: string, chosen: unknown[]): PassageResult {
  const source = normalise(text);
  const summaryText = normalise(summary).text;
  const rejected = emptyRejects();
  const accepted: string[] = [];
  const seen = new Set<string>();

  for (const raw of chosen) {
    if (typeof raw !== 'string' || ELLIPSIS.test(raw)) {
      rejected.invalid++;
      continue;
    }
    const passage = normalise(raw).text.replace(/^['" ]+|['" ]+$/g, '');
    const words = passage ? passage.split(' ').length : 0;
    if (words < QUOTE_MIN_WORDS || words > QUOTE_MAX_WORDS) {
      rejected.length++;
      continue;
    }
    if (SENSITIVE.test(passage)) {
      rejected.sensitive++;
      continue;
    }
    const at = source.text.indexOf(passage);
    if (at === -1) {
      rejected.not_found++;
      continue;
    }
    if (seen.has(passage) || summaryText.includes(passage)) {
      rejected.duplicate++;
      continue;
    }
    if (accepted.length === MAX_PASSAGES) {
      rejected.over_limit++;
      continue;
    }
    seen.add(passage);
    const start = source.offsets[at]!;
    const end = source.offsets[at + passage.length - 1]! + 1;
    accepted.push(text.slice(start, end));
  }
  return { accepted, rejected };
}
