import { describe, expect, it } from 'vitest';
import { canonicalUrl, cutSummary, normalizeItem, stripHtml, type RawItem } from './normalize';

const NOW = new Date('2026-09-22T12:00:00Z');
const item = (over: Partial<RawItem> = {}): RawItem => ({
  sourceSlug: 'rte',
  link: 'https://www.rte.ie/news/2026/0922/story/?utm_source=rss#top',
  title: 'Minister announces housing plan',
  published: '2026-09-22T09:00:00Z',
  snippet: 'The plan covers 50,000 homes.',
  bodyHtml: undefined,
  images: [
    { url: 'https://www.rte.ie/images/0024dfb0-800.jpg', width: 800, origin: 'feed' },
    { url: 'https://img.rte.ie/thumb.jpg', width: 200, origin: 'feed' },
  ],
  ...over,
});

describe('canonicalUrl', () => {
  it('drops query, fragment and trailing slash', () => {
    expect(canonicalUrl('https://www.rte.ie/news/story/?a=1#x')).toBe('https://www.rte.ie/news/story');
  });
  it('keeps a bare origin slash', () => {
    expect(canonicalUrl('https://gript.ie/')).toBe('https://gript.ie/');
  });
  it('rejects non-http and garbage', () => {
    expect(canonicalUrl('javascript:alert(1)')).toBeNull();
    expect(canonicalUrl('not a url')).toBeNull();
  });
});

describe('cutSummary', () => {
  it('returns short text unchanged', () => {
    expect(cutSummary('Short.', 600)).toBe('Short.');
  });
  it('cuts at the last sentence end inside the window', () => {
    const text = `${'a'.repeat(40)}. ${'b'.repeat(40)}. ${'c'.repeat(40)}`;
    expect(cutSummary(text, 90)).toBe(`${'a'.repeat(40)}. ${'b'.repeat(40)}.`);
  });
  it('falls back to a word boundary with an ellipsis', () => {
    expect(cutSummary('one two three four five six', 12)).toBe('one two…');
  });
});

describe('stripHtml', () => {
  it('removes tags and decodes common entities', () => {
    expect(stripHtml('<p>Fianna F&amp;aacute; &amp; <b>Labour</b></p>')).toBe('Fianna F&aacute; & Labour');
    expect(stripHtml('<script>x()</script>Text&nbsp;here')).toBe('Text here');
  });
});

describe('normalizeItem', () => {
  it('maps a feed item to a canonical article', () => {
    const r = normalizeItem(item(), NOW);
    expect(r).toEqual({
      ok: true,
      article: {
        sourceSlug: 'rte',
        url: 'https://www.rte.ie/news/2026/0922/story',
        title: 'Minister announces housing plan',
        summary: 'The plan covers 50,000 homes.',
        content: 'The plan covers 50,000 homes.',
        // RTÉ's -800 is upgraded to the -1600 its own page uses; the original stays as a fallback.
        imageUrl: 'https://www.rte.ie/images/0024dfb0-1600.jpg',
        images: [
          { url: 'https://www.rte.ie/images/0024dfb0-1600.jpg', width: 1600, origin: 'feed' },
          { url: 'https://www.rte.ie/images/0024dfb0-800.jpg', width: 800, origin: 'feed' },
          { url: 'https://img.rte.ie/thumb.jpg', width: 200, origin: 'feed' },
        ],
        publishedAt: new Date('2026-09-22T09:00:00Z'),
      },
    });
  });

  it('has no picture when the feed offers none', () => {
    const r = normalizeItem(item({ images: [] }), NOW);
    expect(r.ok && [r.article.imageUrl, r.article.images]).toEqual([null, []]);
  });

  it('prefers the full body for content when the feed has one', () => {
    const r = normalizeItem(item({ bodyHtml: '<p>Full body text.</p>' }), NOW);
    expect(r.ok && r.article.content).toBe('Full body text.');
  });

  it('strips the WordPress "appeared first on" footer from summaries', () => {
    const r = normalizeItem(item({ snippet: 'Cheaper migrant labour The post Are we on the same trajectory appeared first on Gript.' }), NOW);
    expect(r.ok && r.article.summary).toBe('Cheaper migrant labour');
  });

  it.each([
    [{ link: undefined }, 'no usable link'],
    [{ title: '  ' }, 'no title'],
    [{ published: 'yesterday-ish' }, 'no usable date'],
    [{ published: '2026-09-19T11:59:00Z' }, 'too old'],
  ])('rejects %o', (over, reason) => {
    expect(normalizeItem(item(over), NOW)).toEqual({ ok: false, reason });
  });

  it('clamps a future publish date to now', () => {
    const r = normalizeItem(item({ published: '2026-09-23T12:00:00Z' }), NOW);
    expect(r.ok && r.article.publishedAt).toEqual(NOW);
  });

  it('leaves summary null and content empty when the feed has no text', () => {
    const r = normalizeItem(item({ snippet: undefined }), NOW);
    expect(r.ok && [r.article.summary, r.article.content]).toEqual([null, '']);
  });
});
