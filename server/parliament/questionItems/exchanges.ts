/**
 * Q1 of docs/plans/question-sessions.md: a question session's section cut into exchanges, one
 * asker's question and the answers to it. Pure.
 *
 *   oral_pq            one section is one exchange; its askers come from /questions (several
 *                      for questions taken together), never from speaker order
 *   topical_issue      one section is one exchange; the asker is the member not in office
 *   leaders_questions  split on speaker order: a new exchange starts only when an office holder
 *   rapid              ANSWERS a member who is not the current asker and who said at least
 *                      MIN_QUESTION_WORDS since the last answer. The member answered is the one with
 *                      the most words since then, so a heckle or an interjection never starts one.
 *
 * The chair's turns are dropped.
 */
import type { QuestionFormat } from '@shared/schema/parliament';

export interface SectionTurn {
  position: number;
  memberCode: string | null;
  isPresiding: boolean;
  /** Held cabinet or Minister of State office that day. */
  inOffice: boolean;
  words: number;
}

export interface SectionToSplit {
  sectionId: string;
  format: QuestionFormat;
  date: string;
  turns: SectionTurn[];
  /** oral_pq: who asked, from /questions, in question order. */
  pqAskers: string[];
}

export interface Exchange {
  id: string;
  sectionId: string;
  format: QuestionFormat;
  date: string;
  askers: string[];
  fromPosition: number;
  toPosition: number;
}

const unique = <T>(xs: T[]) => Array.from(new Set(xs));

/**
 * The fewest words a member says before an answer for it to start an exchange. A leader's question
 * runs to hundreds of words; on a disorderly day (2025-03-25) dozens of 3- to 10-word interjections
 * each drew a one-line reply and would otherwise have been 70 exchanges in one sitting.
 */
export const MIN_QUESTION_WORDS = 40;

export function splitExchanges(section: SectionToSplit): Exchange[] {
  const turns = section.turns.filter((t) => !t.isPresiding && t.memberCode !== null).sort((a, b) => a.position - b.position);
  if (turns.length === 0) return [];
  const exchange = (n: number, askers: string[], from: number, to: number): Exchange => ({
    id: `${section.sectionId}#${n}`,
    sectionId: section.sectionId,
    format: section.format,
    date: section.date,
    askers,
    fromPosition: from,
    toPosition: to,
  });
  const first = turns[0]!.position;
  const last = turns[turns.length - 1]!.position;

  if (section.format === 'oral_pq' || section.format === 'topical_issue') {
    const askers = section.format === 'oral_pq' && section.pqAskers.length > 0 ? unique(section.pqAskers) : unique(turns.filter((t) => !t.inOffice).map((t) => t.memberCode!));
    return askers.length > 0 ? [exchange(1, askers, first, last)] : [];
  }

  // Leaders' Questions and rapid sessions: start a new exchange where an answer goes to a new asker.
  const starts: Array<{ asker: string; from: number }> = [];
  let pending = new Map<string, number>();
  let pendingFrom: number | null = null;
  const close = () => {
    if (pending.size === 0) return;
    const [asker, words] = [...pending.entries()].sort((a, b) => b[1] - a[1])[0]!;
    const isNew = starts.length === 0 || starts[starts.length - 1]!.asker !== asker;
    // An interjection (too short to be a question) stays in the exchange it interrupted.
    if (isNew && (starts.length === 0 || words >= MIN_QUESTION_WORDS)) starts.push({ asker, from: starts.length === 0 ? first : pendingFrom! });
    pending = new Map();
    pendingFrom = null;
  };
  for (const t of turns) {
    if (t.inOffice) {
      close();
      continue;
    }
    if (pendingFrom === null) pendingFrom = t.position;
    pending.set(t.memberCode!, (pending.get(t.memberCode!) ?? 0) + t.words);
  }
  close(); // a last question nobody answered is still an exchange
  return starts.map((s, i) => {
    const next = starts[i + 1];
    const to = next ? Math.max(...turns.filter((t) => t.position < next.from).map((t) => t.position)) : last;
    return exchange(i + 1, [s.asker], s.from, to);
  });
}
