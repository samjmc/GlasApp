/**
 * What a Dáil division meant, as the ideology area records it: the kinds of question a
 * division can put, and the states a division's reading can be in. The ONE definition,
 * so the table that stores readings builds its CHECKs from these lists.
 */

export const DIVISION_KINDS = ['amendment', 'bill_stage', 'motion', 'countermotion', 'procedural', 'confidence', 'other'] as const;
export type DivisionKind = (typeof DIVISION_KINDS)[number];

/**
 * classified: read, with a lean.        no_signal: procedural, or every lean is 0; not retried.
 * no_context: no debate record yet.     failed: the model call or its output failed; retried.
 */
export const DIVISION_MEANING_STATUSES = ['classified', 'no_signal', 'no_context', 'failed'] as const;
export type DivisionMeaningStatus = (typeof DIVISION_MEANING_STATUSES)[number];
