import { describe, expect, it, vi } from 'vitest';
import { ARTICLE_CONTENT_LIMIT, extractStances, extractionText, parseExtraction, type CandidateTd } from './extract';
import { verifyStances } from './verify';

const CANDIDATES: CandidateTd[] = [{ id: 7, name: 'Ruairí Ó Murchú', party: 'Sinn Féin', offices: [] }];
const ARTICLE = {
  title: 'Housing row',
  content: 'Ruairí Ó Murchú said the State must build more social homes on public land without delay.',
};
const GOOD = { td_id: 7, policy_domain: 'Housing', quote: 'the State must build more social homes on public land', quote_kind: 'paraphrase' };

describe('parseExtraction', () => {
  it('returns null for a reply that is not { stances: [...] }', () => {
    expect(parseExtraction(null)).toBeNull();
    expect(parseExtraction('{"stances": [')).toBeNull();
    expect(parseExtraction({})).toBeNull();
    expect(parseExtraction({ stances: 'none' })).toBeNull();
  });

  it('returns [] for an empty list', () => {
    expect(parseExtraction({ stances: [] })).toEqual([]);
  });

  it('keeps well-formed entries, lower-cases the domain, and drops entries of the wrong shape', () => {
    const parsed = parseExtraction({
      stances: [
        GOOD,
        { ...GOOD, td_id: '7' },
        { ...GOOD, td_id: 7.5 },
        { ...GOOD, quote_kind: 'opinion' },
        { ...GOOD, quote: undefined },
        'not an object',
      ],
    });
    expect(parsed).toEqual([{ tdId: 7, policyDomain: 'housing', quote: GOOD.quote, quoteKind: 'paraphrase' }]);
  });
});

describe('extractStances', () => {
  it('sends the candidates and the article text, and parses the reply', async () => {
    const complete = vi.fn(async () => ({ stances: [GOOD] }));
    const stances = await extractStances(ARTICLE, CANDIDATES, complete);
    expect(stances).toHaveLength(1);
    const prompt = (complete.mock.calls[0] as unknown[])[1] as string;
    expect(prompt).toContain('td_id 7: Ruairí Ó Murchú (Sinn Féin)');
    expect(prompt).toContain(extractionText(ARTICLE));
  });

  it('does not call the model when no TD is mentioned', async () => {
    const complete = vi.fn(async () => ({ stances: [GOOD] }));
    expect(await extractStances(ARTICLE, [], complete)).toEqual([]);
    expect(complete).not.toHaveBeenCalled();
  });

  it('returns null when the model gives nothing usable', async () => {
    expect(await extractStances(ARTICLE, CANDIDATES, async () => null)).toBeNull();
  });

  it('an unknown td_id from the model never survives verification', async () => {
    const stances = await extractStances(ARTICLE, CANDIDATES, async () => ({ stances: [{ ...GOOD, td_id: 99 }] }));
    const result = verifyStances(extractionText(ARTICLE), CANDIDATES, stances!);
    expect(result.accepted).toEqual([]);
    expect(result.rejected.invalid).toBe(1);
  });
});

describe('extractionText', () => {
  it('caps the content at the limit', () => {
    const text = extractionText({ title: 'T', content: 'a'.repeat(ARTICLE_CONTENT_LIMIT + 50) });
    expect(text).toBe(`T\n\n${'a'.repeat(ARTICLE_CONTENT_LIMIT)}`);
  });
});
