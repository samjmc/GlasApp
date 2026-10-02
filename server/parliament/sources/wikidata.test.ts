import { describe, expect, it } from 'vitest';
import { fetchGenders, genderQuery, parseGenders } from './wikidata';

const entity = (q: string) => ({ value: `http://www.wikidata.org/entity/${q}` });

describe('parseGenders', () => {
  it('maps female, male and non-binary by their Wikidata items', () => {
    const map = parseGenders({
      results: {
        bindings: [
          { id: { value: 'Mary-Lou-McDonald.D.2011-03-09' }, sex: entity('Q6581072') },
          { id: { value: 'Simon-Harris.D.2011-03-09' }, sex: entity('Q6581097') },
          { id: { value: 'X.D.2024-11-29' }, sex: entity('Q48270') },
        ],
      },
    });
    expect(Object.fromEntries(map)).toEqual({ 'Mary-Lou-McDonald.D.2011-03-09': 'female', 'Simon-Harris.D.2011-03-09': 'male', 'X.D.2024-11-29': 'non-binary' });
  });

  it('leaves out a member with conflicting values or a value it does not know', () => {
    const map = parseGenders({
      results: {
        bindings: [
          { id: { value: 'A.D.1' }, sex: entity('Q6581072') },
          { id: { value: 'A.D.1' }, sex: entity('Q6581097') },
          { id: { value: 'B.D.1' }, sex: entity('Q999999') },
          { id: { value: 'C.D.1' }, sex: entity('Q6581097') },
          { id: { value: 'C.D.1' }, sex: entity('Q6581097') },
        ],
      },
    });
    expect(Object.fromEntries(map)).toEqual({ 'C.D.1': 'male' });
  });

  it('is empty, not an error, for an empty result', () => {
    expect(parseGenders({}).size).toBe(0);
  });
});

describe('fetchGenders', () => {
  it('asks only for the given member codes, with no personal details in the request', async () => {
    let seen: { url: string; init?: RequestInit } | undefined;
    const map = await fetchGenders(['A.D.1'], async (url, init) => {
      seen = { url, init };
      return new Response(JSON.stringify({ results: { bindings: [{ id: { value: 'A.D.1' }, sex: entity('Q6581072') }] } }), { status: 200 });
    });
    expect(map.get('A.D.1')).toBe('female');
    const headers = seen?.init?.headers as Record<string, string>;
    expect(headers['User-Agent']).not.toMatch(/@/);
    expect(String(seen?.init?.body)).toContain(encodeURIComponent('"A.D.1"'));
    expect(genderQuery(['A.D.1', "O'Brien.D.2"])).toContain(`"O'Brien.D.2"`);
  });

  it('throws on an HTTP error, so the sync records a failed feed', async () => {
    await expect(fetchGenders(['A.D.1'], async () => new Response('', { status: 503 }))).rejects.toThrow(/503/);
  });
});
