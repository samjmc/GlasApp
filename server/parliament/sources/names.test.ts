import { describe, expect, it } from 'vitest';
import { makeNameMatcher } from './names';

const roster = [
  { memberCode: 'Pádraig-Mac-Lochlainn.D.2011-03-09', fullName: 'Pádraig Mac Lochlainn', constituency: 'Donegal' },
  { memberCode: 'Ged-Nash.D.2011-03-09', fullName: 'Ged Nash', constituency: 'Louth' },
  { memberCode: 'Martin-Daly.D.2024-11-29', fullName: 'Martin Daly', constituency: 'Roscommon-Galway' },
  { memberCode: 'Pa-Daly.D.2020-02-08', fullName: 'Pa Daly', constituency: 'Kerry' },
  { memberCode: 'Paul-Murphy.D.2014-10-10', fullName: 'Paul Murphy', constituency: 'Dublin South-West' },
  { memberCode: 'Verona-Murphy.D.2020-02-08', fullName: 'Verona Murphy', constituency: 'Wexford' },
  { memberCode: 'Michael-Healy-Rae.D.2011-03-09', fullName: 'Michael Healy-Rae', constituency: 'Kerry' },
  { memberCode: 'Natasha-Newsome-Drennan.D.2020-02-08', fullName: 'Natasha Newsome Drennan', constituency: 'Carlow-Kilkenny' },
];
const match = makeNameMatcher(roster);
const code = (n: { surname: string; forenames: string; constituency?: string | null }) => match(n)?.memberCode ?? null;

describe('makeNameMatcher', () => {
  it('matches the full name exactly through capitals, accents, spacing and honorifics', () => {
    expect(match({ surname: 'MACLOCHLAINN', forenames: 'Pádraig' })).toEqual({ memberCode: 'Pádraig-Mac-Lochlainn.D.2011-03-09', exact: true });
    expect(match({ surname: 'DALY', forenames: 'Dr. Martin' })).toEqual({ memberCode: 'Martin-Daly.D.2024-11-29', exact: true });
    expect(match({ surname: 'HEALY-RAE', forenames: 'Michael' })).toEqual({ memberCode: 'Michael-Healy-Rae.D.2011-03-09', exact: true });
  });

  it('falls back to surname plus first initial, and says the match was not exact', () => {
    // The allowance file prints "Nash, Gerald"; the roster knows him as Ged.
    expect(match({ surname: 'Nash', forenames: 'Gerald' })).toEqual({ memberCode: 'Ged-Nash.D.2011-03-09', exact: false });
  });

  it('uses the constituency to separate two members with one surname', () => {
    expect(code({ surname: 'DALY', forenames: 'Patrick', constituency: 'Kerry' })).toBe('Pa-Daly.D.2020-02-08');
  });

  it('allows one typo in the surname only when the first name is identical', () => {
    expect(match({ surname: 'Newsome Drennen', forenames: 'Natasha' })).toEqual({ memberCode: 'Natasha-Newsome-Drennan.D.2020-02-08', exact: false });
    expect(code({ surname: 'Newsome Drennen', forenames: 'Nora' })).toBeNull();
    expect(code({ surname: 'Newsome Drxnnxn', forenames: 'Natasha' })).toBeNull();
  });

  it('matches a surname only as whole words', () => {
    const m = makeNameMatcher([{ memberCode: 'Jim-ORyan.D.1', fullName: "Jim O'Ryan", constituency: 'Cork' }]);
    expect(m({ surname: 'Ryan', forenames: 'Jim' })).toBeNull();
    expect(m({ surname: "O'RYAN", forenames: 'James' })?.memberCode).toBe('Jim-ORyan.D.1');
  });

  it('never gives a former member to a current one with the same surname and another initial', () => {
    const m = makeNameMatcher([{ memberCode: 'John-Connolly.D.2024-11-29', fullName: 'John Connolly', constituency: 'Galway West' }]);
    expect(m({ surname: 'CONNOLLY', forenames: 'Catherine' })).toBeNull();
    expect(m({ surname: 'Connolly', forenames: 'John' })?.exact).toBe(true);
  });

  it('reads a short form of a first name by its initial ("Patrick" for Pa)', () => {
    expect(code({ surname: 'Daly', forenames: 'Patrick' })).toBe('Pa-Daly.D.2020-02-08');
  });

  it('returns NULL rather than guess between members', () => {
    const m = makeNameMatcher([
      { memberCode: 'Pa-Daly.D.1', fullName: 'Pa Daly', constituency: 'Kerry' },
      { memberCode: 'Peter-Daly.D.1', fullName: 'Peter Daly', constituency: 'Cork' },
    ]);
    expect(m({ surname: 'Daly', forenames: 'Patrick' })).toBeNull();
    expect(code({ surname: 'Nobody', forenames: 'Here' })).toBeNull();
  });

  it('can still pair two people who share a surname and an initial, so it marks that match non-exact', () => {
    // "Pat Murphy" is not Paul Murphy; the matcher cannot know, so the caller must drop a
    // non-exact match that collides with another printed name in the same file.
    expect(match({ surname: 'Murphy', forenames: 'Pat' })).toEqual({ memberCode: 'Paul-Murphy.D.2014-10-10', exact: false });
  });
});
