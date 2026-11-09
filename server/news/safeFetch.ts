/**
 * Fetching a page or image that a third-party feed names. The feed picks the URL, so it must not
 * be able to point the server at its own network, and one huge page must not fill its memory.
 *
 *   - Only http(s), and only hosts whose addresses are ALL public. Checked after DNS resolution,
 *     so a name that resolves to 10.x or 169.254.169.254 is refused too.
 *   - The connection is made through a dispatcher whose DNS lookup runs the same check and hands
 *     the socket only the addresses it checked. A name that answers public to the first check and
 *     private when the socket connects (DNS rebinding) is refused at connect time. TLS still uses
 *     the host name (SNI and certificate), because only the lookup changes, not the URL.
 *   - Redirects are followed by hand, at most MAX_REDIRECTS, and every hop is checked the same way.
 *   - A body is read as a stream and cut off at a byte cap.
 */
import { promises as dns, type LookupAddress } from 'node:dns';
import net from 'node:net';
import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici';

export const MAX_REDIRECTS = 5;
export const MAX_PAGE_BYTES = 3 * 1024 * 1024;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export class UnsafeUrlError extends Error {}

const BLOCKED = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, including cloud metadata at 169.254.169.254
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, and the broadcast address
] as const) {
  BLOCKED.addSubnet(address, prefix, 'ipv4');
}
for (const [address, prefix] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
] as const) {
  BLOCKED.addSubnet(address, prefix, 'ipv6');
}

/** True when the address is neither private, loopback, link-local nor otherwise non-public. IPv4-mapped IPv6 is checked as the IPv4 it wraps. */
export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 0) return false;
  return !BLOCKED.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

/** Every address a host name resolves to. */
export type Lookup = (hostname: string) => Promise<string[]>;

const resolveAll: Lookup = async (hostname) => (await dns.lookup(hostname, { all: true, verbatim: true })).map((a) => a.address);

/** The host's addresses, all public, or UnsafeUrlError. */
async function publicAddresses(host: string, lookup: Lookup): Promise<string[]> {
  const addresses = net.isIP(host) ? [host] : await lookup(host);
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) throw new UnsafeUrlError(`Refused ${host}: not a public address`);
  return addresses;
}

async function assertPublicUrl(url: URL, lookup: Lookup): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UnsafeUrlError(`Refused ${url.protocol} URL`);
  await publicAddresses(url.hostname.replace(/^\[|\]$/g, ''), lookup);
}

type LookupCallback = (err: Error | null, address: string | LookupAddress[], family?: number) => void;

/**
 * A `lookup` for net/tls.connect that resolves, refuses unless every address is public, and gives
 * the socket only those checked addresses. Answers both call forms: `all: true` (Node's default,
 * for happy eyeballs) and a single address.
 */
export function checkedLookup(lookup: Lookup) {
  return (hostname: string, options: { family?: number | string; all?: boolean }, callback: LookupCallback): void => {
    publicAddresses(hostname, lookup).then(
      (addresses) => {
        const family = options.family === 'IPv4' ? 4 : options.family === 'IPv6' ? 6 : Number(options.family) || 0;
        const entries = addresses.map((address) => ({ address, family: net.isIP(address) })).filter((a) => !family || a.family === family);
        if (entries.length === 0) return callback(new UnsafeUrlError(`Refused ${hostname}: no IPv${family} address`), '');
        if (options.all) return callback(null, entries);
        callback(null, entries[0]!.address, entries[0]!.family);
      },
      (err: Error) => callback(err, ''),
    );
  };
}

const pinned = (lookup: Lookup) => new Agent({ connect: { lookup: checkedLookup(lookup) } });
const defaultDispatcher = pinned(resolveAll);

/** fetch() that connects only to addresses `lookup` gave and the check passed. */
function pinnedFetch(lookup: Lookup): typeof fetch {
  const dispatcher = lookup === resolveAll ? defaultDispatcher : pinned(lookup);
  return async (input, init) => {
    try {
      return (await undiciFetch(input as URL, { ...(init as UndiciRequestInit), dispatcher })) as unknown as Response;
    } catch (err) {
      // fetch() wraps a connect error as TypeError('fetch failed', { cause }); surface the refusal itself.
      if (err instanceof Error && err.cause instanceof UnsafeUrlError) throw err.cause;
      throw err;
    }
  };
}

export interface SafeFetchOptions {
  maxRedirects?: number;
  lookup?: Lookup;
  /** Tests only: replaces the pinned connection, so it skips the connect-time check. */
  fetchImpl?: typeof fetch;
}

/**
 * fetch() for a URL taken from outside. Throws UnsafeUrlError for a non-public host, a non-http(s)
 * scheme or too many redirects. The caller owns the response body.
 */
export async function safeFetch(rawUrl: string, init: RequestInit = {}, options: SafeFetchOptions = {}): Promise<Response> {
  const { maxRedirects = MAX_REDIRECTS, lookup = resolveAll } = options;
  const fetchImpl = options.fetchImpl ?? pinnedFetch(lookup);
  let url = new URL(rawUrl);
  for (let hop = 0; ; hop++) {
    await assertPublicUrl(url, lookup);
    const res = await fetchImpl(url, { ...init, redirect: 'manual' });
    const location = REDIRECT_STATUSES.has(res.status) ? res.headers.get('location') : null;
    if (!location) return res;
    await res.body?.cancel();
    if (hop >= maxRedirects) throw new UnsafeUrlError(`More than ${maxRedirects} redirects`);
    url = new URL(location, url);
  }
}

/** The body as text, cut off at maxBytes: the rest of the stream is never read. */
export async function readTextCapped(res: Response, maxBytes = MAX_PAGE_BYTES): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = maxBytes - received;
    chunks.push(value.length > room ? value.subarray(0, room) : value);
    received += Math.min(value.length, room);
  }
  await reader.cancel();
  return new TextDecoder().decode(Buffer.concat(chunks));
}
