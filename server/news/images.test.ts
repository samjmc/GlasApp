import { describe, expect, it } from 'vitest';
import { MIN_GOOD_WIDTH, candidateOrder, cleanImageUrl, firstLoading, needsPageImage, rankFeedImages, upgradeImage, type ImageCandidate } from './images';

const c = (url: string, width: number | null, origin: 'feed' | 'page' = 'feed'): ImageCandidate => ({ url, width, origin });

describe('cleanImageUrl', () => {
  it('decodes entities, upgrades http, resolves relative paths', () => {
    expect(cleanImageUrl('http://x.ie/a.jpg?w=1&amp;h=2')).toBe('https://x.ie/a.jpg?w=1&h=2');
    expect(cleanImageUrl('/img/a.png', 'https://gript.ie/story/')).toBe('https://gript.ie/img/a.png');
  });
  it('rejects data URIs, javascript and junk', () => {
    expect(cleanImageUrl('data:image/png;base64,AAA')).toBeNull();
    expect(cleanImageUrl('javascript:alert(1)')).toBeNull();
    expect(cleanImageUrl('')).toBeNull();
    expect(cleanImageUrl(undefined)).toBeNull();
  });
});

describe('upgradeImage', () => {
  it('RTÉ -800 becomes -1600 (the rendition their article page uses)', () => {
    expect(upgradeImage(c('https://www.rte.ie/images/0024dfb0-800.jpg', 800))).toEqual(c('https://www.rte.ie/images/0024dfb0-1600.jpg', 1600));
  });
  it('leaves an RTÉ -1600, and every other host, alone', () => {
    const big = c('https://www.rte.ie/images/0024dfb0-1600.jpg', 1600);
    expect(upgradeImage(big)).toBe(big);
    const other = c('https://gript.ie/x-800.jpg', 800);
    expect(upgradeImage(other)).toBe(other);
  });
});

describe('rankFeedImages', () => {
  it('puts the upgrade first, keeps the original as fallback, dedupes, sorts widest first', () => {
    expect(
      rankFeedImages([c('https://x.ie/thumb.jpg', 230), c('https://www.rte.ie/images/ab-800.jpg', 800), c('https://x.ie/thumb.jpg', 230), c('https://x.ie/n.jpg', null)]),
    ).toEqual([
      c('https://www.rte.ie/images/ab-1600.jpg', 1600),
      c('https://www.rte.ie/images/ab-800.jpg', 800),
      c('https://x.ie/thumb.jpg', 230),
      c('https://x.ie/n.jpg', null),
    ]);
  });
});

describe('needsPageImage', () => {
  it('is false only when some feed image is known to be large', () => {
    expect(needsPageImage([c('a', MIN_GOOD_WIDTH)])).toBe(false);
    expect(needsPageImage([c('a', MIN_GOOD_WIDTH - 1)])).toBe(true);
    expect(needsPageImage([c('a', null)])).toBe(true);
    expect(needsPageImage([])).toBe(true);
  });
});

describe('candidateOrder', () => {
  it('large feed image, then the page image, then smaller feed images', () => {
    const order = candidateOrder([c('big', 1600), c('small', 630), c('unknown', null)], c('page', null, 'page'));
    expect(order.map((x) => x.url)).toEqual(['big', 'page', 'small', 'unknown']);
  });
  it('the page image beats a small feed thumbnail (Journal 230px, Irish Times 630px)', () => {
    expect(candidateOrder([c('thumb', 230)], c('og', 1200, 'page')).map((x) => x.url)).toEqual(['og', 'thumb']);
  });
  it('does not list the same URL twice when the page repeats the feed image', () => {
    expect(candidateOrder([c('same', 630)], c('same', null, 'page')).map((x) => x.url)).toEqual(['same']);
  });
});

describe('firstLoading', () => {
  it('returns the first candidate that loads, trying in order', async () => {
    const tried: string[] = [];
    const check = async (url: string) => (tried.push(url), url === 'second');
    expect(await firstLoading([c('first', 1), c('second', 1), c('third', 1)], check)).toEqual(c('second', 1));
    expect(tried).toEqual(['first', 'second']);
  });
  it('is null when nothing loads', async () => {
    expect(await firstLoading([c('a', 1)], async () => false)).toBeNull();
  });
});
