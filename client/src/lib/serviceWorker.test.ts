/**
 * client/public/sw.js, run for real in a sandbox with a fake cache. The page's API calls carry the
 * person's sign-in token; the worker's cache is shared by everyone who uses the browser and is never
 * cleared on sign-out or erasure, so a signed-in response must never be written to it.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const SOURCE = readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');

type Listener = (event: unknown) => void;

function loadWorker(network: (request: Request) => Promise<Response>) {
  const listeners: Record<string, Listener> = {};
  const stores = new Map<string, Map<string, Response>>();
  const written: string[] = [];
  const store = (name: string) => stores.get(name) ?? stores.set(name, new Map()).get(name)!;
  const caches = {
    open: async (name: string) => ({
      addAll: async () => {},
      put: async (request: Request, response: Response) => {
        written.push(`${name} ${request.url}`);
        store(name).set(request.url, response);
      },
    }),
    match: async (request: Request) => {
      for (const s of stores.values()) if (s.has(request.url)) return s.get(request.url)!.clone();
      return undefined;
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  const context = {
    self: {
      addEventListener: (type: string, listener: Listener) => (listeners[type] = listener),
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
    },
    location: { origin: 'http://localhost' },
    console: { log: () => {} },
    caches,
    fetch: vi.fn(network),
    Response,
    URL,
    Promise,
  };
  vm.runInNewContext(SOURCE, context);

  /** Dispatch a fetch event; returns what the worker answered with, or `undefined` when it did not respond. */
  async function request(url: string, headers: Record<string, string> = {}): Promise<Response | undefined> {
    const respondWith = vi.fn();
    listeners.fetch!({ request: new Request(url, { headers }), respondWith });
    if (respondWith.mock.calls.length === 0) return undefined;
    return (await respondWith.mock.calls[0]![0]) as Response;
  }
  return { request, written, stores, listeners, store };
}

const ok = (body: string) => async () => new Response(body, { status: 200 });

describe('the service worker and API responses', () => {
  it('does not answer or cache a request that carries a sign-in token', async () => {
    const worker = loadWorker(ok('{"success":true,"data":{"firstName":"Eva"}}'));
    expect(await worker.request('http://localhost/api/profile/me', { Authorization: 'Bearer secret' })).toBeUndefined();
    expect(await worker.request('http://localhost/api/quiz/me', { authorization: 'Bearer secret' })).toBeUndefined();
    expect(worker.written).toEqual([]);
  });

  it('still caches a public API response, and serves it when the network is down', async () => {
    let online = true;
    const worker = loadWorker(async () => {
      if (!online) throw new Error('offline');
      return new Response('{"parties":[]}', { status: 200 });
    });
    const live = await worker.request('http://localhost/api/ideology/party-answers?questions=1');
    expect(await live!.text()).toBe('{"parties":[]}');
    // The write happens after the response is returned; wait for it.
    await vi.waitFor(() => expect(worker.written).toEqual(['glas-politics-v2-data http://localhost/api/ideology/party-answers?questions=1']));

    online = false;
    const offline = await worker.request('http://localhost/api/ideology/party-answers?questions=1');
    expect(await offline!.text()).toBe('{"parties":[]}');
  });

  it('deletes the caches an older version left behind, the signed-in data cache included', async () => {
    const worker = loadWorker(ok('x'));
    for (const name of ['glas-politics-v1-data', 'glas-politics-v1-static', 'glas-politics-v2-data', 'unrelated-site-cache']) worker.store(name);
    let done: Promise<unknown> = Promise.resolve();
    worker.listeners.activate!({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    expect([...worker.stores.keys()].sort()).toEqual(['glas-politics-v2-data', 'unrelated-site-cache']);
  });
});
