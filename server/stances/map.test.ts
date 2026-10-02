import { describe, expect, it, vi } from 'vitest';
import { mapStances, parseMapping } from './map';

const KEYS = ['option_a', 'option_b', 'option_c'];
const QUESTION = {
  question: 'A housing fund must prioritise one approach. Which?',
  options: [
    { key: 'option_a', label: 'Public building' },
    { key: 'option_b', label: 'Cost-rental partnerships' },
    { key: 'option_c', label: 'Buyer grants' },
  ],
};

describe('parseMapping', () => {
  it('returns one key or null per quote, in quote order', () => {
    const raw = { matches: [{ index: 1, option_key: null }, { index: 0, option_key: 'option_b' }] };
    expect(parseMapping(raw, KEYS, 2)).toEqual(['option_b', null]);
  });

  it('returns null for a reply that is not { matches: [...] }', () => {
    expect(parseMapping(null, KEYS, 1)).toBeNull();
    expect(parseMapping('{"matches":', KEYS, 1)).toBeNull();
    expect(parseMapping({ matches: 'option_a' }, KEYS, 1)).toBeNull();
  });

  it('drops a key that is not one of the question’s options', () => {
    const raw = { matches: [{ index: 0, option_key: 'option_d' }, { index: 1, option_key: 'constructor' }] };
    expect(parseMapping(raw, KEYS, 2)).toEqual([null, null]);
  });

  it('ignores malformed entries, out-of-range indexes and repeats (first wins); a missing quote is null', () => {
    const raw = {
      matches: [
        { index: 0, option_key: 'option_a' },
        { index: 0, option_key: 'option_c' },
        { index: 5, option_key: 'option_b' },
        { index: -1, option_key: 'option_b' },
        { index: '1', option_key: 'option_b' },
      ],
    };
    expect(parseMapping(raw, KEYS, 3)).toEqual(['option_a', null, null]);
  });
});

describe('mapStances', () => {
  it('sends the question, its options and the quotes', async () => {
    const complete = vi.fn(async () => ({ matches: [{ index: 0, option_key: 'option_a' }] }));
    expect(await mapStances(QUESTION, ['We must build public homes on public land now.'], complete)).toEqual(['option_a']);
    const prompt = (complete.mock.calls[0] as unknown[])[1] as string;
    expect(prompt).toContain('- option_b: Cost-rental partnerships');
    expect(prompt).toContain('0. "We must build public homes on public land now."');
  });

  it('does not call the model with no quotes', async () => {
    const complete = vi.fn(async () => null);
    expect(await mapStances(QUESTION, [], complete)).toEqual([]);
    expect(complete).not.toHaveBeenCalled();
  });
});
