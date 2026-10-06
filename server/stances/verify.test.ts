import { describe, expect, it } from 'vitest';
import { extractionText, type CandidateTd, type RawStance } from './extract';
import { NEAR_CHARS, SENTENCE_MAX_WORDS, insideTeaser, namesFor, normalise, quotationAround, sentenceSpan, verifyStances } from './verify';

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
    // Widened to the whole sentence, so it says who spoke.
    expect(result.accepted[0]!.quote).toBe('“We will deliver fifty thousand new homes by the end of next year,” he said.');
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
    // A single line break inside the sentence is not a boundary.
    expect(result.accepted[0]!.quote).toBe('Separately, Ruairí Ó Murchú said the State must  build more\n  social homes on public land without delay.');
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

describe('link teasers', () => {
  const HARRIS: CandidateTd = { id: 5, name: 'Simon Harris', party: 'Fine Gael', offices: ['Tánaiste'] };
  const text = extractionText({
    title: 'Boiler scrappage scheme',
    content:
      'The scheme could be worth €2,000 to households.\n\n' +
      '[ ‘Help is on the way’ with energy costs, Simon Harris says in advance of budgetOpens in new window ]\n\n' +
      'Simon Harris said the Government would help households with energy costs this winter.',
  });

  it('rejects a quote that is a teaser for another article, and keeps a real one beside it', () => {
    const result = verifyStances(text, [HARRIS], [
      stance(5, '‘Help is on the way’ with energy costs, Simon Harris says in advance of budget', 'paraphrase', 'economy'),
      stance(5, 'the Government would help households with energy costs this winter', 'paraphrase', 'economy'),
    ]);
    expect(result.rejected.invalid).toBe(1);
    expect(result.accepted.map((a) => a.quote)).toEqual(['Simon Harris said the Government would help households with energy costs this winter.']);
  });

  it('knows what is inside a teaser and what is not', () => {
    const at = (fragment: string) => [text.indexOf(fragment), text.indexOf(fragment) + fragment.length] as const;
    expect(insideTeaser(text, ...at('Help is on the way'))).toBe(true);
    expect(insideTeaser(text, ...at('would help households'))).toBe(false);
    const editor = '"Prices rose [in their bills]," he said.';
    expect(insideTeaser(editor, editor.indexOf('in their'), editor.indexOf('in their') + 8)).toBe(false);
  });
});

// From a real article (2026-10-05): a journalist quoted on the radio, talking ABOUT two TDs.
// Both TDs were named only inside his quotation marks, and both quotes were accepted as theirs.
describe('a TD named only inside someone else’s quotation', () => {
  const HARRIS: CandidateTd = { id: 5, name: 'Simon Harris', party: 'Fine Gael', offices: ['Tánaiste'] };
  const text = extractionText({
    title: "No 'real secret' about the Government's plan to cut energy bills",
    content:
      'On The Claire Byrne Show, Paul Hosford of the Irish Examiner said this is something that the Government feels “can be done”. ' +
      '“Both Micheál Martin and Simon Harris made points to say it in their press conferences that decoupling the carbon tax from home heating oil is something that would be done,” he explained.\n\n' +
      '“Simon Harris was at the Oireachtas Budgetary Oversight Committee yesterday and he was talking about this and he said the Government can\'t fully insulate people from external energy shocks,” Mr Hosford recounted.',
  });

  it('rejects the quote as not near the TD, whether the model took all of the quotation or only part', () => {
    const result = verifyStances(text, [MARTIN, HARRIS], [
      stance(3, 'Both Micheál Martin and Simon Harris made points to say it in their press conferences that decoupling the carbon tax from home heating oil is something that would be done', 'direct', 'climate'),
      stance(5, "the Government can't fully insulate people from external energy shocks", 'paraphrase', 'economy'),
    ]);
    expect(result.accepted).toEqual([]);
    expect(result.rejected.td_not_near).toBe(2);
  });

  it("still accepts a TD's own quotation when the TD is named outside the marks", () => {
    const own = extractionText({
      title: 'Excise',
      content: 'Speaking in the Dáil, Mr Harris said: "Certainty for the winter period on excise is something that we can do and something that we will do."',
    });
    const result = verifyStances(own, [HARRIS], [stance(5, 'Certainty for the winter period on excise is something that we can do', 'direct', 'taxation')]);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]!.quoteKind).toBe('direct');
  });

  it('finds the quotation marks around a span, curly or straight, within one paragraph', () => {
    const at = (t: string, fragment: string) => [t.indexOf(fragment), t.indexOf(fragment) + fragment.length] as const;
    const curly = 'He said “we will build homes,” and left.';
    expect(quotationAround(curly, ...at(curly, 'we will'))).toEqual([curly.indexOf('“'), curly.indexOf('”') + 1]);
    expect(quotationAround(curly, ...at(curly, 'and left'))).toBeNull();
    const straight = 'She said "first" and then "we will build homes" today.';
    expect(quotationAround(straight, ...at(straight, 'we will'))).toEqual([straight.lastIndexOf('"we') , straight.lastIndexOf('"') + 1]);
    expect(quotationAround(straight, ...at(straight, 'and then'))).toBeNull();
    const twoParagraphs = '“An unclosed quote.\n\nMr Harris said homes will be built.';
    expect(quotationAround(twoParagraphs, ...at(twoParagraphs, 'homes will'))).toBeNull();
  });
});

describe('sentenceSpan', () => {
  const widen = (text: string, fragment: string) => {
    const at = text.indexOf(fragment);
    expect(at).toBeGreaterThanOrEqual(0);
    const [from, to] = sentenceSpan(text, at, at + fragment.length);
    return text.slice(from, to);
  };

  it('widens a fragment in quotation marks to the sentence that says who said it', () => {
    const text = 'Young people said they would leave. Johnny Guirke said many were going “from not being able to rent or to buy a home”. Others disagreed.';
    expect(widen(text, 'from not being able to rent or to buy a home')).toBe(
      'Johnny Guirke said many were going “from not being able to rent or to buy a home”.',
    );
  });

  it('does not end a sentence at a decimal point, an abbreviation or an initial', () => {
    expect(widen('Before. Mr. Doherty said the €1.5bn package was too small and Dr. Smith agreed. After.', 'the €1.5bn package was too small')).toBe(
      'Mr. Doherty said the €1.5bn package was too small and Dr. Smith agreed.',
    );
    expect(widen('Before. Conor D. McGuinness said the plan must change now. After.', 'the plan must change now')).toBe(
      'Conor D. McGuinness said the plan must change now.',
    );
  });

  it('keeps the closing mark after a full stop, and a straight opening mark', () => {
    expect(widen('He said: "We will build homes." Then he left.', 'We will build homes.')).toBe('He said: "We will build homes."');
    expect(widen('First one. "We will act now," she said. Last.', 'We will act now')).toBe('"We will act now," she said.');
  });

  it('stops at a paragraph break, and ends a question at its question mark', () => {
    expect(widen('Heading line\n\nThe Minister said the scheme would open in spring next year', 'the scheme would open in spring')).toBe(
      'The Minister said the scheme would open in spring next year',
    );
    expect(widen('Will you commit to a €400 energy credit? He did not answer.', 'commit to a €400 energy credit')).toBe(
      'Will you commit to a €400 energy credit?',
    );
  });

  // Real stored articles (2026-10-04) glue paragraphs together with no space, and carry link
  // teasers. Without these edges another speaker's sentence ended up inside a TD's quote.
  it('ends a sentence glued to the next one with no space', () => {
    const glued = 'it can be used as ID.Presenting the Bill, the Minister said it would allow use “on a voluntary basis”.The Opposition disagreed.';
    expect(widen(glued, 'on a voluntary basis')).toBe('Presenting the Bill, the Minister said it would allow use “on a voluntary basis”.');
    const quotes = '“Talks are open,” he said.“Balloting is only delaying a pay deal.“We will make provision,” he added.';
    expect(widen(quotes, 'Balloting is only delaying a pay deal')).toBe('“Balloting is only delaying a pay deal.');
    expect(widen('Whitmore called for a windfall tax, Whitmore said.She, too, called for a credit.', 'called for a windfall tax')).toBe(
      'Whitmore called for a windfall tax, Whitmore said.',
    );
    // Glued at a comma: without this, Harris's words became part of Martin's quote.
    const comma = 'Martin said the renters’ credit would be increased in the budget,Harris said it was a matter for budget day.';
    expect(widen(comma, 'the renters’ credit would be increased')).toBe('Martin said the renters’ credit would be increased in the budget,');
    // A normal comma is not an edge.
    expect(widen('Before. Martin said the credit, which is €1,000, would rise. After.', 'the credit, which is')).toBe(
      'Martin said the credit, which is €1,000, would rise.',
    );
  });

  it('treats a "[ … ]" link teaser as an edge, but not an editor\'s bracket inside a quote', () => {
    const teaser = '[ Irish Times poll reveals what voters want Opens in new window ] Labour spokesman Ged Nash called for a €400 credit. [ Rural heating oil Opens in new window ]';
    expect(widen(teaser, 'called for a €400 credit')).toBe('Labour spokesman Ged Nash called for a €400 credit.');
    const editor = 'Before. "A million households will see a double-digit increase [in their electricity bills]," Mr Doherty said. After.';
    expect(widen(editor, 'will see a double-digit increase')).toBe(
      '"A million households will see a double-digit increase [in their electricity bills]," Mr Doherty said.',
    );
  });

  it('keeps a quote that spans two sentences whole', () => {
    expect(widen('Intro. This shows the bonanza they enjoy. This is all happening now. End.', 'This shows the bonanza they enjoy. This is all happening')).toBe(
      'This shows the bonanza they enjoy. This is all happening now.',
    );
  });

  it(`leaves the quote alone when the sentence is over ${SENTENCE_MAX_WORDS} words`, () => {
    const long = `She said ${'more and more words '.repeat(25)}the plan must change now and then went on.`;
    expect(widen(long, 'the plan must change now')).toBe('the plan must change now');
  });
});
