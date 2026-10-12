/**
 * The constituency map shows "Could not load the map" with a "Try again" button when the boundary
 * download fails. The helper used to hide every failure behind a made-up one-polygon map (and a
 * third-party URL), and the map cached that fake result, so the error never showed and a retry
 * could not recover. It must reject, and a failure must not be cached.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DATA: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: { CONSTITUENCY: 'Kerry' }, geometry: { type: 'Point', coordinates: [0, 0] } }],
};

const ok = () => ({ ok: true, json: async () => DATA });
const notFound = () => ({ ok: false, json: async () => ({}) });

let fetchConstituencyBoundaries: () => Promise<GeoJSON.FeatureCollection>;

beforeEach(async () => {
  // The helper keeps a module-level cache; each test starts from a fresh module.
  vi.resetModules();
  ({ fetchConstituencyBoundaries } = await import('./fetchConstituencyGeoJSON'));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchConstituencyBoundaries', () => {
  it('rejects when every source fails, and only ever asks our own server', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchConstituencyBoundaries()).rejects.toThrow('could not be downloaded');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url] of fetchMock.mock.calls) expect(url).toMatch(/^\/assets\//);
  });

  it('rejects on HTTP errors too, not only on network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(notFound()));
    await expect(fetchConstituencyBoundaries()).rejects.toThrow();
  });

  it('falls back to the backup file when the main file fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(notFound()).mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchConstituencyBoundaries()).resolves.toEqual(DATA);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failure, so a retry fetches again and then caches the real data', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchConstituencyBoundaries()).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(ok());
    await expect(fetchConstituencyBoundaries()).resolves.toEqual(DATA);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(fetchConstituencyBoundaries()).resolves.toEqual(DATA);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
