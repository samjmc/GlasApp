import { describe, expect, it } from 'vitest';
import type { GovernmentOffices } from './verify';
import { isGovernmentSide } from '../governmentSide';
import { MIN_DEBATES, scoreDebates, termFigure, type Participant, type ScoredItem } from './rules';

const P = (memberCode: string, role: Participant['role'] = 'backbench', debateId = 'd1'): Participant => ({ debateId, memberCode, tdId: null, role, speeches: 2, words: 500 });
const I = (over: Partial<ScoredItem>): ScoredItem => ({ debateId: 'd1', speechId: 's1', memberCode: 'A', kind: 'specific_claim', targetMemberCode: null, crossesHouse: false, ...over });

describe('scoreDebates', () => {
  it('gives a point per specific claim, at most three per speech', () => {
    const [a] = scoreDebates(
      [P('A')],
      [
        ...Array.from({ length: 4 }, () => I({ speechId: 's1' })),
        I({ speechId: 's2' }),
        I({ speechId: 's2' }),
      ],
    );
    expect(a).toMatchObject({ claims: 6, claimPoints: 5, points: 5 });
  });

  it('gives three points to the member conceded TO, only across the House, and counts every concession', () => {
    const rows = scoreDebates(
      [P('A'), P('B', 'office'), P('C')],
      [
        I({ memberCode: 'B', kind: 'concession', targetMemberCode: 'A', crossesHouse: true }),
        I({ memberCode: 'C', kind: 'concession', targetMemberCode: 'A', crossesHouse: false }), // same side: counted, no points
        I({ memberCode: 'A', kind: 'concession', targetMemberCode: 'Z', crossesHouse: true }), // Z did not speak: ignored
      ],
    );
    const by = Object.fromEntries(rows.map((r) => [r.memberCode, r]));
    expect(by.A).toMatchObject({ concessionsReceived: 2, concessionPoints: 3, points: 3 });
    expect(by.B).toMatchObject({ concessionsReceived: 0, points: 0 });
  });

  it('counts questions and commitments for no points, ignores responses, and gives every speaker a row', () => {
    const rows = scoreDebates(
      [P('A'), P('B', 'office'), P('C')],
      [I({ kind: 'question' }), I({ memberCode: 'B', kind: 'commitment' }), I({ kind: 'response', targetMemberCode: 'B', crossesHouse: true })],
    );
    expect(rows.map((r) => [r.memberCode, r.questions, r.commitments, r.points])).toEqual([
      ['A', 1, 0, 0],
      ['B', 0, 1, 0],
      ['C', 0, 0, 0],
    ]);
  });

  it('keeps debates apart', () => {
    const rows = scoreDebates([P('A', 'backbench', 'd1'), P('A', 'backbench', 'd2')], [I({ debateId: 'd2', speechId: 'x' })]);
    expect(rows.map((r) => [r.debateId, r.points])).toEqual([
      ['d1', 0],
      ['d2', 1],
    ]);
  });
});

describe('termFigure', () => {
  const everyone = [
    { memberCode: 'A', role: 'backbench' as const, debates: 10, points: 20 }, // 2.0
    { memberCode: 'B', role: 'backbench' as const, debates: 5, points: 20 }, // 4.0
    { memberCode: 'C', role: 'backbench' as const, debates: 4, points: 40 }, // too few debates: not in the cohort
    { memberCode: 'D', role: 'office' as const, debates: 8, points: 8 }, // other role
  ];

  it("compares a TD with the same role's 75th percentile, from MIN_DEBATES debates", () => {
    expect(MIN_DEBATES).toBe(5);
    expect(termFigure([{ role: 'backbench', debates: 10, points: 20 }], everyone)).toEqual({
      figure: { role: 'backbench', debates: 10, points: 20, pointsPerDebate: 2 },
      cohortP75: 3.5,
      cohortSize: 2,
    });
  });

  it('uses the role with more debates (office on a tie), and gives no figure below the minimum', () => {
    expect(termFigure([{ role: 'backbench', debates: 3, points: 9 }, { role: 'office', debates: 3, points: 3 }], everyone)?.figure).toEqual({
      role: 'office',
      debates: 3,
      points: 3,
      pointsPerDebate: null,
    });
    expect(termFigure([], everyone)).toBeNull();
  });
});

describe('isGovernmentSide', () => {
  const offices: GovernmentOffices = new Map([['Indy-Minister', [{ start: '2025-01-23', end: null }]]]);

  it('is a government party member on the day, or anyone in government office', () => {
    expect(isGovernmentSide('Fianna Fáil', 'X', '2026-03-01', offices)).toBe(true);
    expect(isGovernmentSide('Fine Gael', 'X', '2026-03-01', offices)).toBe(true);
    expect(isGovernmentSide('Green Party', 'X', '2025-01-10', offices)).toBe(true);
    expect(isGovernmentSide('Green Party', 'X', '2025-02-01', offices)).toBe(false);
    expect(isGovernmentSide('Independent', 'Indy-Minister', '2026-03-01', offices)).toBe(true);
    expect(isGovernmentSide('Independent', 'Indy-Minister', '2025-01-10', offices)).toBe(false);
    expect(isGovernmentSide('Sinn Féin', 'X', '2026-03-01', offices)).toBe(false);
    expect(isGovernmentSide(null, 'X', '2026-03-01', offices)).toBe(false);
  });
});
