import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractDocument, extractHtml, extractPdf, likelyImagePages } from './extract';

// Invented fixtures: no manifesto text is in this repo.
const FIXTURES = path.join(__dirname, 'fixtures');
const read = (name: string) => new Uint8Array(fs.readFileSync(path.join(FIXTURES, name)));

describe('extractPdf', () => {
  it('gives one page per PDF page, with its ordinal, printed label and text', async () => {
    const pages = await extractPdf(read('two-pages.pdf'));
    expect(pages.map((p) => [p.ordinal, p.label])).toEqual([[1, 'i'], [2, '7']]);
    expect(pages[0]!.text).toContain('We will pay a warden for every river in every county');
    expect(pages[1]!.text).toContain('Every village library will open on Sunday afternoons');
    expect(pages[0]!.text).not.toContain('village library');
  });
});

describe('extractHtml', () => {
  const pages = extractHtml(fs.readFileSync(path.join(FIXTURES, 'sections.html'), 'utf8'));

  it('splits on h1-h3, keeping the heading as the first line, and skips scripts and styles', () => {
    expect(pages.map((p) => [p.ordinal, p.heading])).toEqual([
      [1, null], [2, 'Quiet Rivers'], [3, 'Village Libraries'], [4, 'Photos'], [5, 'Night Buses'],
    ]);
    expect(pages[1]!.text).toBe([
      'Quiet Rivers',
      'We will pay a warden for every river in every county by the end of the term.',
      'Wardens will report to the local council.',
      'Each county will publish a river map every spring.',
    ].join('\n'));
    expect(pages[2]!.text).toContain('open on Sunday afternoons with volunteer help.');
    expect(pages.every((p) => p.label === null)).toBe(true);
    expect(pages.map((p) => p.text).join('\n')).not.toMatch(/analytics|color: green|invented manifesto for tests/);
  });

  it('flags a page under 50 characters as a likely image', () => {
    expect(likelyImagePages(pages)).toEqual([4]);
  });
});

describe('extractDocument', () => {
  it('names its extractor and drops lines repeated on most pages', async () => {
    const html = ['A', 'B', 'C', 'D'].map((s) => `<h1>Part ${s}</h1><p>Example Party manifesto 2024</p><p>Section ${s} words.</p>`).join('');
    const doc = await extractDocument('html', new TextEncoder().encode(html));
    expect(doc.extractor).toBe('cheerio');
    expect(doc.pages.map((p) => p.text)).toEqual(['Part A\nSection A words.', 'Part B\nSection B words.', 'Part C\nSection C words.', 'Part D\nSection D words.']);
    expect((await extractDocument('pdf', read('two-pages.pdf'))).extractor).toBe('unpdf@1.7.0');
  });
});
