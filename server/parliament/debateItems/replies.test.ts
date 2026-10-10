import { describe, expect, it } from 'vitest';
import { namesTarget, sentenceAround, surnameForms } from './replies';

/** A reply whose quote is `quote`, inside `text`. */
const reply = (text: string, quote: string, targetName: string, targetRole: string | null = null) => {
  const quoteStart = text.indexOf(quote);
  if (quoteStart === -1) throw new Error(`quote not in text: ${quote}`);
  return namesTarget({ speechText: text, quoteStart, quoteEnd: quoteStart + quote.length, targetName, targetRole });
};

describe('surnameForms', () => {
  it('gives the surname with and without its first part, without fadas', () => {
    expect(surnameForms('Richard Boyd Barrett')).toEqual(['boyd barrett', 'barrett']);
    expect(surnameForms('Aengus Ó Snodaigh')).toEqual(['o snodaigh', 'snodaigh']);
    expect(surnameForms('Michael Healy-Rae')).toEqual(['healy-rae']);
    expect(surnameForms('Pa Daly')).toEqual(['daly']);
  });
});

describe('sentenceAround', () => {
  it('takes the whole sentence the quote is in, and no other', () => {
    const text = 'Thank you. As Deputy Whitmore said, the place is bright. Next point.';
    const start = text.indexOf('the place');
    expect(sentenceAround(text, start, start + 'the place is bright'.length).trim()).toBe('As Deputy Whitmore said, the place is bright.');
  });

  it('stops at a paragraph break, which transcripts write as ".\\n" with no space', () => {
    const text = 'I would like the Minister to act.\n\nThe valid point was made that this is old.\n\nNext.';
    const start = text.indexOf('The valid');
    expect(sentenceAround(text, start, start + 'The valid point was made'.length).trim()).toBe('The valid point was made that this is old.');
  });
});

// The eight replies in Sam's check of v2 items (2026-10-04), as the transcript has them.
describe('namesTarget, on the replies Sam checked', () => {
  it('rejects a reply that names someone else than the member it is linked to', () => {
    const text = 'I have to commend Deputy Coppinger on the comments she made. They were fair and accurate.';
    expect(reply(text, 'I have to commend Deputy Coppinger on the comments she made', 'George Lawlor')).toBe(false);
    expect(reply(text, 'I have to commend Deputy Coppinger on the comments she made', 'Ruth Coppinger')).toBe(true);
  });

  it('keeps a reply that names its target, in English or in Irish', () => {
    expect(reply('Deputies Gibney, Stanley and Murphy referred to the means test and the need to abolish it.', 'Deputies Gibney, Stanley and Murphy referred to the means test', 'Sinéad Gibney')).toBe(true);
    expect(reply('Deputy Boyd Barrett asked similar questions about the environment but we got bogged down.', 'Deputy Boyd Barrett asked similar questions about the environment', 'Richard Boyd Barrett')).toBe(true);
    expect(reply('Deputy Cullinane referred to the industry.', 'Deputy Cullinane referred to the industry', 'David Cullinane')).toBe(true);
    expect(reply('Aontaím leis an méid atá ráite ag an Teachta Ó Snodaigh ó thaobh na leasuithe atá as ord de.', 'Aontaím leis an méid atá ráite ag an Teachta Ó Snodaigh', 'Aengus Ó Snodaigh')).toBe(true);
  });

  it('counts a name just outside the quote, in the same sentence', () => {
    const text = 'We need a place that, as Deputy Whitmore described, is inspiring and welcoming.';
    expect(reply(text, 'is inspiring and welcoming', 'Jennifer Whitmore')).toBe(true);
    expect(reply('Deputy Whitmore spoke. The place is inspiring and welcoming.', 'The place is inspiring and welcoming', 'Jennifer Whitmore')).toBe(false);
  });

  it('drops a reply that names nobody, even when the link may be right (precision first)', () => {
    expect(reply('She made reference to an OECD report. I would like to put that on the record.', 'She made reference to an OECD report', 'Catherine Connolly')).toBe(false);
    expect(reply('Deputy, I also spoke about votes for citizens in Northern Ireland.', 'I also spoke about votes for citizens in Northern Ireland', 'Peadar Tóibín')).toBe(false);
  });
});

describe('namesTarget, by office', () => {
  const text = 'As the Minister said, the scheme opens in May.';
  it('names a member who spoke in office by the office word', () => {
    expect(reply(text, 'the scheme opens in May', "Darragh O'Brien", 'Minister for Climate, Energy and the Environment')).toBe(true);
    expect(reply('Dúirt an tAire go n-osclóidh an scéim i mBealtaine.', 'go n-osclóidh an scéim i mBealtaine', 'Jack Chambers', 'Minister for Public Expenditure')).toBe(true);
  });

  it('does not name a member who did not speak in office, or by the wrong office', () => {
    expect(reply(text, 'the scheme opens in May', 'Pearse Doherty', null)).toBe(false);
    expect(reply(text, 'the scheme opens in May', 'Micheál Martin', 'An Taoiseach')).toBe(false);
    expect(reply('The Government said the scheme opens in May.', 'the scheme opens in May', "Darragh O'Brien", 'Minister for Climate, Energy and the Environment')).toBe(false);
  });
});
