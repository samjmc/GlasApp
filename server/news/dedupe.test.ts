import { describe, expect, it } from 'vitest';
import { dedupe, titleSimilarity, TITLE_SIMILARITY_THRESHOLD } from './dedupe';
import type { NewArticle } from './normalize';

const art = (url: string, title: string, publishedAt = '2026-09-22T10:00:00Z'): NewArticle => ({
  sourceSlug: 'rte',
  url,
  title,
  summary: null,
  content: '',
  imageUrl: null,
  images: [],
  publishedAt: new Date(publishedAt),
});

describe('titleSimilarity', () => {
  it('scores a syndicated copy with a small edit above the threshold', () => {
    expect(
      titleSimilarity('Helen McEntee faces pressure over garda whistleblowers', 'Helen McEntee faces mounting pressure over garda whistleblowers'),
    ).toBeGreaterThanOrEqual(TITLE_SIMILARITY_THRESHOLD);
  });
  it('leaves a real rewording to the event match (same event, different story)', () => {
    expect(
      titleSimilarity('Helen McEntee faces pressure over garda whistleblowers', 'McEntee under pressure over garda whistleblowers'),
    ).toBeLessThan(TITLE_SIMILARITY_THRESHOLD);
  });
  it('scores unrelated stories well below it', () => {
    expect(titleSimilarity('Budget 2027: childcare costs cut', 'Storm warning issued for Kerry')).toBeLessThan(0.2);
  });
  it('treats accented and curly-quoted titles as text, not noise', () => {
    expect(titleSimilarity('Tánaiste’s “plan” for Dáil reform', "Tánaiste's plan for Dáil reform")).toBeGreaterThan(0.9);
  });
  it('is 0 for two empty titles', () => {
    expect(titleSimilarity('', '')).toBe(0);
  });
});

describe('dedupe', () => {
  const MCENTEE = 'Helen McEntee faces pressure over garda whistleblowers';
  const MCENTEE_COPY = 'Helen McEntee faces mounting pressure over garda whistleblowers';

  it('drops a URL already stored', () => {
    const r = dedupe([art('https://a.ie/1', 'Story one')], [], new Set(['https://a.ie/1']));
    expect(r).toEqual({ fresh: [], links: [], knownUrls: 1 });
  });

  it('links a near-identical title from another outlet to the first', () => {
    const first = art('https://rte.ie/x', MCENTEE);
    const second = art('https://thejournal.ie/y', MCENTEE_COPY);
    const r = dedupe([first, second], [], new Set());
    expect(r.fresh).toEqual([first, second]);
    expect(r.links).toEqual([{ index: 1, of: { run: 0 } }]);
  });

  it('a later-published copy that comes first in the feed never becomes the canonical', () => {
    const later = art('https://thejournal.ie/y', MCENTEE_COPY, '2026-09-22T11:00:00Z');
    const earlier = art('https://rte.ie/x', MCENTEE, '2026-09-22T10:00:00Z');
    const r = dedupe([later, earlier], [], new Set());
    expect(r.fresh).toEqual([earlier, later]);
    expect(r.links).toEqual([{ index: 1, of: { run: 0 } }]);
  });

  it('breaks a publication-time tie by URL', () => {
    const r = dedupe([art('https://rte.ie/x', MCENTEE), art('https://independent.ie/z', MCENTEE_COPY)], [], new Set());
    expect(r.fresh.map((a) => a.url)).toEqual(['https://independent.ie/z', 'https://rte.ie/x']);
    expect(r.links).toEqual([{ index: 1, of: { run: 0 } }]);
  });

  it('links a copy of a stored story to the stored id', () => {
    const r = dedupe([art('https://thejournal.ie/y', MCENTEE_COPY)], [{ id: 7, url: 'https://rte.ie/x', title: MCENTEE }], new Set());
    expect(r.links).toEqual([{ index: 0, of: { stored: 7 } }]);
  });

  it('drops a repeat of the same URL within one batch', () => {
    const r = dedupe([art('https://a.ie/1', 'Story one'), art('https://a.ie/1', 'Story one, updated')], [], new Set());
    expect(r.fresh).toHaveLength(1);
    expect(r.knownUrls).toBe(1);
  });

  it('keeps distinct stories', () => {
    const r = dedupe([art('https://a.ie/1', 'Budget 2027: childcare costs cut'), art('https://a.ie/2', 'Storm warning issued for Kerry')], [], new Set());
    expect(r.fresh).toHaveLength(2);
    expect(r.links).toEqual([]);
  });
});
