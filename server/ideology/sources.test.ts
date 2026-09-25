import { describe, expect, it } from 'vitest';
import { hasSignal, toObservationVector } from './sources';

describe('toObservationVector', () => {
  it('scales each source onto −10..+10', () => {
    expect(toObservationVector('article', { economic: 0.5, welfare: -0.25 })).toEqual({ economic: 10, welfare: -5 });
    expect(toObservationVector('debate', { globalism: -0.5 })).toEqual({ globalism: -10 });
    expect(toObservationVector('vote', { technocratic: 2, social: -1 })).toEqual({ technocratic: 10, social: -5 });
  });

  it('keeps the sign: no source is negated', () => {
    for (const source of ['article', 'debate', 'vote'] as const) {
      const v = toObservationVector(source, { environmental: source === 'vote' ? 1 : 0.25 });
      expect(v.environmental).toBeGreaterThan(0);
    }
  });

  it('treats 0, sub-floor, missing, null and non-finite values as no signal', () => {
    const v = toObservationVector('article', { economic: 0, social: 0.04, cultural: null, authority: Number.NaN });
    expect(v).toEqual({});
    expect(hasSignal(v)).toBe(false);
    expect(toObservationVector('vote', { economic: 0.19 })).toEqual({});
    expect(toObservationVector('vote', { economic: 0.2 })).toEqual({ economic: 1 });
  });

  it('bounds out-of-range values to the source max', () => {
    expect(toObservationVector('article', { economic: 3 })).toEqual({ economic: 10 });
    expect(toObservationVector('vote', { economic: -9 })).toEqual({ economic: -10 });
  });
});
