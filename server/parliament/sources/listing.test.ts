/**
 * The two pages are recorded from the live site (2026-11-18), cut to the block that links the
 * PDFs. The challenge page is what the publications search sent every script that day.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDailInterestsRegister } from './interests';
import { DISCLOSURE_PAGES, disclosureLinks, isHumanVerification, oireachtasFetch, parsePublicationLinks } from './listing';
import { isDailPsa, psaMonthFromUrl } from './psa';
import { USER_AGENT } from './wikidata';

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, '..', '__fixtures__', 'sources', name), 'utf8');
const INTERESTS_PAGE = fixture('oireachtas-register-of-members-interests-2026-11-18.html');
const ALLOWANCES_PAGE = fixture('oireachtas-salaries-and-allowances-2026-11-18.html');
const CHALLENGE = fixture('oireachtas-human-verification-2026-11-18.html');

const RMI = 'https://data.oireachtas.ie/ie/oireachtas/members/registerOfMembersInterests';
const PSA = 'https://data.oireachtas.ie/ie/oireachtas/members/parliamentaryAllowances/psa/2026';
const page = (html: string, status = 200) => async () => new Response(html, { status });

describe('parsePublicationLinks', () => {
  it('reads every register on the Register of Members\' Interests page', () => {
    const links = parsePublicationLinks(INTERESTS_PAGE, DISCLOSURE_PAGES.interests);
    expect(links.filter(isDailInterestsRegister)).toEqual([
      `${RMI}/dail/2026/2026-02-25_register-of-member-s-interests-dail-eireann-2025_en.pdf`,
      `${RMI}/dail/2025/2025-06-18_register-of-member-s-interests-dail-eireann-2022-2024_en.pdf`,
    ]);
    // The Seanad's register and the Dáil supplements are linked too; the filter drops them.
    expect(links).toContain(`${RMI}/seanad/2026/2026-03-10_register-of-member-s-interests-seanad-eireann-2025_en.pdf`);
    expect(links).toContain(`${RMI}/dail/2026/2026-02-13_supplement-to-register-of-members-interests-2024-dail_en.pdf`);
  });

  it('reads the recent PSA files on the Salaries and Allowances page, Deputies\' and Senators\'', () => {
    const links = parsePublicationLinks(ALLOWANCES_PAGE, DISCLOSURE_PAGES.allowances);
    expect(links).toHaveLength(5);
    expect(links.filter(isDailPsa).map(psaMonthFromUrl)).toEqual(['2026-08-01', '2026-07-01']);
    expect(links.filter(isDailPsa)[0]).toBe(`${PSA}/2026-10-07_parliamentary-standard-allowance-payments-to-deputies-for-august-2026_en.pdf`);
  });

  it('keeps only data.oireachtas.ie PDFs, once each, as absolute URLs', () => {
    const html = `
      <a href="https://data.oireachtas.ie/a/x.pdf">x</a><a href="https://data.oireachtas.ie/a/x.pdf">again</a>
      <a href="//data.oireachtas.ie/a/y.PDF">protocol-relative</a>
      <a href="https://www.oireachtas.ie/en/some-page.pdf">not data.oireachtas.ie</a>
      <a href="https://data.oireachtas.ie/a/z.xlsx">not a PDF</a><a href="/en/publications/?topic%5B0%5D=x">listing</a>`;
    expect(parsePublicationLinks(html, DISCLOSURE_PAGES.allowances)).toEqual(['https://data.oireachtas.ie/a/x.pdf', 'https://data.oireachtas.ie/a/y.PDF']);
    expect(parsePublicationLinks('<a href="/en/">home</a>', DISCLOSURE_PAGES.allowances)).toEqual([]);
  });
});

describe('isHumanVerification', () => {
  it('knows the challenge by its status or its title, and not a real page', () => {
    expect(isHumanVerification(405, CHALLENGE)).toBe(true);
    expect(isHumanVerification(200, CHALLENGE)).toBe(true);
    expect(isHumanVerification(405, '')).toBe(true);
    expect(isHumanVerification(200, ALLOWANCES_PAGE)).toBe(false);
    expect(isHumanVerification(503, '')).toBe(false);
  });
});

describe('disclosureLinks', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads each feed\'s own page', async () => {
    const asked: string[] = [];
    const fetcher = async (url: string) => {
      asked.push(url);
      return new Response(url === DISCLOSURE_PAGES.interests ? INTERESTS_PAGE : ALLOWANCES_PAGE);
    };
    expect((await disclosureLinks('interests', fetcher)).filter(isDailInterestsRegister)).toHaveLength(2);
    expect((await disclosureLinks('allowances', fetcher)).filter(isDailPsa)).toHaveLength(2);
    expect(asked).toEqual([DISCLOSURE_PAGES.interests, DISCLOSURE_PAGES.allowances]);
    // Neither page is the publications search, which robots.txt disallows (`Disallow: /*?`).
    for (const url of Object.values(DISCLOSURE_PAGES)) expect(url).not.toMatch(/\?|\/publications\//);
  });

  it('names the challenge when the site sends it, and never returns it as "no links"', async () => {
    await expect(disclosureLinks('allowances', page(CHALLENGE, 405))).rejects.toThrow(/Human Verification challenge \(HTTP 405\)/);
  });

  it('throws on an HTTP error rather than returning no links', async () => {
    await expect(disclosureLinks('interests', page('', 503))).rejects.toThrow(/503/);
  });

  it('says who it is: our own User-Agent, not a browser\'s, and nothing personal', async () => {
    const fetchMock = vi.fn(async () => new Response(ALLOWANCES_PAGE, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await disclosureLinks('allowances');
    await oireachtasFetch(`${PSA}/x.pdf`);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls as unknown as Array<[string, RequestInit]>) {
      const headers = call[1].headers as Record<string, string>;
      expect(Object.keys(headers)).toEqual(['User-Agent']);
      expect(headers['User-Agent']).toBe(USER_AGENT);
      expect(headers['User-Agent']).not.toMatch(/Mozilla|Chrome|Safari|@/);
    }
  });
});
