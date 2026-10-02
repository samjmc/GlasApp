import { describe, expect, it } from 'vitest';
import { IDEOLOGY_DIMENSIONS, emptyIdeologyVector, type IdeologyDimension, type IdeologyVector } from '@shared/ideology';
import { MIN_MEASURED_DIMS, alignment, closestAndFurthest, subjectWeights } from './alignment';

const all = (x: number) => Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, x])) as IdeologyVector;
const at = (v: Partial<IdeologyVector>): IdeologyVector => ({ ...emptyIdeologyVector(), ...v });

describe('alignment', () => {
  it('is 100 for the same position and 0 for opposite corners', () => {
    expect(alignment(all(3), all(3))).toBe(100);
    expect(alignment(all(10), all(-10))).toBe(0);
    expect(alignment(all(0), all(10))).toBe(50);
  });

  it('is symmetric', () => {
    const a = at({ economic: 4, welfare: -7, globalism: 2 });
    const b = at({ economic: -1, social: 5 });
    expect(alignment(a, b)).toBe(alignment(b, a));
  });

  it('lets weights change what matters, bounded to 0..3', () => {
    const a = at({ economic: 10 });
    const b = at({ economic: -10 });
    expect(alignment(a, b)).toBe(88); // one of eight dims fully apart: 1 − 20/160
    expect(alignment(a, b, { economic: 0 })).toBe(100);
    expect(alignment(a, b, { economic: 3 })).toBe(70); // 1 − 60/200
    expect(alignment(a, b, { economic: 99 })).toBe(70); // capped at 3
  });

  it('returns 0 when every weight is 0 rather than dividing by zero', () => {
    const zero = Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, 0]));
    expect(alignment(all(1), all(2), zero)).toBe(0);
  });
});

describe('closestAndFurthest', () => {
  it('names the nearest and farthest dimensions', () => {
    const { closest, furthest } = closestAndFurthest(at({ economic: 10, welfare: 1 }), at({ economic: -10, welfare: 1, social: 6 }));
    expect(furthest[0]).toBe('economic');
    expect(furthest[1]).toBe('social');
    expect(closest).not.toContain('economic');
  });

  it('uses only the weighted dimensions, and never names one as both closest and furthest', () => {
    const weights = { ...Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, 0])), economic: 1, welfare: 2, cultural: 0.5 };
    // Unweighted social and globalism are the widest gaps; they must not be named.
    const a = at({ economic: 4, welfare: 1, cultural: 0, social: 10, globalism: -10 });
    const b = at({ economic: 0, welfare: 0, cultural: 9, social: -10, globalism: 10 });
    const { closest, furthest } = closestAndFurthest(a, b, weights);
    expect(closest).toEqual(['welfare', 'economic']);
    expect(furthest).toEqual(['cultural']);
  });
});

describe('subjectWeights', () => {
  const user = { economic: 2, welfare: 0.5 };
  const dims = (n: number): IdeologyDimension[] => IDEOLOGY_DIMENSIONS.slice(0, n);

  it('leaves the user weights as they are for a subject with a party baseline', () => {
    expect(subjectWeights(user, { hasPartyBaseline: true, measured: [] })).toBe(user);
  });

  it(`does not match a subject with no baseline on fewer than ${MIN_MEASURED_DIMS} measured dimensions`, () => {
    expect(subjectWeights({}, { hasPartyBaseline: false, measured: dims(3) })).toBeNull();
  });

  it(`matches one measured on ${MIN_MEASURED_DIMS} only on those, keeping the user weight on each`, () => {
    const weights = subjectWeights(user, { hasPartyBaseline: false, measured: dims(4) })!;
    expect(weights).toEqual({ economic: 2, social: undefined, cultural: undefined, authority: undefined, environmental: 0, welfare: 0, globalism: 0, technocratic: 0 });
    // The four it has no evidence on do not count, however far apart.
    expect(alignment(at({ environmental: -10, welfare: 10, globalism: -10, technocratic: 10 }), all(0), weights)).toBe(100);
  });

  it('does not match when the user is measured only on dimensions the subject is not', () => {
    const onlyUnmeasured = { economic: 0, social: 0, cultural: 0, authority: 0 };
    expect(subjectWeights(onlyUnmeasured, { hasPartyBaseline: false, measured: dims(4) })).toBeNull();
  });
});
