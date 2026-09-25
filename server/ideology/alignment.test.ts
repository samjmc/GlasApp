import { describe, expect, it } from 'vitest';
import { IDEOLOGY_DIMENSIONS, emptyIdeologyVector, type IdeologyVector } from '@shared/ideology';
import { alignment, closestAndFurthest } from './alignment';

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
});
