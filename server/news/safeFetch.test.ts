import { describe, expect, it, vi } from 'vitest';
import { MAX_REDIRECTS, UnsafeUrlError, isPublicAddress, readTextCapped, safeFetch, type Lookup } from './safeFetch';

const PUBLIC = '93.184.216.34';

/** A DNS stand-in: names resolve as listed, anything else resolves to a public address. */
const dnsFor =
  (table: Record<string, string[]>): Lookup =>
  async (host) =>
    table[host] ?? [PUBLIC];

const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

describe('isPublicAddress', () => {
  it.each([
    '8.8.8.8',
    '93.184.216.34',
    '172.15.255.255',
    '172.32.0.1',
    '100.63.255.255',
    '2606:4700:4700::1111',
    '::ffff:8.8.8.8',
  ])('accepts %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '198.19.0.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '::ffff:169.254.169.254',
    'not an address',
  ])('refuses %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
});

describe('safeFetch', () => {
  it('fetches a public host once, with redirects handled by hand', async () => {
    const fetchImpl = vi.fn(async () => new Response('ok'));
    const res = await safeFetch('https://example.ie/a', { headers: { 'User-Agent': 'x' } }, { lookup: dnsFor({}), fetchImpl });
    expect(await res.text()).toBe('ok');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(new URL('https://example.ie/a'), { headers: { 'User-Agent': 'x' }, redirect: 'manual' });
  });

  it('refuses a name that resolves to a private address, and a name with ANY private address, without fetching', async () => {
    const fetchImpl = vi.fn(async () => new Response('secret'));
    const lookup = dnsFor({ 'internal.example': ['10.0.0.5'], 'mixed.example': [PUBLIC, '127.0.0.1'], 'meta.example': ['169.254.169.254'] });
    for (const host of ['internal.example', 'mixed.example', 'meta.example']) {
      await expect(safeFetch(`https://${host}/`, {}, { lookup, fetchImpl }), host).rejects.toThrow(UnsafeUrlError);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses literal private addresses, including IPv6 and IPv4-mapped forms, without resolving them', async () => {
    const fetchImpl = vi.fn(async () => new Response('secret'));
    const lookup = vi.fn(dnsFor({}));
    for (const url of ['http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/', 'http://[::ffff:10.0.0.1]/', 'http://192.168.0.1:8080/']) {
      await expect(safeFetch(url, {}, { lookup, fetchImpl }), url).rejects.toThrow(UnsafeUrlError);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('refuses a host that does not resolve at all, and any scheme but http(s)', async () => {
    const fetchImpl = vi.fn(async () => new Response('x'));
    await expect(safeFetch('https://nowhere.example/', {}, { lookup: async () => [], fetchImpl })).rejects.toThrow(UnsafeUrlError);
    for (const url of ['file:///etc/passwd', 'ftp://example.ie/a', 'data:text/html,hi']) {
      await expect(safeFetch(url, {}, { lookup: dnsFor({}), fetchImpl }), url).rejects.toThrow(UnsafeUrlError);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('follows a redirect to another public host, resolving a relative Location against the current URL', async () => {
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (url: URL | string) => {
      seen.push(String(url));
      if (seen.length === 1) return redirect('https://www.example.ie/moved');
      if (seen.length === 2) return redirect('/final');
      return new Response('landed');
    });
    const res = await safeFetch('http://example.ie/start', {}, { lookup: dnsFor({}), fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(await res.text()).toBe('landed');
    expect(seen).toEqual(['http://example.ie/start', 'https://www.example.ie/moved', 'https://www.example.ie/final']);
  });

  it('checks every hop: a public page that redirects to a private host is refused before that host is fetched', async () => {
    const fetchImpl = vi.fn(async () => redirect('http://metadata.internal/latest/meta-data'));
    const lookup = dnsFor({ 'metadata.internal': ['169.254.169.254'] });
    await expect(safeFetch('https://example.ie/a', {}, { lookup, fetchImpl })).rejects.toThrow(/not a public address/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const toLiteral = vi.fn(async () => redirect('http://127.0.0.1:5000/api/admin'));
    await expect(safeFetch('https://example.ie/a', {}, { lookup: dnsFor({}), fetchImpl: toLiteral })).rejects.toThrow(UnsafeUrlError);
    expect(toLiteral).toHaveBeenCalledTimes(1);
  });

  it(`gives up after ${MAX_REDIRECTS} redirects`, async () => {
    const fetchImpl = vi.fn(async () => redirect('/again'));
    await expect(safeFetch('https://example.ie/a', {}, { lookup: dnsFor({}), fetchImpl })).rejects.toThrow(/redirects/);
    expect(fetchImpl).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
  });

  it('returns a redirect that has no Location, and a 304, to the caller as they are', async () => {
    const noLocation = vi.fn(async () => new Response(null, { status: 302 }));
    expect((await safeFetch('https://example.ie/a', {}, { lookup: dnsFor({}), fetchImpl: noLocation })).status).toBe(302);
    const notModified = vi.fn(async () => new Response(null, { status: 304, headers: { location: '/x' } }));
    expect((await safeFetch('https://example.ie/a', {}, { lookup: dnsFor({}), fetchImpl: notModified })).status).toBe(304);
  });
});

/** A response whose body is `chunks`, recording how many were pulled and whether it was cancelled. */
function streamed(chunks: Uint8Array[]) {
  const state = { pulled: 0, cancelled: false };
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (state.pulled >= chunks.length) return controller.close();
      controller.enqueue(chunks[state.pulled++]);
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { res: new Response(body), state };
}

describe('readTextCapped', () => {
  const bytes = (text: string) => new TextEncoder().encode(text);

  it('returns the whole body when it fits', async () => {
    const { res } = streamed([bytes('<html>'), bytes('Máire</html>')]);
    expect(await readTextCapped(res, 1000)).toBe('<html>Máire</html>');
  });

  it('cuts the body at the cap and stops reading the stream', async () => {
    const { res, state } = streamed(Array.from({ length: 50 }, () => bytes('x'.repeat(100))));
    const text = await readTextCapped(res, 250);
    expect(text).toBe('x'.repeat(250));
    expect(state.cancelled).toBe(true);
    expect(state.pulled).toBeLessThan(50);
  });

  it('is exact at the cap, and an empty body is an empty string', async () => {
    expect(await readTextCapped(streamed([bytes('abcd')]).res, 4)).toBe('abcd');
    expect(await readTextCapped(streamed([]).res, 4)).toBe('');
    expect(await readTextCapped(new Response(null), 4)).toBe('');
  });
});
