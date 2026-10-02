import { describe, expect, it } from 'vitest';
import { REVISION_MIN_AGE_HOURS, findRevision, revisionHtml, revisionUrl } from './wikipedia';

const NOW = new Date('2026-10-02T12:00:00Z');
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('findRevision', () => {
  it(`asks for the newest revision at least ${REVISION_MIN_AGE_HOURS} hours old, following redirects`, async () => {
    let asked = '';
    const found = await findRevision('Old Title', NOW, async (url) => {
      asked = url;
      return reply({ query: { pages: [{ title: 'New Title', revisions: [{ revid: 1364814524 }], pageprops: {} }] } });
    });
    expect(found).toEqual({ title: 'New Title', revisionId: 1364814524 });
    const params = new URL(asked).searchParams;
    expect(params.get('rvstart')).toBe('2026-09-29T12:00:00.000Z');
    expect(params.get('rvdir')).toBe('older');
    expect(params.get('redirects')).toBe('1');
  });

  it('reports a disambiguation page, a missing page, and a page with no old-enough revision', async () => {
    expect(await findRevision('X', NOW, async () => reply({ query: { pages: [{ title: 'X', pageprops: { disambiguation: '' }, revisions: [{ revid: 1 }] }] } }))).toBe('disambiguation');
    expect(await findRevision('X', NOW, async () => reply({ query: { pages: [{ title: 'X', missing: true }] } }))).toBe('missing');
    expect(await findRevision('X', NOW, async () => reply({ query: { pages: [{ title: 'X' }] } }))).toBe('missing');
  });

  it('throws on an HTTP or API error, so the run counts it as failed and writes nothing', async () => {
    await expect(findRevision('X', NOW, async () => reply({}, 503))).rejects.toThrow(/503/);
    await expect(revisionHtml(1, async () => reply({ error: { code: 'nosuchrevid', info: 'no' } }))).rejects.toThrow(/nosuchrevid/);
  });
});

describe('revisionHtml and revisionUrl', () => {
  it('parses exactly the given revision, and links to it, not the live page', async () => {
    let asked = '';
    const html = await revisionHtml(42, async (url) => {
      asked = url;
      return reply({ parse: { text: '<div class="mw-parser-output"><p>x</p></div>' } });
    });
    expect(html).toContain('<p>x</p>');
    expect(new URL(asked).searchParams.get('oldid')).toBe('42');
    expect(revisionUrl(42)).toBe('https://en.wikipedia.org/w/index.php?oldid=42');
  });
});
