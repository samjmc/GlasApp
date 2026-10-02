/**
 * Gender, which the Oireachtas API leaves empty for every member, from Wikidata: property
 * P4690 ("Oireachtas member ID") holds the API's own member code, so the join is exact.
 * Measured 2026-09-25: all 174 TDs of the 34th Dáil match, all 174 have P21 (sex or gender).
 */
export type Gender = 'female' | 'male' | 'non-binary';

/** Wikidata items for P21 values, mapped only where the meaning is exact. */
const GENDER_ITEMS: Record<string, Gender> = {
  'http://www.wikidata.org/entity/Q6581072': 'female',
  'http://www.wikidata.org/entity/Q6581097': 'male',
  'http://www.wikidata.org/entity/Q48270': 'non-binary',
};

const ENDPOINT = 'https://query.wikidata.org/sparql';
/** Wikidata asks for an identifying User-Agent. No personal contact details. */
const USER_AGENT = 'GlasPolitics/1.0 (https://github.com/samjmc/GlasApp)';

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

interface SparqlResult {
  results?: { bindings?: Array<{ id?: { value?: string }; sex?: { value?: string } }> };
}

export function genderQuery(memberCodes: string[]): string {
  const values = memberCodes.map((c) => JSON.stringify(c)).join(' ');
  return `SELECT ?id ?sex WHERE { VALUES ?id { ${values} } ?item wdt:P4690 ?id . ?item wdt:P21 ?sex . }`;
}

/**
 * member code → gender. A code with two different values, or a value outside GENDER_ITEMS,
 * is left out rather than guessed.
 */
export function parseGenders(body: SparqlResult): Map<string, Gender> {
  const seen = new Map<string, Gender | null>();
  for (const b of body.results?.bindings ?? []) {
    const code = b.id?.value;
    if (!code) continue;
    const gender = GENDER_ITEMS[b.sex?.value ?? ''] ?? null;
    seen.set(code, seen.has(code) && seen.get(code) !== gender ? null : gender);
  }
  const out = new Map<string, Gender>();
  seen.forEach((g, code) => {
    if (g) out.set(code, g);
  });
  return out;
}

export async function fetchGenders(memberCodes: string[], fetcher: Fetcher = fetch): Promise<Map<string, Gender>> {
  if (memberCodes.length === 0) return new Map();
  const res = await fetcher(ENDPOINT, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ query: genderQuery(memberCodes) }).toString(),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  return parseGenders((await res.json()) as SparqlResult);
}
