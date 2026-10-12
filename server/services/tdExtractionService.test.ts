import { beforeEach, describe, expect, it, vi } from 'vitest';

const active = vi.hoisted(() => ({ tds: [] as Array<{ id: number; name: string; party: string | null; constituency: string | null; offices: Array<{ title: string; since: string | null }> | null }> }));
vi.mock('../scoring/repository', () => ({ listActive: async () => active.tds.map((td) => ({ td, score: null, stats: null })) }));

const { extractTDMentions, isSubstantialMention, reloadTDs } = await import('./tdExtractionService');

const td = (id: number, name: string, offices: string[] = [], constituency: string | null = 'Dublin Central') => ({
  id,
  name,
  party: 'Party',
  constituency,
  offices: offices.map((title) => ({ title, since: '2025-01-23' })),
});

const names = async (text: string) => (await extractTDMentions(text)).map((m) => m.name);

describe('extractTDMentions', () => {
  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    active.tds = [
      td(1, 'Mark Ward'),
      td(2, 'Micheál Martin', ['Taoiseach']),
      td(3, 'Simon Harris', ['Tánaiste', 'Minister for Finance']),
      td(4, 'Catherine Murphy', [], ''),
      td(5, 'Cian Murphy'),
      td(6, 'Mary Lou McDonald'),
    ];
    await reloadTDs();
  });

  it('matches whole words only: a name inside a longer word is no mention', async () => {
    expect(await names('A new Mark Wardrobe range launched today.')).toEqual([]);
    expect(await names("Mark Ward's motion was defeated.")).toEqual(['Mark Ward']);
    expect(await names('MARK WARD spoke first.')).toEqual(['Mark Ward']);
  });

  it('carries the TD row, so the pipeline needs no lookup, and names each TD once', async () => {
    const [mention, ...rest] = await extractTDMentions('Mary Lou McDonald said… later Mary Lou McDonald added…');
    expect(rest).toEqual([]);
    expect(mention).toMatchObject({ name: 'Mary Lou McDonald', td: { id: 6, party: 'Party' } });
  });

  it('a form two TDs share names neither; a form only one TD has names them', async () => {
    // "C. Murphy" could be Catherine or Cian.
    expect(await names('C. Murphy raised the matter.')).toEqual([]);
    expect(await names('Cian Murphy raised the matter.')).toEqual(['Cian Murphy']);
    expect(await names('M. Ward raised the matter.')).toEqual(['Mark Ward']);
  });

  it('finds the Taoiseach and the Tánaiste from the offices the roster stores, not from names in code', async () => {
    expect(await names('The Tánaiste said the budget would pass.')).toEqual(['Simon Harris']);
    // After a reshuffle the stored offices move, and so does the match.
    active.tds = [td(2, 'Micheál Martin'), td(3, 'Simon Harris'), td(7, 'Helen McEntee', ['Tánaiste'])];
    await reloadTDs();
    expect(await names('The Tánaiste said the budget would pass.')).toEqual(['Helen McEntee']);
    // An office nobody holds names nobody.
    expect(await names('The Taoiseach was abroad.')).toEqual([]);
  });

  it('a TD named and titled is one mention', async () => {
    expect(await names('Taoiseach Micheál Martin said…')).toEqual(['Micheál Martin']);
  });
});

describe('isSubstantialMention', () => {
  it('the full name, or a title with the surname or first name, as whole words', () => {
    expect(isSubstantialMention('Mark Ward told the Dáil', 'Mark Ward')).toBe(true);
    expect(isSubstantialMention('Deputy Ward told the Dáil', 'Mark Ward')).toBe(true);
    expect(isSubstantialMention('Minister Mark was asked', 'Mark Ward')).toBe(true);
    expect(isSubstantialMention('Mr Wardrobe and Deputy Wardell spoke', 'Mark Ward')).toBe(false);
    expect(isSubstantialMention('Nothing about him', 'Mark Ward')).toBe(false);
  });
});
