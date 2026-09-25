import { describe, expect, it } from 'vitest';
import { IDEOLOGY_DIMENSIONS } from '@shared/ideology';
import { isIndependent, partyBaseline, partyKey } from './partyBaselines';

describe('partyBaseline', () => {
  it('matches the spellings the Oireachtas feed and users produce', () => {
    expect(partyKey('Sinn Féin')).toBe(partyKey('sinn fein'));
    expect(partyKey('The Labour Party')).toBe(partyKey('Labour'));
    expect(partyKey('People Before Profit - Solidarity')).toBe(partyKey('People Before Profit–Solidarity'));
    expect(partyBaseline('Labour')).not.toBeNull();
    expect(partyBaseline('Fianna Fail')).not.toBeNull();
  });

  it('gives independents no baseline, but Independent Ireland one', () => {
    expect(isIndependent(null)).toBe(true);
    expect(isIndependent('Independent')).toBe(true);
    expect(isIndependent('Independents 4 Change')).toBe(true);
    expect(isIndependent('Independent Ireland')).toBe(false);
    expect(partyBaseline('Independent')).toBeNull();
    expect(partyBaseline('Independent Ireland')).not.toBeNull();
    expect(partyBaseline('Some New Party')).toBeNull();
  });

  it('stays inside ±10 on all eight dimensions', () => {
    for (const party of ['Fianna Fáil', 'Fine Gael', 'Sinn Féin', 'Green Party', 'National Party']) {
      const v = partyBaseline(party)!;
      for (const d of IDEOLOGY_DIMENSIONS) expect(Math.abs(v[d])).toBeLessThanOrEqual(10);
    }
  });

  // + is the right-coded pole: populist, nationalist, self-reliance, pro-growth.
  it('follows the shared sign rule, including the re-derived technocratic column', () => {
    expect(partyBaseline('Fianna Fáil')!.technocratic).toBeLessThan(0); // "mostly technocratic"
    expect(partyBaseline('Fine Gael')!.technocratic).toBeLessThan(0); // "strongly technocratic"
    expect(partyBaseline('National Party')!.technocratic).toBeGreaterThan(0); // "very strongly populist"
    expect(partyBaseline('People Before Profit–Solidarity')!.technocratic).toBeGreaterThan(0); // "largely populist"
    expect(partyBaseline('Sinn Féin')!.globalism).toBeGreaterThan(0); // "moderately nationalist"
    expect(partyBaseline('Green Party')!.environmental).toBeLessThan(0); // ecological
    expect(partyBaseline('Sinn Féin')!.welfare).toBeLessThan(0); // "robust welfare state"
    expect(partyBaseline('Fine Gael')!.economic).toBeGreaterThan(0); // centre-right
  });
});
