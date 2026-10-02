import { describe, expect, it } from 'vitest';
import { extractionText, type CandidateTd, type RawStance } from './extract';
import { NEAR_CHARS, namesFor, normalise, verifyStances } from './verify';

const OBRIEN: CandidateTd = { id: 1, name: "Darragh O'Brien", party: 'Fianna Fáil', offices: ['Minister for Housing'] };
const MURCHU: CandidateTd = { id: 2, name: 'Ruairí Ó Murchú', party: 'Sinn Féin', offices: [] };
const MARTIN: CandidateTd = { id: 3, name: 'Micheál Martin', party: 'Fianna Fáil', offices: ['Taoiseach'] };
const MCDONALD: CandidateTd = { id: 4, name: 'Mary Lou McDonald', party: 'Sinn Féin', offices: [] };
const CANDIDATES = [OBRIEN, MURCHU, MARTIN, MCDONALD];

const FILLER = ' Officials declined to comment on the timetable for the scheme.'.repeat(8);

const TEXT = extractionText({
  title: 'Housing row in the Dáil',
  content:
    'Mr O’Brien defended the plan. “We will deliver fifty thousand new homes by the end of next year,” he said.' +
    ' Separately, Ruairí Ó Murchú said the State must  build more\n  social homes on public land without delay.' +
    FILLER +
    ' The Taoiseach said the Government’s budget would not increase the carbon tax this year at all.',
});

const stance = (tdId: number, quote: string, quoteKind: RawStance['quoteKind'] = 'paraphrase', policyDomain = 'housing'): RawStance => ({
  tdId,
  policyDomain,
  quote,
  quoteKind,
});

const verify = (...stances: RawStance[]) => verifyStances(TEXT, CANDIDATES, stances);

describe('normalise', () => {
  it('strips fadas, lower-cases, straightens quotes and dashes, and collapses whitespace', () => {
    expect(normalise('  Ó Murchú’s  “plan” — now\n\tok ').text).toBe(`o murchu's "plan" - now ok`);
  });

  it('keeps an offset back to the original for every character', () => {
    const original = 'A  “Béal”';
    const n = normalise(original);
    expect(n.offsets).toHaveLength(n.text.length);
    expect(original[n.offsets[n.text.indexOf('b')]!]).toBe('B');
    expect(original[n.offsets[n.text.indexOf('"')]!]).toBe('“');
  });
});

describe('verifyStances', () => {
  it('matches a quote typed with straight quotes against curly ones, and returns the article’s own text', () => {
    const result = verify(stance(1, '"We will deliver fifty thousand new homes by the end of next year,"', 'direct'));
    expect(result.rejected).toEqual({ invalid: 0, quote_not_found: 0, td_not_near: 0, duplicate: 0 });
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]).toMatchObject({ tdId: 1, quoteKind: 'direct', policyDomain: 'housing' });
    expect(result.accepted[0]!.quote).toBe('We will deliver fifty thousand new homes by the end of next year,');
    expect(TEXT.slice(result.accepted[0]!.start, result.accepted[0]!.end)).toBe(result.accepted[0]!.quote);
  });

  it('matches across fadas in the quote and in the TD name', () => {
    const text = 'Ruairi O Murchu said the State must build more social homes on public land without delay.';
    const result = verifyStances(text, CANDIDATES, [stance(2, 'the Státe must build more social homes on públic land')]);
    expect(result.accepted.map((a) => a.tdId)).toEqual([2]);
  });

  it('matches across collapsed whitespace and maps back to the original span', () => {
    const result = verify(stance(2, 'the State must build more social homes on public land without delay'));
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]!.quote).toBe('the State must  build more\n  social homes on public land without delay');
  });

  it('rejects a quote with an ellipsis, even when each part is in the text', () => {
    const result = verify(
      stance(1, 'We will deliver fifty thousand new homes ... by the end of next year', 'direct'),
      stance(2, 'the State must build more social homes… on public land without delay'),
    );
    expect(result.accepted).toEqual([]);
    expect(result.rejected.invalid).toBe(2);
  });

  it('rejects a quote that is not in the text', () => {
    const result = verify(stance(1, 'We will abolish the property tax and cap every rent in the country', 'direct'));
    expect(result.accepted).toEqual([]);
    expect(result.rejected.quote_not_found).toBe(1);
  });

  it('downgrades a "direct" quote with no opening quote mark to paraphrase', () => {
    const result = verify(stance(2, 'the State must build more social homes on public land without delay', 'direct'));
    expect(result.accepted[0]!.quoteKind).toBe('paraphrase');
    expect(result.downgraded).toBe(1);
  });

  it('does not take an apostrophe for an opening quote mark', () => {
    const text = "Ruairi O Murchu's the State must build more social homes on public land without delay.";
    const result = verifyStances(text, CANDIDATES, [stance(2, 's the State must build more social homes on public land', 'direct')]);
    expect(result.accepted[0]!.quoteKind).toBe('paraphrase');
  });

  it('rejects a TD whose name is not near the quote', () => {
    const result = verify(stance(4, 'the State must build more social homes on public land without delay'));
    expect(result.accepted).toEqual([]);
    expect(result.rejected.td_not_near).toBe(1);
  });

  it(`counts a name only within ${NEAR_CHARS} characters of the quote`, () => {
    const quote = 'the State must build more social homes on public land without delay';
    const near = `McDonald spoke. ${'x'.repeat(NEAR_CHARS - 20)} ${quote}.`;
    const far = `McDonald spoke. ${'x'.repeat(NEAR_CHARS + 20)} ${quote}.`;
    expect(verifyStances(near, CANDIDATES, [stance(4, quote)]).accepted).toHaveLength(1);
    expect(verifyStances(far, CANDIDATES, [stance(4, quote)]).rejected.td_not_near).toBe(1);
  });

  it('accepts "the Taoiseach" for the TD who holds that office, and no one else', () => {
    const quote = 'the Government’s budget would not increase the carbon tax this year at all';
    const result = verify(stance(3, quote, 'paraphrase', 'climate'), stance(1, quote, 'paraphrase', 'climate'));
    expect(result.accepted.map((a) => a.tdId)).toEqual([3]);
    expect(result.rejected.td_not_near).toBe(1);
  });

  it('does not treat an office that merely mentions the Taoiseach as holding it', () => {
    const junior: CandidateTd = { id: 5, name: 'Jane Doe', party: null, offices: ['Minister of State at the Department of the Taoiseach'] };
    const quote = 'the Government’s budget would not increase the carbon tax this year at all';
    expect(verifyStances(TEXT, [junior], [stance(5, quote)]).rejected.td_not_near).toBe(1);
    expect(namesFor({ ...junior, offices: ['Tánaiste and Minister for Defence'] })).toContain('tanaiste');
  });

  it('accepts an office title near the quote', () => {
    const text = 'The Minister for Housing said the State must build more social homes on public land without delay.';
    expect(verifyStances(text, CANDIDATES, [stance(1, 'the State must build more social homes on public land')]).accepted).toHaveLength(1);
  });

  it('rejects an unknown td_id or domain as invalid', () => {
    const quote = 'the State must build more social homes on public land without delay';
    const result = verify(
      stance(99, quote),
      stance(2, quote, 'paraphrase', 'space_travel'),
      stance(2, quote, 'paraphrase', '__proto__'),
      stance(2, quote, 'paraphrase', 'constructor'),
    );
    expect(result.accepted).toEqual([]);
    expect(result.rejected.invalid).toBe(4);
  });

  it('rejects a quote shorter than the minimum', () => {
    expect(verify(stance(2, 'build more social homes')).rejected.invalid).toBe(1);
  });

  it('accepts at most one stance per TD', () => {
    const result = verify(
      stance(2, 'the State must build more social homes on public land without delay'),
      stance(2, 'said the State must build more social homes on public land'),
    );
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected.duplicate).toBe(1);
  });
});
