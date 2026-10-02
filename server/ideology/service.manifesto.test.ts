/**
 * The manifesto enters the party match target at read time (server/partyQuiz/position). With no
 * approved sheet, matchesFor and partyProfile must send exactly what they sent before 02c.
 */
import { describe, expect, it, vi } from 'vitest';
import { IDEOLOGY_DIMENSIONS, emptyIdeologyVector, type IdeologyDimension } from '@shared/ideology';
import type { PartyIdeology } from '@shared/ideologyMatch';
import type { PartyQuizItem, PartyQuizSheet } from '@shared/partyQuiz';
import { QUIZ_QUESTIONS, type QuizQuestion } from '@shared/quiz';
import type { IdeologyProfileRow } from '@shared/schema/quiz';
import { questionFingerprint } from '../quiz/fingerprint';
import { alignment } from './alignment';
import type { EvidenceSummary, TdRef } from './repository';

const fake = vi.hoisted(() => ({
  sheets: [] as PartyQuizSheet[],
  tds: [] as TdRef[],
  tdProfiles: [] as IdeologyProfileRow[],
  partyProfiles: [] as IdeologyProfileRow[],
  evidence: new Map<number, EvidenceSummary>(),
}));

vi.mock('../partyQuiz/sheets', () => ({ SHEETS: fake.sheets }));
vi.mock('../voting', () => ({ listUserVoteVectors: vi.fn(async () => []), questionsWithPositions: vi.fn(async () => []) }));
vi.mock('../stances/repository', () => ({ mappedStancesOn: vi.fn(async () => []) }));
vi.mock('./repository', async () => {
  const { IDEOLOGY_DIMENSIONS } = await import('@shared/ideology');
  return {
    vectorOf: (row: Record<string, number>) => Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, row[d]])),
    listActiveTds: async () => fake.tds,
    listProfiles: async (kind: string) => (kind === 'td' ? fake.tdProfiles : fake.partyProfiles),
    evidenceSummary: async () => fake.evidence,
  };
});

const COMPUTED_AT = new Date('2026-09-20T10:00:00.000Z');
const row = (subjectKind: string, subjectId: string, v: number[], totalWeight: number, evidenceCount: number): IdeologyProfileRow => {
  const [economic, social, cultural, authority, environmental, welfare, globalism, technocratic] = v as [number, number, number, number, number, number, number, number];
  return { subjectKind, subjectId, economic, social, cultural, authority, environmental, welfare, globalism, technocratic, totalWeight, evidenceCount, computedAt: COMPUTED_AT };
};
const td = (id: number, name: string, party: string | null): TdRef => ({ id, name, party, constituency: `Constituency ${id}`, imageUrl: null });

fake.tds.push(
  td(1, 'FG Deputy', 'Fine Gael'),
  td(2, 'SF Deputy', 'Sinn Féin'),
  td(3, 'RDR Deputy', '100% RDR'),
  td(4, 'Independent Deputy', 'Independent'),
  td(5, 'New Deputy', 'Brand New Party'),
);
fake.tdProfiles.push(
  row('td', '1', [2.5, 1, 2.5, 3, 0.5, 0.8, -0.5, -4], 2.5, 2),
  row('td', '2', [-6, -2, 1, 5, -3, -7, 3, 0], 0, 0),
  row('td', '3', [-3, 4, 0, 0, 0, 0, 0, 0], 1.2, 2),
  row('td', '4', [1, -2, 3, -1, 0, 0, 0, 0], 3.5, 4),
  row('td', '5', [-2, 3, 5, 4, 2, 0, 0, 0], 4, 5),
);
fake.partyProfiles.push(
  row('party', 'Fine Gael', [2.5, 1, 2.5, 3, 0.5, 0.8, -0.5, -4], 2.5, 1),
  row('party', 'Sinn Féin', [-6, -2, 1, 5, -3, -7, 3, 0], 0, 1),
  row('party', '100% RDR', [-3, 4, 0, 0, 0, 0, 0, 0], 1.2, 1),
  row('party', 'Brand New Party', [-2, 3, 5, 4, 2, 0, 0, 0], 4, 1),
);
fake.evidence.set(1, { bySource: { stance: 2 }, measured: ['economic', 'welfare'] });
fake.evidence.set(3, { bySource: { stance: 2 }, measured: ['economic', 'social'] });
fake.evidence.set(4, { bySource: { stance: 3, debate: 1 }, measured: ['economic', 'social', 'cultural', 'authority'] });
fake.evidence.set(5, { bySource: { debate: 5 }, measured: ['economic', 'social', 'cultural', 'authority', 'environmental'] });

const USER = { economic: -4, social: 2, cultural: 1, authority: -3, environmental: -6, welfare: -5, globalism: 3, technocratic: 2 };
const WEIGHTS = { welfare: 2, technocratic: 0 };

/** A fresh service, so position.ts's per-party memo starts empty for each set of sheets. */
async function load(sheets: PartyQuizSheet[]) {
  fake.sheets.splice(0, fake.sheets.length, ...sheets);
  vi.resetModules();
  return import('./service');
}

/** What the API sends. */
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// The inline snapshots below are the golden copy: captured by running this file on main 9ee063c,
// before 02c. Only the fields 02c adds are taken out before comparing; they are checked apart.
describe('with no approved sheet (SHEETS is empty on main)', () => {
  it('matchesFor sends exactly what it sent before 02c, plus manifesto: null', async () => {
    const { matchesFor } = await load([]);
    const result = json(await matchesFor(USER, WEIGHTS));
    expect(result.parties.map((p) => p.manifesto)).toEqual([null, null, null]);
    const before = { ...result, parties: result.parties.map(({ manifesto: _added, ...rest }) => rest) };
    expect(before).toMatchInlineSnapshot(`
      {
        "parties": [
          {
            "alignment": 87,
            "closest": [
              "cultural",
              "globalism",
            ],
            "confidence": "none",
            "furthest": [
              "authority",
              "social",
            ],
            "hasPartyBaseline": true,
            "party": "Sinn Féin",
            "tdCount": 1,
          },
          {
            "alignment": 78,
            "closest": [
              "social",
              "economic",
            ],
            "confidence": "medium",
            "furthest": [
              "environmental",
              "authority",
            ],
            "hasPartyBaseline": false,
            "party": "Brand New Party",
            "tdCount": 1,
          },
          {
            "alignment": 77,
            "closest": [
              "social",
              "cultural",
            ],
            "confidence": "low",
            "furthest": [
              "environmental",
              "economic",
            ],
            "hasPartyBaseline": true,
            "party": "Fine Gael",
            "tdCount": 1,
          },
        ],
        "tds": [
          {
            "alignment": 87,
            "closest": [
              "cultural",
              "globalism",
            ],
            "confidence": "none",
            "constituency": "Constituency 2",
            "evidenceBySource": {},
            "evidenceCount": 0,
            "furthest": [
              "authority",
              "social",
            ],
            "hasPartyBaseline": true,
            "imageUrl": null,
            "measured": [],
            "name": "SF Deputy",
            "party": "Sinn Féin",
            "tdId": 2,
          },
          {
            "alignment": 84,
            "closest": [
              "cultural",
              "authority",
            ],
            "confidence": "medium",
            "constituency": "Constituency 4",
            "evidenceBySource": {
              "debate": 1,
              "stance": 3,
            },
            "evidenceCount": 4,
            "furthest": [
              "economic",
              "social",
            ],
            "hasPartyBaseline": false,
            "imageUrl": null,
            "measured": [
              "economic",
              "social",
              "cultural",
              "authority",
            ],
            "name": "Independent Deputy",
            "party": "Independent",
            "tdId": 4,
          },
          {
            "alignment": 78,
            "closest": [
              "social",
              "economic",
            ],
            "confidence": "medium",
            "constituency": "Constituency 5",
            "evidenceBySource": {
              "debate": 5,
            },
            "evidenceCount": 5,
            "furthest": [
              "environmental",
              "authority",
            ],
            "hasPartyBaseline": false,
            "imageUrl": null,
            "measured": [
              "economic",
              "social",
              "cultural",
              "authority",
              "environmental",
            ],
            "name": "New Deputy",
            "party": "Brand New Party",
            "tdId": 5,
          },
          {
            "alignment": 77,
            "closest": [
              "social",
              "cultural",
            ],
            "confidence": "low",
            "constituency": "Constituency 1",
            "evidenceBySource": {
              "stance": 2,
            },
            "evidenceCount": 2,
            "furthest": [
              "environmental",
              "economic",
            ],
            "hasPartyBaseline": true,
            "imageUrl": null,
            "measured": [
              "economic",
              "welfare",
            ],
            "name": "FG Deputy",
            "party": "Fine Gael",
            "tdId": 1,
          },
        ],
      }
    `);
  });

  it('partyProfile sends exactly what it sent before 02c, plus tdMean = vector and no manifesto', async () => {
    const { partyProfile } = await load([]);
    const [fg, rdr] = [json(await partyProfile('fine gael'))!, json(await partyProfile('100% RDR'))!];
    expect(fg).toMatchObject({ tdMean: fg.vector, manifesto: null, hasPartyBaseline: true, measured: [...IDEOLOGY_DIMENSIONS] });
    // No baseline: only the dimensions its TDs have evidence on are a position.
    expect(rdr).toMatchObject({ tdMean: rdr.vector, manifesto: null, hasPartyBaseline: false, measured: ['economic', 'social'] });
    const before = ({ tdMean: _t, manifesto: _m, hasPartyBaseline: _h, measured: _d, ...rest }: PartyIdeology) => rest;
    expect(before(fg)).toMatchInlineSnapshot(`
      {
        "computedAt": "2026-09-20T10:00:00.000Z",
        "party": "Fine Gael",
        "tdCount": 1,
        "vector": {
          "authority": 3,
          "cultural": 2.5,
          "economic": 2.5,
          "environmental": 0.5,
          "globalism": -0.5,
          "social": 1,
          "technocratic": -4,
          "welfare": 0.8,
        },
      }
    `);
    expect(before(rdr)).toMatchInlineSnapshot(`
      {
        "computedAt": "2026-09-20T10:00:00.000Z",
        "party": "100% RDR",
        "tdCount": 1,
        "vector": {
          "authority": 0,
          "cultural": 0,
          "economic": -3,
          "environmental": 0,
          "globalism": 0,
          "social": 4,
          "technocratic": 0,
          "welfare": 0,
        },
      }
    `);
    expect(await partyProfile('Nobody')).toBeNull();
  });
});

// Real bank questions, answered at their extremes, so m is ±10 on each covered dimension.
const onDimension = (d: IdeologyDimension) => QUIZ_QUESTIONS.filter((q) => q.dimension === d);
const extreme = (q: QuizQuestion, sign: 1 | -1) =>
  q.answers.reduce((best, a, i) => (sign * a.value > sign * q.answers[best]!.value ? i : best), 0);
const item = (q: QuizQuestion, answerIndex: number, review: PartyQuizItem['review'] = 'approved'): PartyQuizItem => ({
  questionId: q.id, fingerprint: questionFingerprint(q), status: 'answered', answerIndex, abstainReason: null,
  quotes: [], rationale: 'r', modelConfidence: 0.9, review,
});
const sheetOf = (party: string, items: PartyQuizItem[]): PartyQuizSheet => ({
  party, election: 'ge2024', documents: [], model: 'deepseek-flash', promptVersion: 'v1', items,
});

const [e1, e2] = onDimension('economic') as [QuizQuestion, QuizQuestion];
const [w1] = onDimension('welfare') as [QuizQuestion];
const [c1] = onDimension('cultural') as [QuizQuestion];
const [a1] = onDimension('authority') as [QuizQuestion];
/** Two economic answers at the collective pole; a pending welfare answer that must not count. */
const FG_SHEET = sheetOf('Fine Gael', [item(e1, extreme(e1, -1)), item(e2, extreme(e2, -1)), item(w1, 0, 'pending')]);
/** Two dimensions 100% RDR's TDs have no evidence on. */
const RDR_SHEET = sheetOf('100% RDR', [item(c1, extreme(c1, 1)), item(a1, extreme(a1, 1))]);

const FG_ROW = { economic: 2.5, social: 1, cultural: 2.5, authority: 3, environmental: 0.5, welfare: 0.8, globalism: -0.5, technocratic: -4 };
const c = 2 / onDimension('economic').length;
const FG_BLEND = { ...FG_ROW, economic: Math.round((c * -10 + (1 - c) * FG_ROW.economic) * 100) / 100 };

describe('with an approved sheet', () => {
  it('partyProfile: the vector is c·m + (1−c)·t on the covered dimensions; tdMean is the stored row', async () => {
    const { partyProfile } = await load([FG_SHEET]);
    const fg = json(await partyProfile('Fine Gael'))!;
    expect(fg.vector).toEqual(FG_BLEND);
    expect(fg.vector.economic).not.toBe(FG_ROW.economic);
    expect(fg.tdMean).toEqual(FG_ROW);
    expect(fg.manifesto).toEqual({ coverage: { ...emptyIdeologyVector(), economic: c }, answeredCount: 2 });
  });

  it('matchesFor: a party is matched on its blend; TD matches are untouched', async () => {
    const withSheet = await (await load([FG_SHEET])).matchesFor(USER, WEIGHTS);
    const fg = withSheet.parties.find((p) => p.party === 'Fine Gael')!;
    expect(fg.alignment).toBe(alignment(USER, FG_BLEND, WEIGHTS));
    expect(fg.alignment).not.toBe(alignment(USER, FG_ROW, WEIGHTS));
    expect(fg.manifesto).toEqual({ coverage: { ...emptyIdeologyVector(), economic: c }, answeredCount: 2 });
    const without = await (await load([])).matchesFor(USER, WEIGHTS);
    expect(json(withSheet.tds)).toEqual(json(without.tds));
  });

  it('matchesFor: manifesto dimensions count as measured for a party with no baseline', async () => {
    // 100% RDR's TDs measure 2 dimensions, so it is not listed; the manifesto adds 2, making 4.
    const { parties } = await (await load([RDR_SHEET])).matchesFor(USER, WEIGHTS);
    // Matched on economic, social (t), cultural, authority (m = +10); every other weight is 0:
    // gaps 1, 2, 9, 13 of 4 × 20 → 100 × (1 − 25/80) = 68.75.
    expect(parties.find((p) => p.party === '100% RDR')).toMatchObject({
      alignment: 69, closest: ['economic', 'social'], furthest: ['authority', 'cultural'], hasPartyBaseline: false,
    });
    const one = sheetOf('100% RDR', [item(c1, extreme(c1, 1))]);
    const three = await (await load([one])).matchesFor(USER, WEIGHTS);
    expect(three.parties.map((p) => p.party)).not.toContain('100% RDR');
  });

  it('partyProfile: a party with no baseline takes m on a dimension its TDs have not measured', async () => {
    const { partyProfile } = await load([RDR_SHEET]);
    const rdr = json(await partyProfile('100% RDR'))!;
    expect(rdr.vector).toEqual({ ...emptyIdeologyVector(), economic: -3, social: 4, cultural: 10, authority: 10 });
    expect(rdr.measured).toEqual(['economic', 'social', 'cultural', 'authority']);
  });
});
