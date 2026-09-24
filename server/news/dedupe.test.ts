import { describe, expect, it } from 'vitest';
import { dedupe, titleSimilarity, TITLE_SIMILARITY_THRESHOLD } from './dedupe';
import type { NewArticle } from './normalize';

const art = (url: string, title: string): NewArticle => ({
  sourceSlug: 'rte',
  url,
  title,
  summary: null,
  content: '',
  imageUrl: null,
  publishedAt: new Date('2026-09-22T10:00:00Z'),
});

describe('titleSimilarity', () => {
  it('scores a syndicated copy with a small edit above the threshold', () => {
    expect(
      titleSimilarity('Helen McEntee faces pressure over garda whistleblowers', 'Helen McEntee faces mounting pressure over garda whistleblowers'),
    ).toBeGreaterThanOrEqual(TITLE_SIMILARITY_THRESHOLD);
  });
  it('leaves a real rewording to the scoring pipeline (same event, different story)', () => {
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
  it('drops a URL already stored', () => {
    const r = dedupe([art('https://a.ie/1', 'Story one')], [{ url: 'https://a.ie/1', title: '' }]);
    expect(r.fresh).toEqual([]);
    expect(r.duplicates).toEqual([{ article: art('https://a.ie/1', 'Story one'), reason: 'url', of: 'https://a.ie/1' }]);
  });

  it('drops a near-identical title from another outlet, keeping the first', () => {
    const first = art('https://rte.ie/x', 'Helen McEntee faces pressure over garda whistleblowers');
    const second = art('https://thejournal.ie/y', 'Helen McEntee faces mounting pressure over garda whistleblowers');
    const r = dedupe([first, second], []);
    expect(r.fresh).toEqual([first]);
    expect(r.duplicates.map((d) => [d.reason, d.of])).toEqual([['title', 'https://rte.ie/x']]);
  });

  it('drops a repeat of the same URL within one batch', () => {
    const r = dedupe([art('https://a.ie/1', 'Story one'), art('https://a.ie/1', 'Story one, updated')], []);
    expect(r.fresh).toHaveLength(1);
    expect(r.duplicates[0].reason).toBe('url');
  });

  it('keeps distinct stories', () => {
    const r = dedupe([art('https://a.ie/1', 'Budget 2027: childcare costs cut'), art('https://a.ie/2', 'Storm warning issued for Kerry')], []);
    expect(r.fresh).toHaveLength(2);
    expect(r.duplicates).toEqual([]);
  });
});
