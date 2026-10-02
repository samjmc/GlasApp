import { describe, expect, it } from 'vitest';
import { findQuote, quoteSha, skeleton, stripRepeatedLines, type PageText } from './normalise';

// Invented text: no manifesto is quoted in this repo.
const pages: PageText[] = [
  { ordinal: 1, text: 'Our plan starts with the ﬁnancial security of every household in the land.' },
  { ordinal: 2, text: 'We will build twelve thousand new\nhomes every single year until the waiting lists are gone.' },
  { ordinal: 3, text: 'Rivers and lakes will be cleaned. Farmers who protect a river bank will be paid for that work.' },
  { ordinal: 4, text: 'Every child will get a free hot meal at school, and every school will get a garden.' },
  { ordinal: 5, text: 'Every child will get a free hot meal at school, and every school will get a garden.' },
  { ordinal: 6, text: 'Public transport will be free for everyone under twenty five years of age.' },
];

describe('skeleton', () => {
  it('makes ligatures, curly quotes, dashes, soft hyphens and whitespace equal', () => {
    expect(skeleton('ﬁnancial')).toBe(skeleton('financial'));
    expect(skeleton('“Fair” — pay­ment,  now')).toBe(skeleton('"fair" - payment now'));
  });

  it('joins a word hyphenated at a line break', () => {
    expect(skeleton('well-\nbeing')).toBe(skeleton('well-being'));
    expect(skeleton('well-\nbeing')).toBe(skeleton('wellbeing'));
  });
});

describe('findQuote', () => {
  it('matches a quote typed with "fi" against a page set with the ﬁ ligature', () => {
    expect(findQuote(pages, 'the financial security of every household', 1)).toEqual({ found: true, page: 1, pageCorrected: false });
  });

  it('finds a quote that crosses a page break and cites it at its start page', () => {
    const quote = 'We will build twelve thousand new homes every single year';
    expect(findQuote(pages, quote, 2)).toEqual({ found: true, page: 2, pageCorrected: false });
    const across: PageText[] = [
      { ordinal: 1, text: 'Intro. We will build twelve thousand' },
      { ordinal: 2, text: 'new homes every single year. The end.' },
    ];
    expect(findQuote(across, quote, 1)).toEqual({ found: true, page: 1, pageCorrected: false });
    expect(findQuote(across, quote, 2)).toEqual({ found: true, page: 1, pageCorrected: true });
  });

  it('needs the fragments of an elided quote in order', () => {
    expect(findQuote(pages, 'Rivers and lakes will be cleaned … paid for that work', 3).found).toBe(true);
    expect(findQuote(pages, 'paid for that work … Rivers and lakes will be cleaned', 3)).toEqual({ found: false, reason: 'not_found' });
  });

  it('rejects a quote under 6 or over 50 words', () => {
    expect(findQuote(pages, 'Rivers and lakes will be', 3)).toEqual({ found: false, reason: 'too_short' });
    expect(findQuote(pages, 'Rivers and lakes will be cleaned', 3).found).toBe(true);
    expect(findQuote(pages, Array(51).fill('word').join(' '), 3)).toEqual({ found: false, reason: 'too_long' });
  });

  it('corrects the page when the quote is on exactly one other page, and refuses when it is on several', () => {
    expect(findQuote(pages, 'free for everyone under twenty five years', 1)).toEqual({ found: true, page: 6, pageCorrected: true });
    expect(findQuote(pages, 'every child will get a free hot meal', 1)).toEqual({ found: false, reason: 'several_pages' });
    expect(findQuote(pages, 'every child will get a free hot meal', 5)).toEqual({ found: true, page: 5, pageCorrected: false });
  });

  it('does not find a quote that is not in the document', () => {
    expect(findQuote(pages, 'we will abolish every tax on the first day', 1)).toEqual({ found: false, reason: 'not_found' });
  });
});

describe('quoteSha', () => {
  it('is 16 hex, the same for texts that differ only in typography, and different for a changed word', () => {
    expect(quoteSha('“Fair” pay—now')).toMatch(/^[0-9a-f]{16}$/);
    expect(quoteSha('“Fair” pay—now')).toBe(quoteSha('fair pay now'));
    expect(quoteSha('fair pay now')).not.toBe(quoteSha('fair pay later'));
  });
});

describe('stripRepeatedLines', () => {
  it('removes a header or footer on more than half the pages, with page numbers masked', () => {
    const body = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
    const texts = body.map((b, i) => `A Fairer Tomorrow\n${b} text\nshared line\nPage ${i + 1} of 6`);
    // "shared line" is on exactly half the pages here, so it stays.
    texts.forEach((t, i) => { if (i >= 3) texts[i] = t.replace('shared line\n', ''); });
    expect(stripRepeatedLines(texts)).toEqual(body.map((b, i) => (i < 3 ? `${b} text\nshared line` : `${b} text`)));
  });

  it('keeps every line of a document under 4 pages', () => {
    const texts = ['Header\none', 'Header\ntwo', 'Header\nthree'];
    expect(stripRepeatedLines(texts)).toEqual(texts);
  });
});
