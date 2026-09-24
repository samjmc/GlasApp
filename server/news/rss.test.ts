/**
 * Fixtures are hand-made copies of the element shapes each live feed used on 2026-09-22/24.
 */
import { describe, expect, it } from 'vitest';
import { parseFeed } from './rss';

const rss = (items: string, ns = '') => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/" ${ns}>
<channel><title>Feed</title><link>https://example.ie</link>${items}</channel></rss>`;

const feed = (url: string, width: number | null) => ({ url, width, origin: 'feed' });

describe('parseFeed', () => {
  it('RTÉ / Irish Times: image from media:content, with its width', async () => {
    const [item] = await parseFeed('rte', rss(`<item><title>Story</title><link>https://www.rte.ie/news/1</link>
      <pubDate>Tue, 22 Sep 2026 14:00:49 GMT</pubDate><description>Snippet</description>
      <media:content height="450" type="image/jpeg" url="https://www.rte.ie/images/a-800.jpg" width="800"/></item>`));
    expect(item).toMatchObject({
      sourceSlug: 'rte',
      link: 'https://www.rte.ie/news/1',
      title: 'Story',
      snippet: 'Snippet',
      images: [feed('https://www.rte.ie/images/a-800.jpg', 800)],
    });
    expect(new Date(item.published!).toISOString()).toBe('2026-09-22T14:00:49.000Z');
  });

  it('Irish Times: decodes &amp; in a signed resizer URL, keeping its query', async () => {
    const [item] = await parseFeed('irish-times', rss(`<item><title>S</title><link>https://www.irishtimes.com/x</link>
      <pubDate>Tue, 22 Sep 2026 14:00:49 GMT</pubDate>
      <media:content url="https://www.irishtimes.com/resizer/v2/A.jpg?auth=abc&amp;smart=true&amp;width=630" type="image/jpeg" width="630"/></item>`));
    expect(item.images).toEqual([feed('https://www.irishtimes.com/resizer/v2/A.jpg?auth=abc&smart=true&width=630', 630)]);
  });

  it('The Journal: both the 230px thumbnail and the 630px content image', async () => {
    const [item] = await parseFeed('the-journal', rss(`<item><title>S</title><link>https://www.thejournal.ie/x</link>
      <pubDate>Tue, 22 Sep 2026 16:47:00 GMT</pubDate>
      <media:thumbnail url="https://c2.thejournal.ie/t-230x150.jpg" height="150" width="230"/>
      <media:content url="https://c2.thejournal.ie/t-630x.jpg" width="630"/></item>`));
    expect(item.images).toEqual([feed('https://c2.thejournal.ie/t-630x.jpg', 630), feed('https://c2.thejournal.ie/t-230x150.jpg', 230)]);
  });

  it('Independent / Belfast Telegraph: media:content with a wildcard type, then the enclosure', async () => {
    const [item] = await parseFeed('independent', rss(`<item><title>S</title><link>https://www.independent.ie/x</link>
      <pubDate>Tue, 22 Sep 2026 18:20:00 GMT</pubDate><media:content url="https://prod-img.independent.ie/p" medium="image" type="image/*"/>
      <enclosure url="https://prod-img.independent.ie/p" type="image/jpeg" length="0"/></item>`));
    expect(item.images).toEqual([feed('https://prod-img.independent.ie/p', null), feed('https://prod-img.independent.ie/p', null)]);
  });

  it('The Ditch (Ghost): full body from content:encoded', async () => {
    const [item] = await parseFeed('the-ditch', rss(`<item><title>S</title><link>https://www.ontheditch.com/x/</link>
      <pubDate>Tue, 22 Sep 2026 17:14:58 GMT</pubDate><description>Short</description>
      <media:content url="https://storage.ghost.io/i.jpeg" medium="image"/>
      <content:encoded><![CDATA[<p>Long body</p>]]></content:encoded></item>`));
    expect(item).toMatchObject({ bodyHtml: '<p>Long body</p>', images: [feed('https://storage.ghost.io/i.jpeg', null)], snippet: 'Short' });
  });

  it('WordPress (The Currency): falls back to the first <img> in the body', async () => {
    const [item] = await parseFeed('the-currency', rss(`<item><title>S</title><link>https://thecurrency.news/a</link>
      <pubDate>Thu, 24 Sep 2026 09:16:34 +0000</pubDate>
      <content:encoded><![CDATA[<p><img width="1500" src="https://thecurrency.news/wp-content/uploads/x.jpg" /></p>]]></content:encoded></item>`));
    expect(item.images).toEqual([feed('https://thecurrency.news/wp-content/uploads/x.jpg', 1500)]);
  });

  it('Gript (WordPress): no image at all in the feed', async () => {
    const [item] = await parseFeed('gript', rss(`<item><title>S</title><link>https://gript.ie/x/</link>
      <pubDate>Tue, 22 Sep 2026 16:55:17 +0000</pubDate><description><![CDATA[<p>Cheaper migrant labour</p>]]></description></item>`));
    expect(item.images).toEqual([]);
    expect(item.snippet).toContain('Cheaper migrant labour');
  });

  it('ignores non-image enclosures (podcast audio)', async () => {
    const [item] = await parseFeed('newstalk', rss(`<item><title>S</title><link>https://www.newstalk.com/a</link>
      <pubDate>Thu, 24 Sep 2026 16:55:53 +0100</pubDate><enclosure url="https://x.ie/a.mp3" type="audio/mpeg" length="1"/></item>`));
    expect(item.images).toEqual([]);
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
      images: [feed('https://www.irishexaminer.com/cms_media/img.jpg', null)],
    });
    expect(new Date(item.published!).toISOString()).toBe('2026-09-22T19:37:00.000Z');
  });
});
