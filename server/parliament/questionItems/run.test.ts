import { describe, expect, it, vi } from 'vitest';
import type { QuestionUnit } from '../repo/questionRecord';
import { questionSample } from './run';

// Hoisted above the imports: the sample is pure, so no database or model is needed.
vi.mock('../repository', () => ({}));
vi.mock('../debateItems/run', () => ({ extractUnits: vi.fn() }));

describe('questionSample', () => {
  const units: QuestionUnit[] = (['oral_pq', 'topical_issue', 'leaders_questions', 'rapid'] as const).flatMap((format) =>
    Array.from({ length: 30 }, (_, k) => ({ id: `${format}-${k}`, kind: format, format, title: 't', words: 100 })),
  );

  it('takes exactly n when there are enough, never more (for n = 5 the rounded shares come to 6)', () => {
    for (let n = 1; n <= 20; n++) expect(questionSample(units, n)).toHaveLength(n);
  });
});
