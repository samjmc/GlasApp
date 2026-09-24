import { describe, expect, it } from 'vitest';
import { addDays, OVERLAP_DAYS, resumePoint, startDate } from './window';

const DAIL_START = '2024-11-29';

describe('startDate', () => {
  it('starts at the Dáil on a first run, else re-reads the overlap window, never before the Dáil', () => {
    expect(startDate(undefined, null, DAIL_START)).toBe(DAIL_START);
    expect(startDate(undefined, '2025-06-30', DAIL_START)).toBe(addDays('2025-06-30', -OVERLAP_DAYS));
    expect(startDate(undefined, '2024-12-01', DAIL_START)).toBe(DAIL_START);
    expect(startDate('2025-01-01', '2025-06-30', DAIL_START)).toBe('2025-01-01');
  });
});

describe('resumePoint', () => {
  it('moves to today after a normal run', () => {
    expect(resumePoint(undefined, '2025-06-01', DAIL_START, '2025-06-30')).toBe('2025-06-30');
  });

  it('moves to today after a --since that covers the normal window', () => {
    expect(resumePoint('2025-01-01', '2025-06-01', DAIL_START, '2025-06-30')).toBe('2025-06-30');
  });

  it('does NOT move after a --since that starts later than a normal run would', () => {
    // First run with --since: everything before it was never fetched.
    expect(resumePoint('2026-01-01', null, DAIL_START, '2026-02-01')).toBeNull();
    // A gap between the stored point's overlap window and --since.
    expect(resumePoint('2025-06-20', '2025-05-01', DAIL_START, '2025-06-30')).toBeNull();
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries in UTC', () => {
    expect(addDays('2025-01-01', -1)).toBe('2024-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });
});
