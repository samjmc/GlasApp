/**
 * apiCall is the one way the client calls its API. Its errors must carry the server's status and
 * code (callers branch on them, never on English text) and a message fit to show a person (never
 * `500: {"success":false,...}`). Every call carries the token and the region the visitor picked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } },
}));

const storage = new Map<string, string>();
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
  },
});

const { ApiError, apiCall, apiEnvelope, orNullOn404, toApiError, userMessage } = await import('./api');

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  storage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

describe('toApiError', () => {
  it('reads the standard envelope', () => {
    const error = toApiError(409, { success: false, error: { code: 'CONFLICT', message: 'That session has ended' } });
    expect(error).toBeInstanceOf(ApiError);
    expect([error.status, error.code, error.message]).toEqual([409, 'CONFLICT', 'That session has ended']);
  });

  it("reads the rate limiter's { message } shape", () => {
    const error = toApiError(429, { success: false, message: 'Too many requests. Please try again later.' });
    expect([error.status, error.code, error.message]).toEqual([429, 'HTTP_429', 'Too many requests. Please try again later.']);
  });

  it('never shows raw response text', () => {
    const error = toApiError(502, null);
    expect(error.code).toBe('HTTP_502');
    expect(error.message).toBe('Something went wrong. Please try again.');
  });
});

describe('apiCall', () => {
  it('unwraps data and sends the token, the region and a JSON body', async () => {
    storage.set('glas.region', 'IE');
    fetchMock.mockResolvedValue(json(200, { success: true, data: { ok: 1 } }));
    expect(await apiCall('POST', '/api/x', { a: 1 })).toEqual({ ok: 1 });
    const [path, init] = fetchMock.mock.calls[0]!;
    expect(path).toBe('/api/x');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok', 'x-region-code': 'IE' });
    expect(init.body).toBe('{"a":1}');
    expect(init.credentials).toBe('include');
  });

  it('sends no region header before the visitor picks one', async () => {
    fetchMock.mockResolvedValue(json(200, { success: true, data: null }));
    await apiCall('GET', '/api/x');
    expect(fetchMock.mock.calls[0]![1].headers).not.toHaveProperty('x-region-code');
  });

  it('passes a form through untouched, so the browser sets the multipart boundary', async () => {
    fetchMock.mockResolvedValue(json(200, { success: true, data: null }));
    const form = new FormData();
    await apiCall('POST', '/api/upload', form);
    const init = fetchMock.mock.calls[0]![1];
    expect(init.body).toBe(form);
    expect(init.headers).not.toHaveProperty('Content-Type');
  });

  it('throws an ApiError with the status and code', async () => {
    fetchMock.mockResolvedValue(json(404, { success: false, error: { code: 'NOT_FOUND', message: 'TD not found' } }));
    await expect(apiCall('GET', '/api/x')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'TD not found' });
  });

  it('turns a network failure (any browser wording) into status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Load failed'));
    await expect(apiCall('GET', '/api/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('rejects a 200 that is not a success envelope', async () => {
    fetchMock.mockResolvedValue(new Response('<html></html>', { status: 200 }));
    await expect(apiCall('GET', '/api/x')).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('apiEnvelope keeps meta', async () => {
    fetchMock.mockResolvedValue(json(200, { success: true, data: [1], meta: { hasProfile: false } }));
    expect(await apiEnvelope('GET', '/api/x')).toEqual({ data: [1], meta: { hasProfile: false } });
  });
});

describe('userMessage', () => {
  it("shows the server's message for an API failure and a generic one for anything else", () => {
    expect(userMessage(new ApiError(404, 'NOT_FOUND', 'TD not found'))).toBe('TD not found');
    expect(userMessage(new Error('500: {"success":false}'))).toBe('Something went wrong. Please try again.');
  });
});

describe('orNullOn404', () => {
  it('maps only a 404 to null', async () => {
    expect(await orNullOn404(Promise.reject(new ApiError(404, 'NOT_FOUND', 'x')))).toBeNull();
    await expect(orNullOn404(Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')))).rejects.toMatchObject({ status: 500 });
  });
});
