import { describe, expect, it } from 'vitest';
import { parsePage } from './content';

describe('parsePage', () => {
  it('reads Open Graph metadata and the article body, without chrome', () => {
    const page = parsePage(`<html><head><title>Fallback title</title>
      <meta property="og:title" content="Real headline">
      <meta property="og:description" content="Standfirst">
      <meta property="og:image" content="https://x.ie/i.jpg">
      <meta property="og:image:width" content="1200">
      <meta property="article:published_time" content="2026-09-22T10:00:00Z"></head>
      <body><nav>Menu</nav><article><p>First para.</p><script>track()</script><p>Second   para.</p></article><footer>Foot</footer></body></html>`);
    expect(page).toEqual({
      title: 'Real headline',
      summary: 'Standfirst',
      imageUrl: 'https://x.ie/i.jpg',
      imageWidth: 1200,
      publishedAt: new Date('2026-09-22T10:00:00Z'),
      body: 'First para.Second para.',
    });
  });

  it('reads the image whatever the attribute order, and resolves a relative one', () => {
    const page = parsePage(`<html><head><meta content="/wp/og.jpg" property="og:image"></head><body></body></html>`, 'https://gript.ie/story/');
    expect(page.imageUrl).toBe('https://gript.ie/wp/og.jpg');
  });

  it('falls back to twitter:image when there is no og:image', () => {
    const page = parsePage(`<html><head><meta name="twitter:image" content="https://x.ie/tw.jpg"></head><body></body></html>`);
    expect(page.imageUrl).toBe('https://x.ie/tw.jpg');
  });

  it('falls back to <title> and body text, and ignores a bad date or width', () => {
    const page = parsePage(`<html><head><title> Only title </title><meta property="article:published_time" content="soon"><meta property="og:image:width" content="wide"></head><body><p>Text</p></body></html>`);
    expect(page).toMatchObject({ title: 'Only title', summary: null, imageUrl: null, imageWidth: null, publishedAt: null, body: 'Text' });
  });
});
