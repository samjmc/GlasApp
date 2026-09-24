import { describe, expect, it } from 'vitest';
import { SUMMARY_MAX_WORDS, buildPrompt, parseRelevance } from './relevance';

describe('parseRelevance', () => {
  it('maps each index to a clamped score, a known category and a summary', () => {
    const reply = JSON.stringify({
      items: [
        { i: 0, relevance: 92.4, category: 'oireachtas', summary: 'The Dáil passed the bill.' },
        { i: 1, relevance: 140, category: 'housing', summary: 'x' },
        { i: 2, relevance: -3, category: 'sport', summary: '' },
      ],
    });
    expect(parseRelevance(reply, 3)).toEqual([
      { score: 92, category: 'oireachtas', summary: 'The Dáil passed the bill.' },
      { score: 100, category: 'housing', summary: 'x' },
      { score: 0, category: 'other', summary: null },
    ]);
  });

  it('caps a long summary at the word limit', () => {
    const long = Array.from({ length: 80 }, (_, i) => `w${i}`).join(' ');
    const [r] = parseRelevance(JSON.stringify({ items: [{ i: 0, relevance: 70, category: 'eu', summary: long }] }), 1);
    expect(r!.summary!.split(' ')).toHaveLength(SUMMARY_MAX_WORDS);
    expect(r!.summary!.endsWith('…')).toBe(true);
  });

  it('leaves skipped, out-of-range and score-less entries unscored (null), never guessed', () => {
    const reply = JSON.stringify({ items: [{ i: 7, relevance: 90 }, { i: '1', relevance: 90 }, { i: 1, category: 'health' }, null] });
    expect(parseRelevance(reply, 2)).toEqual([null, null]);
  });

  it('survives prose and code fences', () => {
    expect(parseRelevance('Sorry, I cannot help', 1)).toEqual([null]);
    expect(parseRelevance('```json\n{"items":[{"i":0,"relevance":65,"category":"health","summary":"s"}]}\n```', 1)).toEqual([
      { score: 65, category: 'health', summary: 's' },
    ]);
  });
});

describe('buildPrompt', () => {
  it('indexes items from 0 with source, quoted title and a trimmed standfirst', () => {
    expect(
      buildPrompt([
        { title: 'Budget cut', summary: 'Childcare', source: 'RTÉ News' },
        { title: 'Storm', summary: null, source: 'The Journal' },
      ]),
    ).toBe('[0] (RTÉ News) "Budget cut" — Childcare\n[1] (The Journal) "Storm"');
  });
});
