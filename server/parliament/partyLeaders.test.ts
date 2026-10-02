import { describe, expect, it } from 'vitest';
import { PARTY_LEADERS, validatePartyLeaders, type PartyLeader } from './partyLeaders';

const ok: PartyLeader = { memberCode: 'A-B.D.2020-02-08', party: 'Party A', from: '2024-01-01', to: null, source: 'https://example.ie/leader' };

describe('PARTY_LEADERS', () => {
  it('every entry is valid, dated and sourced, with one leader per party at a time', () => {
    expect(PARTY_LEADERS.length).toBeGreaterThan(0);
    expect(validatePartyLeaders(PARTY_LEADERS)).toHaveLength(PARTY_LEADERS.length);
  });
});

describe('validatePartyLeaders', () => {
  it('accepts a change of leader that does not overlap', () => {
    const change = [
      { ...ok, to: '2025-06-30' },
      { ...ok, memberCode: 'C-D.D.2020-02-08', from: '2025-07-01' },
    ];
    expect(validatePartyLeaders(change)).toHaveLength(2);
  });

  it.each([
    ['no member code', { memberCode: '' }, /memberCode/],
    ['no party', { party: ' ' }, /party/],
    ['a bad date', { from: '1 Jan 2024' }, /from/],
    ['an end before the start', { to: '2023-01-01' }, /before/],
    ['no https source', { source: 'http://example.ie' }, /source/],
  ])('rejects %s', (_label, change, message) => {
    expect(() => validatePartyLeaders([{ ...ok, ...change }])).toThrow(message);
  });

  it('rejects two leaders of one party at the same time', () => {
    expect(() => validatePartyLeaders([ok, { ...ok, memberCode: 'C-D.D.2020-02-08', from: '2025-01-01' }])).toThrow(/overlap/);
  });
});
