import { describe, expect, it } from 'vitest';
import { debateItemKind } from '@shared/schema/parliament';
import { PASSES, extractPrompt, parseItems } from './prompt';
import { labelSpeeches } from './windows';

describe('parseItems', () => {
  it('reads well-formed items and nulls what does not apply', () => {
    const out = parseItems({
      items: [
        { speech: 's2', kind: 'specific_claim', claim_type: 'figure', quote: 'we hired 2,000 nurses', target_speech: null, target_quote: null, addressee: null, due: null },
        { speech: 's3', kind: 'question', claim_type: 'cost', quote: 'Will the Minister act?', addressee: 'the Minister' },
        { speech: 's3', kind: 'commitment', quote: 'I will publish the plan', due: '' },
      ],
    });
    expect(out).toEqual({
      malformed: 0,
      items: [
        { speech: 's2', kind: 'specific_claim', claimType: 'figure', quote: 'we hired 2,000 nurses', targetSpeech: null, targetQuote: null, addressee: null, due: null },
        // A claim type on anything but a claim is dropped; a blank field is null.
        { speech: 's3', kind: 'question', claimType: null, quote: 'Will the Minister act?', targetSpeech: null, targetQuote: null, addressee: 'the Minister', due: null },
        { speech: 's3', kind: 'commitment', claimType: null, quote: 'I will publish the plan', targetSpeech: null, targetQuote: null, addressee: null, due: null },
      ],
    });
  });

  it('counts entries of the wrong shape, and rejects a reply that is not { items: [...] }', () => {
    expect(parseItems({ items: [{ speech: 's1', kind: 'verdict', quote: 'x y z' }, { speech: 's1', kind: 'question' }, 'nonsense'] })).toEqual({ items: [], malformed: 3 });
    expect(parseItems({ items: [] })).toEqual({ items: [], malformed: 0 });
    expect(parseItems({ stances: [] })).toBeNull();
    expect(parseItems(null)).toBeNull();
  });
});

describe('extractPrompt', () => {
  it('marks context and extract speeches, and names speakers by name and role only', () => {
    const [a, b] = labelSpeeches([
      { id: '1', memberCode: 'A', speaker: 'Ann Murphy', date: '2026-09-23', text: 'First words.', wordCount: 2 },
      { id: '2', memberCode: 'B', speaker: 'Mary Butler (Minister for Health)', date: '2026-09-23', text: 'Second words.', wordCount: 2 },
    ]);
    const prompt = extractPrompt('Health: Motion', { context: [a], speeches: [b] }, 'facts');
    expect(prompt).toContain('[s1] (context) Ann Murphy:\nFirst words.');
    expect(prompt).toContain('[s2] (extract) Mary Butler (Minister for Health):\nSecond words.');
    expect(prompt).toContain('titled "Health: Motion"');
    expect(prompt).toContain('Never translate Irish');
  });

  it('asks each pass for its own kinds only, so every kind is asked for exactly once', () => {
    const [a] = labelSpeeches([{ id: '1', memberCode: 'A', speaker: 'Ann Murphy', date: '2026-09-23', text: 'Words.', wordCount: 1 }]);
    const asked = (pass: 'facts' | 'links') =>
      ['specific_claim', 'response', 'concession', 'question', 'commitment'].filter((k) => extractPrompt('T', { context: [], speeches: [a] }, pass).includes(`- "${k}":`));
    expect(asked('facts')).toEqual(['specific_claim', 'question', 'commitment']);
    expect(asked('links')).toEqual(['response', 'concession']);
    expect(Object.values(PASSES).flat().sort()).toEqual([...debateItemKind.enumValues].sort());
  });
});
