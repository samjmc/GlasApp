import { describe, expect, it } from 'vitest';
import { PARTY_PRIOR_WEIGHT, QUIZ_WEIGHT } from '../server/ideology/sources';
import { CONFIDENCE_HIGH_AT, CONFIDENCE_MEDIUM_AT, confidenceOf } from './ideologyMatch';

describe('confidenceOf', () => {
  it('reads no weight, and anything not a positive number, as none', () => {
    expect(confidenceOf(0)).toBe('none');
    expect(confidenceOf(-1)).toBe('none');
    expect(confidenceOf(NaN)).toBe('none');
  });

  it('is low below one party prior, medium from it, high from one full quiz', () => {
    expect(confidenceOf(2.99)).toBe('low');
    expect(confidenceOf(3)).toBe('medium');
    expect(confidenceOf(9.99)).toBe('medium');
    expect(confidenceOf(10)).toBe('high');
  });

  it('ties its thresholds to the model weights they are named after', () => {
    expect(CONFIDENCE_MEDIUM_AT).toBe(PARTY_PRIOR_WEIGHT);
    expect(CONFIDENCE_HIGH_AT).toBe(QUIZ_WEIGHT);
  });
});
