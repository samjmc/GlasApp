/**
 * A Dáil division → per-TD ideology evidence. Pure: no I/O, no clock.
 *
 * A reading of the division says what a Tá vote supported (`taLean`) and what a Níl vote
 * expressed (`nilLean`), on the ±2 scale; sources.ts scales it onto −10..+10. A TD's vote
 * is evidence of their OWN position only when the vote was theirs to cast:
 *
 *   free    no party prior, a tied or split party                weight 1
 *   rebel   against the party majority                           weight 1.5
 *   —       with the whip: no row
 *
 * Why the whip gives nothing: ~400 divisions a term at 90% attendance, even at a small
 * weight, would swamp the party prior (3), make every member identical and code the
 * government-vs-opposition split as ideology.
 */
import type { DivisionMeaningStatus } from '@shared/divisionMeaning';
import type { DivisionVoteRecord } from '../parliament';
import type { DivisionClassification } from './divisionPrompt';
import type { PartialVector } from './model';
import { partyBaseline } from './partyBaselines';
import { DIVISION_SECTION_CAP, DIVISION_TOTAL_CAP } from './sources';

/** Below this, the reading is too unsure to say anything about anyone. */
export const MIN_DIVISION_CONFIDENCE = 0.5;
/** A party whose smaller lobby (Tá or Níl; Staon left out) is at least this share was split. */
export const PARTY_SPLIT_SHARE = 0.2;
export const DIVISION_WEIGHT = { free: 1, rebel: 1.5 } as const;
export type Discipline = keyof typeof DIVISION_WEIGHT;

/**
 * The reading's `free_vote` flag is stored, but frees no one: a model's guess that a vote was
 * unwhipped would turn a whole united party's votes into evidence. A party that really split
 * (PARTY_SPLIT_SHARE) votes freely whatever the flag says.
 */
export type DivisionMeaning = Pick<DivisionClassification, 'taLean' | 'nilLean' | 'nilWeight' | 'confidence' | 'salience' | 'policyTopic'> & {
  status: DivisionMeaningStatus;
};

/** One vote in the division, as divisionVoteRecords() returns it. A vote not linked to a TD gives nothing. */
export type EvidenceVote = Omit<DivisionVoteRecord, 'tdId'> & { tdId: number | null };

export interface DivisionEvidenceRow {
  tdId: number;
  divisionId: string;
  /** The lobby's lean, ±2. */
  raw: PartialVector;
  weight: number;
  observedAt: Date;
  policyTopic: string | null;
}

/** Why this vote is the TD's own, or null when it only repeats the party line. */
function disciplineOf(v: EvidenceVote): Discipline | null {
  // No baseline (an Independent, or a party with none): there is no prior to repeat.
  if (partyBaseline(v.party) === null) return 'free';
  if (v.partyMajority === null) return 'free'; // a tie
  const sided = v.partyTa + v.partyNil;
  if (sided > 0 && Math.min(v.partyTa, v.partyNil) / sided >= PARTY_SPLIT_SHARE) return 'free';
  return v.vote === v.partyMajority ? null : 'rebel';
}

/** The evidence rows one division gives, one per TD at most. */
export function divisionEvidence(meaning: DivisionMeaning, records: EvidenceVote[]): DivisionEvidenceRow[] {
  if (meaning.status !== 'classified' || !(meaning.confidence >= MIN_DIVISION_CONFIDENCE)) return [];
  const rows: DivisionEvidenceRow[] = [];
  for (const v of records) {
    if (v.tdId === null || v.vote === 'staon') continue;
    const discipline = disciplineOf(v);
    if (!discipline) continue;
    const lobby = v.vote === 'ta' ? 1 : meaning.nilWeight;
    const weight = DIVISION_WEIGHT[discipline] * meaning.confidence * meaning.salience * lobby;
    if (!(weight > 0)) continue;
    rows.push({
      tdId: v.tdId,
      divisionId: v.divisionId,
      raw: { ...(v.vote === 'ta' ? meaning.taLean : meaning.nilLean) },
      weight,
      observedAt: new Date(v.heldAt ?? `${v.date}T12:00:00Z`),
      policyTopic: meaning.policyTopic,
    });
  }
  return rows;
}

/**
 * The caps on how much the division record says about one TD, over the whole set of rows:
 * first per debate section (DIVISION_SECTION_CAP), then in total (DIVISION_TOTAL_CAP). Each
 * cap scales that TD's rows in the group down by the same factor, so their mean is unchanged.
 */
export function capDivisionWeights<T extends { tdId: number; section: string; weight: number }>(rows: T[]): T[] {
  const capped = rows.map((r) => ({ ...r }));
  const cap = (group: (r: T) => string, limit: number) => {
    const sums = new Map<string, number>();
    for (const r of capped) sums.set(group(r), (sums.get(group(r)) ?? 0) + r.weight);
    for (const r of capped) {
      const sum = sums.get(group(r))!;
      if (sum > limit) r.weight *= limit / sum;
    }
  };
  cap((r) => `${r.tdId}\u0000${r.section}`, DIVISION_SECTION_CAP);
  cap((r) => String(r.tdId), DIVISION_TOTAL_CAP);
  return capped;
}
