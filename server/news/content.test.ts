import { describe, expect, it } from 'vitest';
import { parsePage } from './content';

describe('parsePage', () => {
  it('reads Open Graph metadata and the article body, without chrome', () => {
    const page = parsePage(`<html><head><title>Fallback title</title>
      <meta property="og:title" content="Real headline">
      <meta property="og:description" content="Standfirst">
      <meta property="og:image" content="https://x.ie/i.jpg">
      <meta property="article:published_time" content="2026-09-22T10:00:00Z"></head>
      <body><nav>Menu</nav><article><p>First para.</p><script>track()</script><p>Second   para.</p></article><footer>Foot</footer></body></html>`);
    expect(page).toEqual({
      title: 'Real headline',
      summary: 'Standfirst',
      imageUrl: 'https://x.ie/i.jpg',
      publishedAt: new Date('2026-09-22T10:00:00Z'),
      body: 'First para.Second para.',
    });
  });

  it('falls back to <title> and body text, and ignores a bad date', () => {
    const page = parsePage(`<html><head><title> Only title </title><meta property="article:published_time" content="soon"></head><body><p>Text</p></body></html>`);
    expect(page).toMatchObject({ title: 'Only title', summary: null, imageUrl: null, publishedAt: null, body: 'Text' });
  });
});
