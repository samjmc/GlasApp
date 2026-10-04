/**
 * A matched Dáil division → one `td_stances` row per TD who voted on a side that matched, and
 * whether each vote was the TD's own. Pure: no I/O, no clock.
 *
 *   free    no party prior, a tied or split party
 *   rebel   against the party majority
 *   whip    with the party majority
 *
 * Every vote on a matched side is on the record (stored, shown, used for item agreement). Only
 * free and rebel votes are axis evidence (evidence.ts): ~400 divisions a term at 90% attendance
 * would otherwise make every party member identical and code government-vs-opposition voting
 * as ideology.
 */
import type { DivisionVoteRecord } from '../parliament';
import { partyBaseline } from '../ideology/partyBaselines';
import type { NewTdStance } from '@shared/schema/stances';
import type { Discipline, StanceVote } from '@shared/stancesApi';

/** A party whose smaller lobby (Tá or Níl; Staon left out) is at least this share was split. */
export const PARTY_SPLIT_SHARE = 0.2;
export const DIVISION_SOURCE_NAME = 'Dáil Éireann';

/** One vote in a division, as divisionVoteRecords() returns it. */
export type StanceVoteRecord = DivisionVoteRecord;

/** Whether this vote was the TD's own. */
export function disciplineOf(v: Pick<DivisionVoteRecord, 'party' | 'vote' | 'partyMajority' | 'partyTa' | 'partyNil'>): Discipline {
  // No baseline (an Independent, or a party with none): there is no prior to repeat.
  if (partyBaseline(v.party) === null) return 'free';
  if (v.partyMajority === null) return 'free'; // a tie
  const sided = v.partyTa + v.partyNil;
  if (sided > 0 && Math.min(v.partyTa, v.partyNil) / sided >= PARTY_SPLIT_SHARE) return 'free';
  return v.vote === v.partyMajority ? 'whip' : 'rebel';
}

/** A matched reading: the question, the option a Tá vote states, and the option a Níl vote states, if any. */
export interface MatchedReading {
  divisionId: string;
  questionId: number;
  taOptionKey: string;
  nilOptionKey: string | null;
  /** The verified passage of the proposal. */
  quote: string;
}

export interface StanceDivision {
  id: string;
  date: string;
  heldAt: string | null;
  subject: string | null;
  debateTitle: string | null;
}

export interface StanceQuestion {
  policyDomain: string;
  options: Array<{ key: string; label: string }>;
}

/**
 * The td_stances rows one matched division gives: one per TD who voted Tá, or Níl when Níl has
 * an option. Staon and absence give nothing. No rows when the division has no link (`url`) or
 * the question no longer has the option.
 */
export function divisionStanceRows(
  reading: MatchedReading,
  division: StanceDivision,
  question: StanceQuestion,
  votes: StanceVoteRecord[],
  url: string | null,
): NewTdStance[] {
  if (url === null) return [];
  const optionFor: Record<StanceVote, string | null> = { ta: reading.taOptionKey, nil: reading.nilOptionKey };
  const statedAt = new Date(division.heldAt ?? `${division.date}T12:00:00Z`);
  const rows: NewTdStance[] = [];
  for (const v of votes) {
    const side = v.vote;
    if (side === 'staon') continue;
    const option = question.options.find((o) => o.key === optionFor[side]);
    if (!option) continue;
    rows.push({
      tdId: v.tdId,
      articleId: null,
      divisionId: division.id,
      divisionVote: side,
      discipline: disciplineOf(v),
      questionId: reading.questionId,
      optionKey: option.key,
      optionText: option.label,
      quote: reading.quote,
      quoteKind: 'division',
      policyDomain: question.policyDomain,
      statedAt,
      articleUrl: url,
      sourceName: DIVISION_SOURCE_NAME,
      headline: division.debateTitle ?? division.subject ?? 'Dáil vote',
    });
  }
  return rows;
}
