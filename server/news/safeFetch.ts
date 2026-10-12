/**
 * Fetching a page or image that a third-party feed names. The feed picks the URL, so it must not
 * be able to point the server at its own network, and one huge page must not fill its memory.
 *
 *   - Only http(s), and only hosts whose addresses are ALL public. Checked after DNS resolution,
 *     so a name that resolves to 10.x or 169.254.169.254 is refused too.
 *   - Redirects are followed by hand, at most MAX_REDIRECTS, and every hop is checked the same way.
 *   - A body is read as a stream and cut off at a byte cap.
 *
 * Limit: fetch() resolves the name again when it connects, so a DNS answer that changes between
 * the check and the connection is not caught.
 */
import { promises as dns } from 'node:dns';
import net from 'node:net';

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

async function assertPublicUrl(url: URL, lookup: Lookup): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UnsafeUrlError(`Refused ${url.protocol} URL`);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [host] : await lookup(host);
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) throw new UnsafeUrlError(`Refused ${host}: not a public address`);
}

export interface SafeFetchOptions {
  maxRedirects?: number;
  lookup?: Lookup;
  fetchImpl?: typeof fetch;
}

/**
 * fetch() for a URL taken from outside. Throws UnsafeUrlError for a non-public host, a non-http(s)
 * scheme or too many redirects. The caller owns the response body.
 */
export async function safeFetch(rawUrl: string, init: RequestInit = {}, options: SafeFetchOptions = {}): Promise<Response> {
  const { maxRedirects = MAX_REDIRECTS, lookup = resolveAll, fetchImpl = fetch } = options;
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
