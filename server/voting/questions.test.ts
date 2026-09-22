import { describe, expect, it } from 'vitest';
import {
  assembleQuestion,
  parseOptionPositions,
  parseQuestion,
  pickTargetDimension,
  questionPrompt,
  shouldCreateQuestion,
  vectorPrompt,
  type QuestionArticle,
} from './questions';

const article: QuestionArticle = {
  id: 7,
  title: 'Government announces €2bn housing fund',
  content: 'The fund can be spent on public building, cost rental, grants or vacancy.',
  source: 'RTÉ',
  publishedAt: new Date('2026-09-20T10:00:00Z'),
  url: 'https://example.ie/a',
  imageUrl: null,
  summary: 'A new fund.',
};

const goodQuestion = {
  should_create: true,
  confidence: 0.9,
  policy_domain: 'housing',
  policy_topic: 'Public Housing Targets',
  question: 'A €2bn housing fund must choose one priority. Which should it be?',
  answer_options: ['Public construction', 'Cost-rental partnerships', 'First-time buyer grants', 'Vacancy activation'],
  primary_dimension: 'welfare',
  rationale: 'Reveals state vs market preference.',
};

const vector = (overrides: Record<string, number> = {}) => ({
  economic: 0, social: 0, cultural: 0, authority: 0, environmental: 0, welfare: 0, globalism: 0, technocratic: 0,
  ...overrides,
});

describe('parseQuestion', () => {
  it('parses a well-formed answer and keys options in order', () => {
    const q = parseQuestion(goodQuestion)!;
    expect(q.domain).toBe('housing');
    expect(q.topic).toBe('public_housing_targets');
    expect(q.primaryDimension).toBe('welfare');
    expect(q.options.map((o) => o.key)).toEqual(['option_a', 'option_b', 'option_c', 'option_d']);
    expect(q.options[1]!.label).toBe('Cost-rental partnerships');
  });

  it('maps an unknown domain to other and an unknown axis to null', () => {
    const q = parseQuestion({ ...goodQuestion, policy_domain: 'Space Travel', primary_dimension: 'vibes' })!;
    expect(q.domain).toBe('other');
    expect(q.primaryDimension).toBeNull();
  });

  it('rejects fewer than three options, duplicates, and an empty question', () => {
    expect(parseQuestion({ ...goodQuestion, answer_options: ['A', 'B'] })).toBeNull();
    expect(parseQuestion({ ...goodQuestion, answer_options: ['A', 'b', 'B'] })).toBeNull();
    expect(parseQuestion({ ...goodQuestion, question: '   ' })).toBeNull();
    expect(parseQuestion(null)).toBeNull();
    expect(parseQuestion({ nonsense: true })).toBeNull();
  });

  it('keeps at most four options', () => {
    const q = parseQuestion({ ...goodQuestion, answer_options: ['A', 'B', 'C', 'D', 'E'] })!;
    expect(q.options).toHaveLength(4);
  });

  it('clamps confidence and treats a non-number as unknown', () => {
    expect(parseQuestion({ ...goodQuestion, confidence: 7 })!.confidence).toBe(1);
    expect(parseQuestion({ ...goodQuestion, confidence: 'high' })!.confidence).toBeNull();
  });
});

describe('parseOptionPositions', () => {
  const keys = ['option_a', 'option_b', 'option_c'];
  const raw = (options: unknown[]) => ({ options });

  it('returns every option, clamping each axis to ±2 and weight to 0.1..3', () => {
    const map = parseOptionPositions(
      raw([
        { key: 'option_a', ideology_delta: { economic: 5, welfare: -1.5 }, weight: 9, confidence: 0.8 },
        { key: 'option_b', ideology_delta: { social: -3 }, weight: 0 },
        { key: 'option_c', ideology_delta: { globalism: 1 } },
      ]),
      keys,
    )!;
    expect(map.get('option_a')).toEqual({ vector: vector({ economic: 2, welfare: -1.5 }), weight: 3, confidence: 0.8 });
    expect(map.get('option_b')!.vector.social).toBe(-2);
    expect(map.get('option_b')!.weight).toBe(0.1);
    expect(map.get('option_c')).toEqual({ vector: vector({ globalism: 1 }), weight: 1, confidence: null });
  });

  it('rejects the whole answer when any option has no position', () => {
    expect(
      parseOptionPositions(
        raw([
          { key: 'option_a', ideology_delta: { economic: 1 } },
          { key: 'option_b', ideology_delta: { economic: -1 } },
        ]),
        keys,
      ),
    ).toBeNull();
    expect(
      parseOptionPositions(raw([{ key: 'option_a' }, { key: 'option_b' }, { key: 'option_c' }]), keys),
    ).toBeNull();
  });

  it('ignores keys it did not ask for', () => {
    const map = parseOptionPositions(
      raw([
        ...keys.map((key) => ({ key, ideology_delta: { economic: 1 } })),
        { key: 'option_z', ideology_delta: { economic: 2 } },
      ]),
      keys,
    )!;
    expect([...map.keys()]).toEqual(keys);
  });
});

describe('shouldCreateQuestion', () => {
  const base = parseQuestion(goodQuestion)!;
  it('follows the model, the force flag, or a high-priority topic', () => {
    expect(shouldCreateQuestion(base)).toBe(true);
    const declined = { ...base, shouldCreate: false, topic: 'minor_thing' };
    expect(shouldCreateQuestion(declined)).toBe(false);
    expect(shouldCreateQuestion(declined, true)).toBe(true);
    expect(shouldCreateQuestion({ ...declined, topic: 'public_housing_targets' })).toBe(true);
  });
});

describe('pickTargetDimension', () => {
  it('returns nothing when no questions exist or coverage is even', () => {
    expect(pickTargetDimension({})).toBeUndefined();
    const even = { economic: 5, social: 5, cultural: 5, authority: 5, environmental: 5, welfare: 5, globalism: 5, technocratic: 5 };
    expect(pickTargetDimension(even)).toBeUndefined();
  });

  it('picks only among axes below 80% of the mean', () => {
    // mean = 80/8 = 10; threshold 8. Only cultural (2) and technocratic (0) are under.
    const counts = { economic: 20, social: 15, cultural: 2, authority: 10, environmental: 13, welfare: 10, globalism: 10, technocratic: 0 };
    expect(pickTargetDimension(counts, () => 0)).toBe('cultural');
    expect(pickTargetDimension(counts, () => 0.99)).toBe('technocratic');
  });
});

describe('prompts', () => {
  it('include the article, the target axis and every option key', () => {
    const q = parseQuestion(goodQuestion)!;
    const first = questionPrompt(article, 'welfare');
    expect(first).toContain(article.title);
    expect(first).toContain('Target dimension: welfare');
    const second = vectorPrompt(q);
    for (const option of q.options) expect(second).toContain(`${option.key}: ${option.label}`);
  });
});

describe('assembleQuestion', () => {
  it('copies the article snapshot and lays out one row per option', () => {
    const q = parseQuestion({ ...goodQuestion, answer_options: goodQuestion.answer_options.slice(0, 3) })!;
    const positions = parseOptionPositions(
      { options: q.options.map((o, i) => ({ key: o.key, ideology_delta: { economic: i - 1 }, weight: 1.5 })) },
      q.options.map((o) => o.key),
    )!;
    const rows = assembleQuestion(article, q, positions);
    expect(rows.question).toMatchObject({
      articleId: 7,
      headline: article.title,
      summary: 'A new fund.',
      articleUrl: 'https://example.ie/a',
      policyDomain: 'housing',
      primaryDimension: 'welfare',
    });
    expect(rows.options.map((o) => [o.optionKey, o.position, o.economic, o.weight])).toEqual([
      ['option_a', 0, -1, 1.5],
      ['option_b', 1, 0, 1.5],
      ['option_c', 2, 1, 1.5],
    ]);
  });
});
