import { describe, expect, it } from 'vitest';
import { ATTENDANCE_BENCHMARK, QUESTIONS_BENCHMARK } from '../scoring/weights';
import {
  attendanceBenchmark,
  attendancePct,
  committeeAttendancePct,
  daysCovered,
  LEADERSHIP_ATTENDANCE_BENCHMARK,
  MIN_COMMITTEE_SITTINGS,
  MIN_QUESTION_DAYS,
  debateScores,
  majority,
  majorityFor,
  MIN_DIVISIONS_FOR_ATTENDANCE,
  MIN_SITTING_DAYS,
  partyLinePct,
  partyMajorities,
  percentile,
  questionsExpected,
} from './metrics';

describe('daysCovered', () => {
  it('counts each day once, however the ranges overlap, clipped to the window', () => {
    expect(daysCovered('2025-01-01', '2025-01-31', [])).toBe(0);
    expect(daysCovered('2025-01-01', '2025-01-31', [{ start: '2025-01-10', end: '2025-01-19' }])).toBe(10);
    expect(
      daysCovered('2025-01-01', '2025-01-31', [
        { start: '2025-01-10', end: '2025-01-19' },
        { start: '2025-01-15', end: '2025-01-24' },
        { start: '2024-12-01', end: '2025-01-02' },
      ]),
    ).toBe(15 + 2);
  });

  it('treats an open range as running to the end of the window', () => {
    expect(daysCovered('2025-01-01', '2025-01-31', [{ start: '2025-01-22', end: null }])).toBe(10);
    expect(daysCovered('2025-01-01', '2025-01-31', [{ start: '2025-02-01', end: null }])).toBe(0);
  });
});

describe('questionsExpected', () => {
  const term = { termStart: '2024-11-29', today: '2025-11-28' }; // 365 days

  it('expects a full-term backbencher to ask the full benchmark, exactly as before', () => {
    expect(questionsExpected({ ...term, memberSince: '2024-11-29', excluded: [] })).toBe(QUESTIONS_BENCHMARK);
  });

  it('pro-rates for time in exempt office or on documented leave', () => {
    // Minister of State for the second half of the term: half the benchmark.
    const halfYear = { start: '2025-05-30', end: null };
    expect(questionsExpected({ ...term, memberSince: '2024-11-29', excluded: [halfYear] })).toBe(Math.round((QUESTIONS_BENCHMARK * 182 * 10) / 365) / 10);
    // A by-election TD is expected less, not the whole-term benchmark.
    expect(questionsExpected({ ...term, memberSince: '2025-05-30', excluded: [] })).toBe(Math.round((QUESTIONS_BENCHMARK * 183 * 10) / 365) / 10);
  });

  it('is NULL when the TD was not expected to ask for long enough (cabinet all term, the chair)', () => {
    expect(questionsExpected({ ...term, memberSince: '2024-11-29', excluded: [{ start: '2024-12-18', end: null }] })).toBeNull();
    // Exactly the minimum is enough.
    const since = '2025-08-31'; // 90 days to 2025-11-28
    expect(questionsExpected({ ...term, memberSince: since, excluded: [] })).not.toBeNull();
    expect(questionsExpected({ ...term, memberSince: '2025-09-01', excluded: [] })).toBeNull();
    expect(MIN_QUESTION_DAYS).toBe(90);
  });
});

describe('attendanceBenchmark', () => {
  it('is the backbench benchmark with no government time, the government one with all of it', () => {
    expect(attendanceBenchmark(100, 0)).toBe(ATTENDANCE_BENCHMARK);
    expect(attendanceBenchmark(100, 100)).toBe(LEADERSHIP_ATTENDANCE_BENCHMARK);
  });

  it('weights by the divisions held in each role', () => {
    expect(attendanceBenchmark(200, 50)).toBe(Math.round(((ATTENDANCE_BENCHMARK * 150 + LEADERSHIP_ATTENDANCE_BENCHMARK * 50) / 200) * 10) / 10);
  });

  it('is NULL with no eligible divisions, and never lets office time exceed the total', () => {
    expect(attendanceBenchmark(0, 0)).toBeNull();
    expect(attendanceBenchmark(10, 25)).toBe(LEADERSHIP_ATTENDANCE_BENCHMARK);
  });
});

describe('attendancePct', () => {
  it('is votes cast over divisions held while a member, one decimal', () => {
    expect(attendancePct(49, 108, false)).toBe(45.4);
    expect(attendancePct(108, 108, false)).toBe(100);
  });

  it('is NULL for the chair, who does not vote, and for too short a window', () => {
    expect(attendancePct(0, 403, true)).toBeNull();
    expect(attendancePct(3, MIN_DIVISIONS_FOR_ATTENDANCE - 1, false)).toBeNull();
    expect(attendancePct(0, 0, false)).toBeNull();
  });

  it('measures a by-election TD against their own window, not the whole term', () => {
    // Joined 2026-05-25 and voted in 56 of the 60 divisions since: that is 93%, not 14%.
    expect(attendancePct(56, 60, false)).toBe(93.3);
  });
});

describe('committeeAttendancePct', () => {
  it("is sittings attended over sittings of the TD's own committees, one decimal", () => {
    expect(committeeAttendancePct(18, 24)).toBe(75);
    expect(committeeAttendancePct(24, 24)).toBe(100);
  });

  it('is NULL below the minimum, so a minister with no committee is not 0%', () => {
    expect(committeeAttendancePct(0, 0)).toBeNull();
    expect(committeeAttendancePct(3, MIN_COMMITTEE_SITTINGS - 1)).toBeNull();
  });
});

describe('percentile', () => {
  it('interpolates and refuses an empty list', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.75)).toBe(4);
    expect(percentile([0, 10], 0.75)).toBe(7.5);
    expect(() => percentile([], 0.5)).toThrow();
  });
});

describe('debateScores', () => {
  const td = (tdId: number, sectionsSpoken: number, over: Partial<{ isPresiding: boolean; sittingDays: number }> = {}) => ({
    tdId,
    sectionsSpoken,
    sittingDays: over.sittingDays ?? 100,
    isPresiding: over.isPresiding ?? false,
  });

  it('scores against the 75th percentile, capped at 1, as a fraction', () => {
    const scores = debateScores([td(1, 10), td(2, 20), td(3, 30), td(4, 40), td(5, 50)]);
    // rates .1 .2 .3 .4 .5 → benchmark .4
    expect(scores.get(1)).toBeCloseTo(0.25);
    expect(scores.get(4)).toBe(1);
    expect(scores.get(5)).toBe(1);
  });

  it('leaves out the chair and short windows, so their pillar drops out rather than reading 0', () => {
    const scores = debateScores([td(1, 10), td(2, 400, { isPresiding: true }), td(3, 1, { sittingDays: MIN_SITTING_DAYS - 1 })]);
    expect(scores.has(2)).toBe(false);
    expect(scores.has(3)).toBe(false);
    expect(scores.get(1)).toBe(1);
  });

  it('gives 0 to a measurable TD who never spoke, and returns nothing when nobody is measurable', () => {
    expect(debateScores([td(1, 0), td(2, 10)]).get(1)).toBe(0);
    expect(debateScores([td(1, 5, { isPresiding: true })]).size).toBe(0);
  });
});

describe('majority', () => {
  it('picks the most common vote and is NULL on a tie or no votes', () => {
    expect(majority({ ta: 3, nil: 1 })).toBe('ta');
    expect(majority({ ta: 2, nil: 2 })).toBeNull();
    expect(majority({ ta: 2, nil: 2, staon: 3 })).toBe('staon');
    expect(majority({})).toBeNull();
    expect(majority({ ta: 0 })).toBeNull();
  });
});

describe('party lines', () => {
  const rows = [
    { divisionId: 'd1', party: 'Sinn Féin', vote: 'ta' as const, n: 30 },
    { divisionId: 'd1', party: 'Sinn Féin', vote: 'nil' as const, n: 2 },
    { divisionId: 'd1', party: 'Independent', vote: 'nil' as const, n: 12 },
    { divisionId: 'd1', party: 'Independent Ireland', vote: 'nil' as const, n: 4 },
    { divisionId: 'd2', party: 'Labour Party', vote: 'ta' as const, n: 5 },
    { divisionId: 'd2', party: 'Labour Party', vote: 'nil' as const, n: 5 },
  ];
  const m = partyMajorities(rows);

  it('finds each party majority, treats Independents as no party, and keeps Independent Ireland', () => {
    expect(majorityFor(m, 'd1', 'Sinn Féin')).toBe('ta');
    expect(majorityFor(m, 'd1', 'Independent')).toBeNull();
    expect(majorityFor(m, 'd1', null)).toBeNull();
    expect(majorityFor(m, 'd1', 'Independent Ireland')).toBe('nil');
    expect(majorityFor(m, 'd2', 'Labour Party')).toBeNull();
    expect(majorityFor(m, 'd9', 'Sinn Féin')).toBeNull();
  });

  it('partyLinePct counts only comparable votes', () => {
    expect(
      partyLinePct([
        { vote: 'ta', partyMajority: 'ta' },
        { vote: 'nil', partyMajority: 'ta' },
        { vote: 'ta', partyMajority: null },
      ]),
    ).toBe(50);
    expect(partyLinePct([{ vote: 'ta', partyMajority: null }])).toBeNull();
  });
});
