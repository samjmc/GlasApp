/**
 * Fixtures are hand-made copies of the element shapes each live feed used on 2026-09-22.
 */
import { describe, expect, it } from 'vitest';
import { parseFeed } from './rss';

const rss = (items: string, ns = '') => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/" ${ns}>
<channel><title>Feed</title><link>https://example.ie</link>${items}</channel></rss>`;

describe('parseFeed', () => {
  it('Irish Times / RTÉ: image from media:content', async () => {
    const [item] = await parseFeed('rte', rss(`<item><title>Story</title><link>https://www.rte.ie/news/1</link>
      <pubDate>Tue, 22 Sep 2026 14:00:49 GMT</pubDate><description>Snippet</description>
      <media:content height="450" type="image/jpeg" url="https://www.rte.ie/images/a-800.jpg" width="800"/></item>`));
    expect(item).toMatchObject({
      sourceSlug: 'rte',
      link: 'https://www.rte.ie/news/1',
      title: 'Story',
      snippet: 'Snippet',
      imageUrl: 'https://www.rte.ie/images/a-800.jpg',
    });
    expect(new Date(item.published!).toISOString()).toBe('2026-09-22T14:00:49.000Z');
  });

  it('The Journal: falls back to media:thumbnail', async () => {
    const [item] = await parseFeed('the-journal', rss(`<item><title>S</title><link>https://www.thejournal.ie/x</link>
      <pubDate>Tue, 22 Sep 2026 16:47:00 GMT</pubDate><media:thumbnail url="https://c2.thejournal.ie/t.jpg" height="150" width="230"/></item>`));
    expect(item.imageUrl).toBe('https://c2.thejournal.ie/t.jpg');
  });

  it('Independent: image from media:content with a wildcard type', async () => {
    const [item] = await parseFeed('independent', rss(`<item><title>S</title><link>https://www.independent.ie/x</link>
      <pubDate>Tue, 22 Sep 2026 18:20:00 GMT</pubDate><media:content url="https://prod-img.independent.ie/p" medium="image" type="image/*"/></item>`));
    expect(item.imageUrl).toBe('https://prod-img.independent.ie/p');
  });

  it('The Ditch (Ghost): full body from content:encoded', async () => {
    const [item] = await parseFeed('the-ditch', rss(`<item><title>S</title><link>https://www.ontheditch.com/x/</link>
      <pubDate>Tue, 22 Sep 2026 17:14:58 GMT</pubDate><description>Short</description>
      <media:content url="https://storage.ghost.io/i.jpeg" medium="image"/>
      <content:encoded><![CDATA[<p>Long body</p>]]></content:encoded></item>`));
    expect(item).toMatchObject({ bodyHtml: '<p>Long body</p>', imageUrl: 'https://storage.ghost.io/i.jpeg', snippet: 'Short' });
  });

  it('Gript (WordPress): no image, HTML description', async () => {
    const [item] = await parseFeed('gript', rss(`<item><title>S</title><link>https://gript.ie/x/</link>
      <pubDate>Tue, 22 Sep 2026 16:55:17 +0000</pubDate><description><![CDATA[<p>Cheaper migrant labour</p>]]></description></item>`));
    expect(item.imageUrl).toBeUndefined();
    expect(item.snippet).toContain('Cheaper migrant labour');
  });

  it('Irish Examiner (Atom): alternate link, summary, and enclosure image', async () => {
    const [item] = await parseFeed('irish-examiner', `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom"><id>https://www.irishexaminer.com/</id><title>IE</title><updated>2026-09-22T21:14:37+01:00</updated>
      <entry><id>https://www.irishexaminer.com/news/arid-1.html</id><title>Helen McEntee story</title>
        <published>2026-09-22T20:37:00+01:00</published><updated>2026-09-22T20:37:00+01:00</updated>
        <link href="https://www.irishexaminer.com/news/arid-1.html" rel="alternate"/>
        <summary>The former justice minister</summary>
        <link href="https://www.irishexaminer.com/cms_media/img.jpg" rel="enclosure" type="image/jpeg"/></entry></feed>`);
    expect(item).toMatchObject({
      link: 'https://www.irishexaminer.com/news/arid-1.html',
      title: 'Helen McEntee story',
      snippet: 'The former justice minister',
      imageUrl: 'https://www.irishexaminer.com/cms_media/img.jpg',
    });
    expect(new Date(item.published!).toISOString()).toBe('2026-09-22T19:37:00.000Z');
  });
});
