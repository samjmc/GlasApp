import { describe, expect, it } from 'vitest';
import type { GovernmentOffices } from './verify';
import { GOVERNMENT_SUPPORTERS, isGovernmentSide } from '../governmentSide';
import { MIN_DEBATES, TAKEN_UP_POINTS, replyNoPoints, scoreDebates, termFigure, type Participant, type ScoredItem } from './rules';

const P = (memberCode: string, role: Participant['role'] = 'backbench', debateId = 'd1'): Participant => ({ debateId, memberCode, tdId: null, role, speeches: 2, words: 500 });
const I = (over: Partial<ScoredItem>): ScoredItem => ({
  debateId: 'd1',
  speechId: 's1',
  memberCode: 'A',
  kind: 'specific_claim',
  targetMemberCode: null,
  crossesHouse: false,
  namesTarget: false,
  sameParty: false,
  closingSpeech: false,
  ...over,
});
/** A reply from `from` to `to` that names its target, scoring unless `over` says otherwise. */
const R = (from: string, to: string, over: Partial<ScoredItem> = {}) => I({ memberCode: from, kind: 'response', targetMemberCode: to, namesTarget: true, ...over });

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

  it('counts questions and commitments for no points, and gives every speaker a row', () => {
    const rows = scoreDebates([P('A'), P('B', 'office'), P('C')], [I({ kind: 'question' }), I({ memberCode: 'B', kind: 'commitment' })]);
    expect(rows.map((r) => [r.memberCode, r.questions, r.commitments, r.points])).toEqual([
      ['A', 1, 0, 0],
      ['B', 0, 1, 0],
      ['C', 0, 0, 0],
    ]);
  });

  it('gives two points per distinct speaker who takes up a point by name, each counted once', () => {
    expect(TAKEN_UP_POINTS).toBe(2);
    const rows = scoreDebates([P('A'), P('B'), P('C')], [R('B', 'A'), R('B', 'A', { speechId: 's2' }), R('C', 'A')]);
    const by = Object.fromEntries(rows.map((r) => [r.memberCode, r]));
    expect(by.A).toMatchObject({ takenUp: 2, takenUpPoints: 4, points: 4, replies: 0 });
    // Replying earns the replier nothing but the count.
    expect(by.B).toMatchObject({ replies: 2, takenUp: 0, points: 0 });
    expect(by.C).toMatchObject({ replies: 1, points: 0 });
  });

  it('shows a reply from the same party or in the closing speech, for no points', () => {
    const rows = scoreDebates([P('A'), P('B'), P('C')], [R('B', 'A', { sameParty: true }), R('C', 'A', { closingSpeech: true })]);
    const by = Object.fromEntries(rows.map((r) => [r.memberCode, r]));
    expect(by.A).toMatchObject({ takenUp: 0, takenUpPoints: 0, points: 0 });
    expect([by.B?.replies, by.C?.replies]).toEqual([1, 1]);
    expect(replyNoPoints({ sameParty: true, closingSpeech: false })).toBe('same_party');
    expect(replyNoPoints({ sameParty: true, closingSpeech: true })).toBe('closing_speech');
    expect(replyNoPoints({ sameParty: false, closingSpeech: false })).toBeNull();
  });

  it('ignores a reply that does not name its target, a reply to oneself, and one to a member who did not speak', () => {
    const rows = scoreDebates([P('A'), P('B')], [R('B', 'A', { namesTarget: false }), R('A', 'A'), R('B', 'Z')]);
    const by = Object.fromEntries(rows.map((r) => [r.memberCode, r]));
    expect(by.A).toMatchObject({ replies: 0, takenUp: 0, points: 0 });
    // The reply to Z still names Z, so it is shown and counted for B, but Z has no row to score.
    expect(by.B).toMatchObject({ replies: 1, points: 0 });
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

  it('counts a formal supporter on the government side only while they supported it', () => {
    expect(isGovernmentSide('Independent', 'Michael-Lowry.D.1987-03-10', '2026-03-01', offices)).toBe(true);
    expect(isGovernmentSide('Independent', 'Michael-Lowry.D.1987-03-10', '2025-01-10', offices)).toBe(false); // before the government formed
    expect(isGovernmentSide('Independent', 'Danny-Healy-Rae.D.2016-10-03', '2026-04-13', offices)).toBe(true);
    expect(isGovernmentSide('Independent', 'Danny-Healy-Rae.D.2016-10-03', '2026-04-14', offices)).toBe(false); // voted no confidence
  });

  it('lists every supporter with a dated range and at least one source', () => {
    for (const s of GOVERNMENT_SUPPORTERS) {
      expect(s.memberCode).toMatch(/^[A-Za-zÁÉÍÓÚáéíóú'-]+\.[DS]\.\d{4}-\d{2}-\d{2}$/);
      expect(s.to === null || s.from <= s.to).toBe(true);
      expect(s.sources.length).toBeGreaterThan(0);
      for (const url of s.sources) expect(url).toMatch(/^https:\/\//);
    }
    expect(GOVERNMENT_SUPPORTERS).toHaveLength(9);
  });
});
