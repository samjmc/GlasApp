/**
 * What a Dáil division meant, as server/stances/divisions.ts reads it: the kinds of question a
 * division can put, the states a division's reading can be in, and why a reading was rejected.
 * The ONE definition, so the table that stores readings builds its CHECKs from these lists.
 */
import type { IdeologyDimension } from './ideology';

/**
 * amendment    Tá = for the amendment.
 * words_stand  "That the words proposed to be deleted stand": Tá = keep the original motion,
 *              against the countermotion.
 * as_amended   "That the motion, as amended, be agreed to": Tá = the amended text (never quoted).
 * unclear      the model cannot tell which question was put.
 */
export const DIVISION_KINDS = [
  'amendment',
  'words_stand',
  'as_amended',
  'motion',
  'bill_stage',
  'confidence',
  'procedural',
  'other',
  'unclear',
] as const;
export type DivisionKind = (typeof DIVISION_KINDS)[number];

/**
 * matched        Tá (and maybe Níl) states an option of a daily-vote question.
 * no_match       a verified meaning, but no candidate question's option states it.
 * no_candidates  no daily-vote question in the time window (yet).
 * procedural     a procedural or confidence question: never a position.
 * rejected       the model's reading failed a check (see DIVISION_REJECT_REASONS).
 * no_context     no debate record yet.
 * failed         the model call or its output failed; retried.
 */
export const DIVISION_READING_STATUSES = ['matched', 'no_match', 'no_candidates', 'procedural', 'rejected', 'no_context', 'failed'] as const;
export type DivisionReadingStatus = (typeof DIVISION_READING_STATUSES)[number];

export const DIVISION_REJECT_REASONS = ['invalid', 'quote_not_found', 'unsure', 'ambiguous'] as const;
export type DivisionRejectReason = (typeof DIVISION_REJECT_REASONS)[number];

/**
 * Dimensions the audit counts but does not score. The party baselines code the governing parties
 * as expert-led (Fianna Fáil −4.5, Fine Gael −4) and most of the opposition as less so (Sinn Féin
 * and Labour 0, Social Democrats −2, Green, PBP, Independent Ireland and Aontú +3 to +5), so on a
 * Dáil division the Tá − Níl gap on this axis is who is in government, not what the vote was
 * about. Measured 2026-10-10: on all four checked divisions the opposition voted Tá and Fianna
 * Fáil and Fine Gael Níl, the options leaned expert-led, and the audit "disagreed" 0 of 4 times.
 * Revisit if the baselines stop coding government status as governance style.
 */
export const AUDIT_UNSCORED_DIMENSIONS: readonly IdeologyDimension[] = ['technocratic'];
