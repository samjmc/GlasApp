import { describe, expect, it } from 'vitest';
import { fetchGenders, genderQuery, parseGenders, parseSitelinks, sitelinkQuery } from './wikidata';

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

describe('parseSitelinks', () => {
  const article = (path: string) => ({ value: `https://en.wikipedia.org/wiki/${path}` });

  it('maps each member code to its English Wikipedia title, decoded', () => {
    const map = parseSitelinks({
      results: {
        bindings: [
          { id: { value: 'A.D.1' }, article: article('William_Aird_(Fine_Gael_politician)') },
          { id: { value: 'B.D.1' }, article: article('Ciar%C3%A1n_Ahern') },
        ],
      },
    });
    expect(Object.fromEntries(map)).toEqual({ 'A.D.1': 'William Aird (Fine Gael politician)', 'B.D.1': 'Ciarán Ahern' });
  });

  it('leaves out a code with two different articles, and links that are not English Wikipedia', () => {
    const map = parseSitelinks({
      results: {
        bindings: [
          { id: { value: 'A.D.1' }, article: article('One') },
          { id: { value: 'A.D.1' }, article: article('Two') },
          { id: { value: 'B.D.1' }, article: { value: 'https://ga.wikipedia.org/wiki/Duine' } },
          { id: { value: 'C.D.1' }, article: article('Same') },
          { id: { value: 'C.D.1' }, article: article('Same') },
        ],
      },
    });
    expect(Object.fromEntries(map)).toEqual({ 'C.D.1': 'Same' });
  });

  it('joins on P4690 and asks only for English Wikipedia', () => {
    const q = sitelinkQuery(['A.D.1']);
    expect(q).toContain('wdt:P4690');
    expect(q).toContain('<https://en.wikipedia.org/>');
    expect(q).toContain('"A.D.1"');
  });
});