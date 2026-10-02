/**
 * The listing is browser HTML. The markup below is copied from the real page
 * (oireachtas.ie/en/publications, 2026-09-25), cut to a few entries.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserFetch, parsePublicationLinks, publicationLinks } from './listing';

const DATA = 'https://data.oireachtas.ie/ie/oireachtas/members';
const HTML = `
<ul class="c-publications-list">
  <li><p><a class="file no-title" href="${DATA}/parliamentaryAllowances/psa/2026/2026-09-03_parliamentary-standard-allowance-payments-to-senators-for-july-2026_en.pdf" data-file-type="pdf">Payments to Senators for July 2026 (pdf)</a></p></li>
  <li><p><a class="file no-title" href="${DATA}/parliamentaryAllowances/psa/2026/2026-09-03_parliamentary-standard-allowance-payments-to-deputies-for-july-2026_en.pdf" data-file-type="pdf">Payments to Deputies for July 2026 (pdf)</a></p>
      <p class="c-publications-list__tags"><a href="/en/publications/?topic%5B%5D=parliamentary-allowances&amp;page=2">Parliamentary allowances</a></p></li>
  <li><p><a class="file no-title" href="${DATA}/parliamentaryAllowances/psa/2026/2026-09-03_parliamentary-standard-allowance-payments-to-deputies-for-july-2026_en.pdf">again</a></p></li>
  <li><p><a href="https://www.oireachtas.ie/en/some-page.pdf">not on data.oireachtas.ie</a></p></li>
  <li><p><a href="https://data.oireachtas.ie/ie/oireachtas/members/some-file.xlsx">not a PDF</a></p></li>
  <li><p><a href="//data.oireachtas.ie/ie/oireachtas/caighdeanOifigiul/2026/2026-01-16_parliamentary-standard-allowance-payments-to-deputies-for-november-2025_en.pdf">protocol-relative</a></p></li>
</ul>`;

describe('parsePublicationLinks', () => {
  it('returns each data.oireachtas.ie PDF once, in page order, as an absolute URL', () => {
    expect(parsePublicationLinks(HTML)).toEqual([
      `${DATA}/parliamentaryAllowances/psa/2026/2026-09-03_parliamentary-standard-allowance-payments-to-senators-for-july-2026_en.pdf`,
      `${DATA}/parliamentaryAllowances/psa/2026/2026-09-03_parliamentary-standard-allowance-payments-to-deputies-for-july-2026_en.pdf`,
      'https://data.oireachtas.ie/ie/oireachtas/caighdeanOifigiul/2026/2026-01-16_parliamentary-standard-allowance-payments-to-deputies-for-november-2025_en.pdf',
    ]);
  });

  it('returns nothing for a page with no PDF links', () => {
    expect(parsePublicationLinks('<html><body><a href="/en/">home</a></body></html>')).toEqual([]);
  });
});

describe('publicationLinks', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks for one page of a topic and parses it', async () => {
    const urls: string[] = [];
    const links = await publicationLinks('parliamentary-allowances', async (url) => {
      urls.push(url);
      return new Response(HTML, { status: 200 });
    }, 2);
    expect(links).toHaveLength(3);
    const qs = new URL(urls[0]).searchParams;
    expect([qs.get('topic[]'), qs.get('page'), qs.get('resultsPerPage')]).toEqual(['parliamentary-allowances', '2', '50']);
  });

  it('throws on an HTTP error rather than returning no links', async () => {
    await expect(publicationLinks('x', async () => new Response('', { status: 503 }))).rejects.toThrow(/503/);
  });

  it('sends a browser User-Agent by default, and nothing personal', async () => {
    const fetchMock = vi.fn(async () => new Response(HTML, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await publicationLinks('register-of-members-interests');
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const headers = init.headers as Record<string, string>;
    expect(Object.keys(headers)).toEqual(['User-Agent']);
    expect(headers['User-Agent']).toMatch(/^Mozilla\/5\.0 .* Chrome\/[\d.]+ Safari\/[\d.]+$/);
    expect(headers['User-Agent']).not.toMatch(/@/);
    expect(browserFetch).toBeTypeOf('function');
  });
});
