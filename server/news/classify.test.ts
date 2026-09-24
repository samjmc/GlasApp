import { describe, expect, it } from 'vitest';
import { MIN_CONFIDENCE, buildPrompt, parseVerdicts } from './classify';

describe('parseVerdicts', () => {
  it('maps each index to a verdict', () => {
    const reply = JSON.stringify({ items: [{ i: 0, political: true, confidence: 0.9 }, { i: 1, political: false, confidence: 0.8 }] });
    expect(parseVerdicts(reply, 2)).toEqual([
      { political: true, confidence: 0.9 },
      { political: false, confidence: 0.8 },
    ]);
  });

  it('treats low confidence as not political', () => {
    const reply = JSON.stringify({ items: [{ i: 0, political: true, confidence: MIN_CONFIDENCE - 0.01 }] });
    expect(parseVerdicts(reply, 1)[0].political).toBe(false);
  });

  it('defaults skipped, out-of-range and malformed entries to not political', () => {
    const reply = JSON.stringify({ items: [{ i: 5, political: true, confidence: 1 }, { i: '1', political: true, confidence: 1 }, null] });
    expect(parseVerdicts(reply, 2)).toEqual([
      { political: false, confidence: 0 },
      { political: false, confidence: 0 },
    ]);
  });

  it('survives a non-JSON reply', () => {
    expect(parseVerdicts('Sorry, I cannot help', 1)).toEqual([{ political: false, confidence: 0 }]);
    expect(parseVerdicts('{"verdicts":[]}', 1)).toEqual([{ political: false, confidence: 0 }]);
  });

  it('only a literal true counts', () => {
    expect(parseVerdicts(JSON.stringify({ items: [{ i: 0, political: 'yes', confidence: 1 }] }), 1)[0].political).toBe(false);
  });
});

describe('buildPrompt', () => {
  it('numbers items from 0 and includes source and summary', () => {
    expect(
      buildPrompt([
        { title: 'Budget cut', summary: 'Childcare', source: 'RTÉ News' },
        { title: 'Storm', summary: null, source: 'The Journal' },
      ]),
    ).toBe('0. [RTÉ News] Budget cut — Childcare\n1. [The Journal] Storm');
  });
});
