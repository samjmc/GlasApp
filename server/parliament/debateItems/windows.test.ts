import { describe, expect, it } from 'vitest';
import { buildWindows, isIrish, labelSpeeches, splitWindow, type DebateSpeech } from './windows';

const speech = (i: number, wordCount: number): DebateSpeech => ({
  id: `sect/spk_${i}`,
  memberCode: `M${i % 2}`,
  speaker: `Member ${i}`,
  date: '2026-09-23',
  text: 'x',
  wordCount,
});

describe('buildWindows', () => {
  const speeches = labelSpeeches([4000, 4000, 3000, 12000, 500].map((w, i) => speech(i + 1, w)));

  it('labels speeches once for the whole debate', () => {
    expect(speeches.map((s) => [s.label, s.index])).toEqual([
      ['s1', 0],
      ['s2', 1],
      ['s3', 2],
      ['s4', 3],
      ['s5', 4],
    ]);
  });

  it('cuts whole speeches up to the word limit, with earlier speeches as context', () => {
    const windows = buildWindows(speeches, 10_000, 3);
    expect(windows.map((w) => [w.context.map((s) => s.label), w.speeches.map((s) => s.label)])).toEqual([
      [[], ['s1', 's2']],
      [['s1', 's2'], ['s3']],
      // Longer than the limit on its own: a window of its own, never split.
      [['s1', 's2', 's3'], ['s4']],
      [['s2', 's3', 's4'], ['s5']],
    ]);
  });

  it('puts every speech in exactly one window to extract from', () => {
    const labels = buildWindows(speeches, 5_000, 2).flatMap((w) => w.speeches.map((s) => s.label));
    expect(labels).toEqual(speeches.map((s) => s.label));
    expect(buildWindows([], 10_000, 3)).toEqual([]);
  });
});

describe('splitWindow', () => {
  const labels = (w: { context: { label: string }[]; speeches: { label: string }[] }) => [w.context.map((s) => s.label), w.speeches.map((s) => s.label)];
  const windowOf = (words: number[], context = 2) => {
    const all = labelSpeeches(words.map((w, i) => speech(i + 1, w)));
    return { context: all.slice(0, context), speeches: all.slice(context) };
  };

  it('cuts at about half the words, and gives the second half the speeches before it as context', () => {
    const halves = splitWindow(windowOf([500, 500, 1000, 1000, 1000, 1000]), 3);
    expect(halves?.map(labels)).toEqual([
      [['s1', 's2'], ['s3', 's4']],
      [['s2', 's3', 's4'], ['s5', 's6']],
    ]);
  });

  it('keeps every speech in exactly one half, even when one speech holds most of the words', () => {
    expect(splitWindow(windowOf([100, 100, 9000, 50, 50]), 3)?.map(labels)).toEqual([
      [['s1', 's2'], ['s3']],
      [['s1', 's2', 's3'], ['s4', 's5']],
    ]);
    expect(splitWindow(windowOf([50, 50, 9000], 0), 3)?.map(labels)).toEqual([
      [[], ['s1', 's2']],
      [['s1', 's2'], ['s3']],
    ]);
  });

  it('never splits a single speech', () => {
    expect(splitWindow(windowOf([100, 100, 9000]), 3)).toBeNull();
  });
});

describe('isIrish', () => {
  it('tells an Irish speech from an English one', () => {
    expect(isIrish('Tá an Rialtas ag déanamh go leor oibre ar an gceist seo agus tá súil agam go n-éireoidh leis.')).toBe(true);
    expect(isIrish('The Minister will go to Brussels next week and we expect a decision on the matter soon.')).toBe(false);
    // An English speech that opens with a greeting in Irish is still English.
    expect(isIrish('Go raibh maith agat. The housing crisis is the biggest issue facing the country and the Government has failed to act on it.')).toBe(false);
    expect(isIrish('')).toBe(false);
  });
});
