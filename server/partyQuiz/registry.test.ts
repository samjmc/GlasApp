import { describe, expect, it } from 'vitest';
import { PARTY_NAMES } from '@/lib/parties';
import { partyKey } from '../ideology/partyBaselines';
import { REGISTRY, documentsFor } from './registry';

const https = (url: string | null) => url === null || url.startsWith('https://');

describe('the manifesto registry', () => {
  it('has unique slugs', () => {
    expect(REGISTRY.length).toBeGreaterThan(0);
    expect(new Set(REGISTRY.map((d) => d.slug)).size).toBe(REGISTRY.length);
  });

  it('labels every document with a tds.party label, compared by partyKey', () => {
    const keys = new Set(PARTY_NAMES.map(partyKey));
    for (const d of REGISTRY) expect(keys.has(partyKey(d.party)), `${d.slug}: ${d.party}`).toBe(true);
  });

  it('links only over https', () => {
    for (const d of REGISTRY) {
      expect(https(d.url), d.slug).toBe(true);
      expect(https(d.mirrorUrl), d.slug).toBe(true);
    }
  });

  it('records a hash only as 64 hex, and only with the word count and url that go with it', () => {
    for (const d of REGISTRY) {
      if (d.sha256 === null) continue;
      expect(d.sha256, d.slug).toMatch(/^[0-9a-f]{64}$/);
      expect(d.wordCount, d.slug).toBeGreaterThan(0);
      expect(d.url, d.slug).not.toBeNull();
    }
  });

  it('finds a party\'s documents by partyKey, whatever the dash', () => {
    const pbp = documentsFor('People Before Profit–Solidarity').map((d) => d.slug);
    expect(pbp).toEqual(documentsFor('People Before Profit-Solidarity').map((d) => d.slug));
    expect(pbp.length).toBe(2);
    expect(documentsFor('Some New Party')).toEqual([]);
  });
});
