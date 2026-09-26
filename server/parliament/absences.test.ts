import { describe, expect, it } from 'vitest';
import { DOCUMENTED_ABSENCES, validateAbsences, type DocumentedAbsence } from './absences';

const ok: DocumentedAbsence = {
  memberCode: 'A-B.D.2020-02-08',
  from: '2025-01-01',
  to: '2025-02-01',
  reason: 'parental_leave',
  source: 'https://example.ie/story',
  note: null,
};

describe('DOCUMENTED_ABSENCES', () => {
  it('every entry is valid, dated and sourced', () => {
    expect(DOCUMENTED_ABSENCES.length).toBeGreaterThan(0);
    expect(validateAbsences(DOCUMENTED_ABSENCES)).toHaveLength(DOCUMENTED_ABSENCES.length);
  });

  it('keeps medical detail out of the notes', () => {
    for (const e of DOCUMENTED_ABSENCES) expect(e.note ?? '').not.toMatch(/cancer|epilep|diagnos|surgery|condition/i);
  });
});

describe('validateAbsences', () => {
  it('accepts a good entry and an ongoing one', () => {
    expect(validateAbsences([ok, { ...ok, from: '2025-03-01', to: null }])).toHaveLength(2);
  });

  it.each([
    ['no member code', { memberCode: '' }, /memberCode/],
    ['a bad date', { from: '1 Jan 2025' }, /from/],
    ['an end before the start', { to: '2024-12-01' }, /before/],
    ['an unknown reason', { reason: 'holiday' as DocumentedAbsence['reason'] }, /reason/],
    ['no source', { source: '' }, /source/],
    ['a non-https source', { source: 'http://example.ie' }, /source/],
  ])('rejects %s', (_label, change, message) => {
    expect(() => validateAbsences([{ ...ok, ...change }])).toThrow(message);
  });

  it('rejects two entries for one member starting the same day', () => {
    expect(() => validateAbsences([ok, { ...ok }])).toThrow(/second entry/);
  });
});
