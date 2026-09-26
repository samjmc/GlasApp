import { describe, expect, it } from 'vitest';
import type { DivisionVote } from '@shared/schema/parliament';
import { majority } from '../parliament/metrics';
import { divisionEvidence, type DivisionMeaning, type EvidenceVote } from './divisionEvidence';

const HELD = '2025-06-25T08:00:00.000Z';
const DIVISION = 'dail-34-2025-06-25-vote_91';

// c·s = 0.8 × 0.5 = 0.4 throughout, unless a test says otherwise.
const meaning = (over: Partial<DivisionMeaning> = {}): DivisionMeaning => ({
  status: 'classified',
  taLean: { economic: -2, welfare: -1 },
  nilLean: { economic: 1.5 },
  nilWeight: 0.4,
  confidence: 0.8,
  salience: 0.5,
  freeVote: false,
  policyTopic: 'property_tax',
  ...over,
});

let nextTd = 1;
const vote = (v: DivisionVote, party: string | null, over: Partial<EvidenceVote> = {}): EvidenceVote => ({
  divisionId: DIVISION,
  date: '2025-06-25',
  heldAt: HELD,
  tdId: nextTd++,
  party,
  vote: v,
  partyMajority: null,
  partyTa: 0,
  partyNil: 0,
  ...over,
});

/** A whole party's lobby, with the majority worked out the way the parliament area does. */
function party(name: string, ta: number, nil: number, staon = 0): EvidenceVote[] {
  const shared = { partyMajority: majority({ ta, nil, staon }), partyTa: ta, partyNil: nil };
  const lobby = (v: DivisionVote, n: number) => Array.from({ length: n }, () => vote(v, name, shared));
  return [...lobby('ta', ta), ...lobby('nil', nil), ...lobby('staon', staon)];
}

const weights = (rows: Array<{ weight: number }>) => rows.map((r) => Math.round(r.weight * 1000) / 1000);
const votesOf = (records: EvidenceVote[], rows: Array<{ tdId: number }>) =>
  rows.map((r) => records.find((x) => x.tdId === r.tdId)!.vote);

describe('divisionEvidence', () => {
  it('a Tá vote takes the Tá lean; a Níl vote the Níl lean, weighted by nil_weight', () => {
    const ta = vote('ta', 'Independent');
    const nil = vote('nil', 'Independent', { heldAt: null });
    expect(divisionEvidence(meaning(), [ta, nil])).toEqual([
      { tdId: ta.tdId, divisionId: DIVISION, raw: { economic: -2, welfare: -1 }, weight: expect.closeTo(0.4, 9), observedAt: new Date(HELD), policyTopic: 'property_tax' },
      // No time on the record: noon on the day.
      { tdId: nil.tdId, divisionId: DIVISION, raw: { economic: 1.5 }, weight: expect.closeTo(0.16, 9), observedAt: new Date('2025-06-25T12:00:00Z'), policyTopic: 'property_tax' },
    ]);
  });

  it('gives no row for Staon, an absent TD, a vote with no TD, low confidence, an unread division, or zero weight', () => {
    const free = () => vote('ta', 'Independent');
    // Absence is the lack of a record, so an absent TD can only ever give nothing.
    expect(divisionEvidence(meaning(), [])).toEqual([]);
    expect(divisionEvidence(meaning(), [vote('staon', 'Independent')])).toEqual([]);
    expect(divisionEvidence(meaning(), [vote('ta', 'Independent', { tdId: null })])).toEqual([]);
    expect(divisionEvidence(meaning({ confidence: 0.4 }), [free()])).toEqual([]);
    for (const status of ['no_signal', 'no_context', 'failed'] as const) {
      expect(divisionEvidence(meaning({ status }), [free()])).toEqual([]);
    }
    expect(divisionEvidence(meaning({ salience: 0 }), [free()])).toEqual([]);
    expect(divisionEvidence(meaning({ nilWeight: 0 }), [vote('nil', 'Independent')])).toEqual([]);
    // The same free vote does give a row once nothing above applies.
    expect(divisionEvidence(meaning(), [free()])).toHaveLength(1);
  });

  it('a TD with no party prior votes freely: Independents and a party with no baseline, weight 1·c·s', () => {
    // '100% RDR' is a registered party of one with no baseline: its TD voting with
    // "the party" says nothing a prior already says, because there is no prior.
    const records = [vote('ta', 'Independent'), vote('nil', null), ...party('100% RDR', 1, 0)];
    const rows = divisionEvidence(meaning({ nilWeight: 1 }), records);
    expect(rows.map((r) => r.tdId)).toEqual(records.map((r) => r.tdId));
    expect(weights(rows)).toEqual([0.4, 0.4, 0.4]);
  });

  it('a vote against the party majority is a rebellion, weight 1.5·c·s; with the whip gives no row', () => {
    const records = party('Sinn Féin', 1, 5);
    const rows = divisionEvidence(meaning(), records);
    expect(votesOf(records, rows)).toEqual(['ta']);
    expect(weights(rows)).toEqual([0.6]);
    expect(rows[0].raw).toEqual({ economic: -2, welfare: -1 });
  });

  it('a party of one with a baseline stays on its baseline', () => {
    expect(divisionEvidence(meaning(), party('Green Party', 1, 0))).toEqual([]);
  });

  it('a split party votes freely: 7–3 and exactly 20% (8–2), but 9–1 has one rebel', () => {
    const seven = party('Fianna Fáil', 7, 3);
    expect(weights(divisionEvidence(meaning({ nilWeight: 1 }), seven))).toEqual(Array(10).fill(0.4));
    const eight = party('Fianna Fáil', 8, 2);
    expect(weights(divisionEvidence(meaning({ nilWeight: 1 }), eight))).toEqual(Array(10).fill(0.4));
    const nine = party('Fianna Fáil', 9, 1);
    const rows = divisionEvidence(meaning(), nine);
    expect(votesOf(nine, rows)).toEqual(['nil']);
    expect(weights(rows)).toEqual([0.24]); // 1.5 × 0.4 × nil_weight 0.4
  });

  it('leaves Staon out of the split share', () => {
    // 4 Tá, 1 Níl, 5 Staon: 1 of the 5 who took a side is exactly 20%, so all five are free.
    // Counting Staon in the share would make it 10% and turn them into rebels at 1.5.
    const records = party('Fine Gael', 4, 1, 5);
    const rows = divisionEvidence(meaning({ nilWeight: 1 }), records);
    expect(votesOf(records, rows)).toEqual(['ta', 'ta', 'ta', 'ta', 'nil']);
    expect(weights(rows)).toEqual(Array(5).fill(0.4));
  });

  it('a tie is free; against a Staon majority is a rebellion', () => {
    expect(weights(divisionEvidence(meaning({ nilWeight: 1 }), party('Fine Gael', 2, 2)))).toEqual([0.4, 0.4, 0.4, 0.4]);
    const abstained = party('Fine Gael', 1, 0, 3);
    const rows = divisionEvidence(meaning(), abstained);
    expect(votesOf(abstained, rows)).toEqual(['ta']);
    expect(weights(rows)).toEqual([0.6]);
  });

  it('a free vote frees every member when the reading is at least 0.7 confident; below that the usual rules apply', () => {
    const records = party('Fianna Fáil', 9, 1);
    const sure = divisionEvidence(meaning({ freeVote: true, confidence: 0.7, nilWeight: 1 }), records);
    expect(weights(sure)).toEqual(Array(10).fill(0.35)); // 1 × 0.7 × 0.5
    const unsure = divisionEvidence(meaning({ freeVote: true, confidence: 0.6 }), records);
    expect(votesOf(records, unsure)).toEqual(['nil']);
  });
});
