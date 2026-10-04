import { describe, expect, it } from 'vitest';
import type { DivisionVote } from '@shared/schema/parliament';
import { majority } from '../parliament/metrics';
import { disciplineOf, divisionStanceRows, PARTY_SPLIT_SHARE, type MatchedReading, type StanceVoteRecord } from './discipline';

const HELD = '2025-06-25T08:00:00.000Z';
const DIVISION = 'dail-34-2025-06-25-vote_91';

let nextTd = 1;
const vote = (v: DivisionVote, party: string | null, over: Partial<StanceVoteRecord> = {}): StanceVoteRecord => ({
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
function party(name: string, ta: number, nil: number, staon = 0): StanceVoteRecord[] {
  const shared = { partyMajority: majority({ ta, nil, staon }), partyTa: ta, partyNil: nil };
  const lobby = (v: DivisionVote, n: number) => Array.from({ length: n }, () => vote(v, name, shared));
  return [...lobby('ta', ta), ...lobby('nil', nil), ...lobby('staon', staon)];
}

const disciplines = (records: StanceVoteRecord[]) => records.filter((r) => r.vote !== 'staon').map((r) => [r.vote, disciplineOf(r)]);

describe('disciplineOf', () => {
  it('a TD with no party prior votes freely: Independents and a party with no baseline', () => {
    expect(disciplineOf(vote('ta', 'Independent'))).toBe('free');
    expect(disciplineOf(vote('nil', null))).toBe('free');
    // '100% RDR' is a registered party of one with no baseline: there is no prior to repeat.
    expect(disciplines(party('100% RDR', 1, 0))).toEqual([['ta', 'free']]);
  });

  it('against the party majority is a rebellion; with it, the whip', () => {
    expect(disciplines(party('Sinn Féin', 1, 5))).toEqual([['ta', 'rebel'], ...Array(5).fill(['nil', 'whip'])]);
  });

  it('a party of one with a baseline votes with the whip', () => {
    expect(disciplines(party('Green Party', 1, 0))).toEqual([['ta', 'whip']]);
  });

  it('a split party votes freely: 7–3 and exactly 20% (8–2), but 9–1 has one rebel', () => {
    expect(PARTY_SPLIT_SHARE).toBe(0.2);
    expect(new Set(disciplines(party('Fianna Fáil', 7, 3)).map(([, d]) => d))).toEqual(new Set(['free']));
    expect(new Set(disciplines(party('Fianna Fáil', 8, 2)).map(([, d]) => d))).toEqual(new Set(['free']));
    expect(disciplines(party('Fianna Fáil', 9, 1)).filter(([, d]) => d !== 'whip')).toEqual([['nil', 'rebel']]);
  });

  it('leaves Staon out of the split share', () => {
    // 4 Tá, 1 Níl, 5 Staon: 1 of the 5 who took a side is exactly 20%, so all five are free.
    expect(new Set(disciplines(party('Fine Gael', 4, 1, 5)).map(([, d]) => d))).toEqual(new Set(['free']));
  });

  it('a tie is free; against a Staon majority is a rebellion', () => {
    expect(new Set(disciplines(party('Fine Gael', 2, 2)).map(([, d]) => d))).toEqual(new Set(['free']));
    expect(disciplines(party('Fine Gael', 1, 0, 3))).toEqual([['ta', 'rebel']]);
  });
});

describe('divisionStanceRows', () => {
  const reading: MatchedReading = { divisionId: DIVISION, questionId: 10, taOptionKey: 'option_a', nilOptionKey: 'option_b', quote: 'That Dáil Éireann calls on the Government to build homes.' };
  const division = { id: DIVISION, date: '2025-06-25', heldAt: HELD, subject: 'Amendment put', debateTitle: 'Housing: Motion [Private Members]' };
  const question = { policyDomain: 'housing', options: [{ key: 'option_a', label: 'Build public homes' }, { key: 'option_b', label: 'Leave it to the market' }] };
  const URL = 'https://www.oireachtas.ie/en/debates/vote/dail/34/2025-06-25/91/';

  it('Tá takes the Tá option, Níl the Níl option, each with its discipline; Staon and absence give nothing', () => {
    const records = [...party('Sinn Féin', 5, 1, 1), vote('nil', 'Independent')];
    const rows = divisionStanceRows(reading, division, question, records, URL);
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => [r.divisionVote, r.optionKey, r.optionText, r.discipline])).toEqual([
      ...Array(5).fill(['ta', 'option_a', 'Build public homes', 'whip']),
      ['nil', 'option_b', 'Leave it to the market', 'rebel'],
      ['nil', 'option_b', 'Leave it to the market', 'free'],
    ]);
    expect(rows[0]).toEqual({
      tdId: records[0]!.tdId,
      articleId: null,
      divisionId: DIVISION,
      divisionVote: 'ta',
      discipline: 'whip',
      questionId: 10,
      optionKey: 'option_a',
      optionText: 'Build public homes',
      quote: reading.quote,
      quoteKind: 'division',
      policyDomain: 'housing',
      statedAt: new Date(HELD),
      articleUrl: URL,
      sourceName: 'Dáil Éireann',
      headline: 'Housing: Motion [Private Members]',
    });
  });

  it('no Níl option: no Níl rows', () => {
    const records = [vote('ta', 'Independent'), vote('nil', 'Independent')];
    const rows = divisionStanceRows({ ...reading, nilOptionKey: null }, division, question, records, URL);
    expect(rows.map((r) => r.divisionVote)).toEqual(['ta']);
  });

  it('no time on the record: noon on the day; no debate title: the subject, then "Dáil vote"', () => {
    const [row] = divisionStanceRows(reading, { ...division, heldAt: null, debateTitle: null }, question, [vote('ta', null)], URL);
    expect(row).toMatchObject({ statedAt: new Date('2025-06-25T12:00:00Z'), headline: 'Amendment put' });
    expect(divisionStanceRows(reading, { ...division, debateTitle: null, subject: null }, question, [vote('ta', null)], URL)[0]!.headline).toBe('Dáil vote');
  });

  it('no link for the division, or an option the question no longer has: no rows', () => {
    expect(divisionStanceRows(reading, division, question, [vote('ta', null)], null)).toEqual([]);
    expect(divisionStanceRows(reading, division, { ...question, options: [] }, [vote('ta', null)], URL)).toEqual([]);
  });
});
