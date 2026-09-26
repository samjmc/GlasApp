import { describe, expect, it } from 'vitest';
import { DIMENSION_POLES, IDEOLOGY_DIMENSIONS } from '@shared/ideology';
import { DIVISION_KINDS } from '@shared/divisionMeaning';
import type { DivisionContext } from '../parliament';
import {
  DIVISION_SYSTEM_PROMPT,
  divisionUserPrompt,
  parseDivisionClassification,
  selectSpeechContext,
  type ContextSpeech,
} from './divisionPrompt';

const json = (value: unknown) => JSON.stringify(value);
const valid = { ta_lean: { economic: -1 }, confidence: 0.8, salience: 0.6 };

describe('parseDivisionClassification', () => {
  it('clamps leans to ±2 and drops unknown, non-numeric and non-finite dimensions', () => {
    // 1e999 is valid JSON and parses to Infinity.
    const parsed = parseDivisionClassification(
      '{"ta_lean": {"economic": 3.5, "welfare": -9, "social": 1, "cultural": "high", "authority": 1e999, "vibes": 2}, "confidence": 0.8, "salience": 0.6}',
    );
    expect(parsed?.taLean).toEqual({ economic: 2, welfare: -2, social: 1 });
  });

  it('returns null for bad JSON, a missing ta_lean, or a ta_lean that is not an object', () => {
    expect(parseDivisionClassification(null)).toBeNull();
    expect(parseDivisionClassification('')).toBeNull();
    expect(parseDivisionClassification('{"ta_lean": {"economic": 1}')).toBeNull();
    expect(parseDivisionClassification(json({ nil_lean: { economic: 1 }, confidence: 1 }))).toBeNull();
    expect(parseDivisionClassification(json({ ta_lean: [1, 2] }))).toBeNull();
    expect(parseDivisionClassification(json([valid]))).toBeNull();
  });

  it('reads a missing nil_lean as the opposite of ta_lean', () => {
    const parsed = parseDivisionClassification(json({ ta_lean: { economic: -1.5, welfare: 0, social: 2 } }));
    expect(parsed?.nilLean).toEqual({ economic: 1.5, welfare: 0, social: -2 });
    expect(parseDivisionClassification(json({ ...valid, nil_lean: { economic: 0.5 } }))?.nilLean).toEqual({ economic: 0.5 });
  });

  it('clamps nil_weight, salience and confidence to 0..1; nil_weight defaults to 1', () => {
    expect(parseDivisionClassification(json(valid))?.nilWeight).toBe(1);
    expect(parseDivisionClassification(json({ ...valid, nil_weight: 'low' }))?.nilWeight).toBe(1);
    expect(parseDivisionClassification(json({ ...valid, nil_weight: 1.7, salience: -1, confidence: 4 }))).toMatchObject({
      nilWeight: 1,
      salience: 0,
      confidence: 1,
    });
    expect(parseDivisionClassification(json({ ...valid, nil_weight: -0.2 }))?.nilWeight).toBe(0);
    expect(parseDivisionClassification(json({ ...valid, nil_weight: 0.25 }))?.nilWeight).toBe(0.25);
    // Unstated confidence and salience are not guessed up: they give no evidence.
    expect(parseDivisionClassification(json({ ta_lean: { economic: 1 } }))).toMatchObject({ confidence: 0, salience: 0 });
  });

  it('keeps a known division kind and reads anything else as other', () => {
    for (const kind of DIVISION_KINDS) expect(parseDivisionClassification(json({ ...valid, division_kind: kind }))?.divisionKind).toBe(kind);
    expect(parseDivisionClassification(json({ ...valid, division_kind: 'guillotine' }))?.divisionKind).toBe('other');
    expect(parseDivisionClassification(json(valid))?.divisionKind).toBe('other');
  });

  it('reads the text and flag fields', () => {
    const parsed = parseDivisionClassification(
      json({ ...valid, ta_means: ' Defer the tax. ', procedural: true, free_vote: 'yes', policy_topic: ' housing ', reasoning: 'Because.' }),
    );
    expect(parsed).toMatchObject({ taMeans: 'Defer the tax.', procedural: true, freeVote: false, policyTopic: 'housing', reasoning: 'Because.' });
    expect(parseDivisionClassification(json({ ...valid, policy_topic: '  ' }))?.policyTopic).toBeNull();
  });
});

describe('DIVISION_SYSTEM_PROMPT', () => {
  it('names all eight dimensions with their poles, + always the right-coded pole', () => {
    for (const d of IDEOLOGY_DIMENSIONS) {
      const { negative, positive } = DIMENSION_POLES[d];
      expect(DIVISION_SYSTEM_PROMPT).toContain(`${d}: −2 = ${negative}, +2 = ${positive}`);
    }
  });

  it('explains how Dáil questions are put, including the inverted "words … stand" question', () => {
    expect(DIVISION_SYSTEM_PROMPT).toMatch(/"Amendment put": Tá = for the amendment/);
    expect(DIVISION_SYSTEM_PROMPT).toMatch(/"That the words proposed to be deleted stand": Tá = keep the original motion and reject the countermotion/);
    expect(DIVISION_SYSTEM_PROMPT).toMatch(/do now pass.*read a Second Time.*Tá = for the Bill/);
    expect(DIVISION_SYSTEM_PROMPT).toContain('Code the policy content of the proposal; do not infer it from who proposed it.');
    expect(DIVISION_SYSTEM_PROMPT).toMatch(/nil_weight low \(0–0\.3\)/);
    for (const kind of DIVISION_KINDS) expect(DIVISION_SYSTEM_PROMPT).toContain(kind);
  });
});

const speech = (over: Partial<ContextSpeech> & { text: string }): ContextSpeech => ({
  position: 0,
  name: 'Pearse Doherty',
  party: 'Sinn Féin',
  role: null,
  isPresiding: false,
  ...over,
});
const chair = (text: string) => speech({ name: 'Verona Murphy', party: 'Independent', role: 'An Ceann Comhairle', isPresiding: true, text });
const minister = (text: string) => speech({ name: 'Paschal Donohoe', party: 'Fine Gael', role: 'Minister for Finance', text });

describe('selectSpeechContext', () => {
  const opening = `${'a'.repeat(600)}OPENING-TAIL`;
  const speeches: ContextSpeech[] = [
    speech({ text: opening }),
    minister(`${'b'.repeat(600)}SECOND-TAIL\n\nSECOND-P2`),
    chair('The question is that amendment No. 1 be made.'),
    speech({ text: 'I move amendment No. 2:\n\nIn page 3, to delete lines 4 to 9.\n\nThis would defer the tax.\n\nA FOURTH paragraph nothing selects.' }),
    chair('Is that agreed? Agreed.'),
    speech({ text: 'I move amendment No. 3:' }),
    minister('I cannot accept the amendment.\n\nIt would cost €40 million.\n\nNOT-SELECTED paragraph.'),
    speech({ text: 'A LATE member speech.' }),
  ];
  const out = selectSpeechContext(speeches);

  it('keeps each "I move" paragraph and the next two, across speakers, in document order', () => {
    const order = ['I move amendment No. 2:', 'In page 3', 'This would defer the tax.', 'I move amendment No. 3:', 'I cannot accept the amendment.', 'It would cost €40 million.'];
    const at = order.map((s) => out.indexOf(s));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((x, y) => x - y));
    expect(out).not.toContain('A FOURTH paragraph');
    expect(out).not.toContain('NOT-SELECTED');
  });

  it('keeps chair speeches that put a question or an amendment, and no other chair speech', () => {
    expect(out).toContain('The question is that amendment No. 1 be made.');
    expect(out).not.toContain('Is that agreed?');
    expect(out).toContain('An Ceann Comhairle');
  });

  it('keeps the opening 600 characters of the first two member speeches', () => {
    expect(out).toContain('a'.repeat(600));
    expect(out).toContain('b'.repeat(600));
    expect(out).not.toContain('OPENING-TAIL');
    expect(out).not.toContain('SECOND-TAIL');
    expect(out).not.toContain('SECOND-P2');
    expect(out.indexOf('a'.repeat(600))).toBeLessThan(out.indexOf('b'.repeat(600)));
  });

  it('adds the last three member speeches only when asked to', () => {
    expect(out).not.toContain('A LATE member speech.');
    expect(selectSpeechContext(speeches, undefined, true)).toContain('A LATE member speech.');
  });

  it('labels each excerpt with its speaker', () => {
    expect(out).toContain('Paschal Donohoe (Fine Gael), Minister for Finance: I cannot accept the amendment.');
  });

  it('stays within the budget, filling it from the "I move" paragraphs first, still in document order', () => {
    const many = Array.from({ length: 60 }, (_, k) => speech({ text: `I move amendment No. ${k + 1}: ${'x'.repeat(300)}` }));
    const cut = selectSpeechContext(many);
    expect(cut.length).toBeLessThanOrEqual(12_000);
    expect(cut.length).toBeGreaterThan(12_000 - 400);
    expect(cut).toContain('I move amendment No. 1:');
    expect(cut).not.toContain('I move amendment No. 60:');
    expect(cut.indexOf('No. 1:')).toBeLessThan(cut.indexOf('No. 2:'));
  });

  it('uses every character of the budget it is given, and not one more', () => {
    const full = selectSpeechContext(speeches, Number.POSITIVE_INFINITY);
    expect(selectSpeechContext(speeches, full.length)).toBe(full);
    expect(selectSpeechContext(speeches, full.length - 1).length).toBeLessThan(full.length - 1);
  });

  it('is empty when there is nothing to read', () => {
    expect(selectSpeechContext([])).toBe('');
  });
});

const context: DivisionContext = {
  division: {
    id: 'dail-34-2025-06-25-vote_93',
    date: '2025-06-25',
    subject: 'Amendment put',
    debateTitle: 'Finance (Local Property Tax and Other Provisions) (Amendment) Bill 2025: Committee and Remaining Stages',
    outcome: 'Lost',
    isBill: false,
    taCount: 67,
    nilCount: 83,
    staonCount: 0,
    debateSectionId: 'dail-2025-06-25-dbsect_19',
    heldAt: '2025-06-25T08:00:00.000Z',
    sectionPosition: null,
  },
  section: { id: 'dail-2025-06-25-dbsect_19', date: '2025-06-25', title: 'Finance (Local Property Tax and Other Provisions) (Amendment) Bill 2025: Committee and Remaining Stages' },
  siblings: [
    { id: 'dail-34-2025-06-25-vote_91', date: '2025-06-25', subject: 'Amendment put', debateTitle: null, outcome: 'Lost', isBill: false, taCount: 64, nilCount: 82, staonCount: 0, sectionPosition: null },
    { id: 'dail-34-2025-06-25-vote_92', date: '2025-06-25', subject: 'Amendment put', debateTitle: null, outcome: 'Lost', isBill: false, taCount: 47, nilCount: 104, staonCount: 0, sectionPosition: null },
    { id: 'dail-34-2025-06-25-vote_93', date: '2025-06-25', subject: 'Amendment put', debateTitle: null, outcome: 'Lost', isBill: false, taCount: 67, nilCount: 83, staonCount: 0, sectionPosition: null },
  ],
  index: 3,
  speeches: [speech({ text: 'I move amendment No. 5:' }), minister('I cannot accept the amendment.')],
  bills: [
    {
      id: '2025-32',
      shortTitle: 'Finance (Local Property Tax and Other Provisions) (Amendment) Bill 2025',
      longTitle: 'An Act to amend the Finance (Local Property Tax) Act 2012.',
      source: 'Government',
      primarySponsor: { label: 'Minister for Finance', party: null },
    },
    { id: '2025-999', shortTitle: 'Test Bill 2025', longTitle: null, source: 'Private Member', primarySponsor: { label: 'Cian O’Callaghan', party: 'Social Democrats' } },
  ],
  government: { parties: ['Fianna Fáil', 'Fine Gael'], independents: ['Seán Canney'] },
};

describe('divisionUserPrompt', () => {
  const prompt = divisionUserPrompt(context);

  it('states the question, the debate, the outcome and the tallies', () => {
    expect(prompt).toContain('2025-06-25');
    expect(prompt).toContain('Amendment put');
    expect(prompt).toContain(context.division.debateTitle!);
    expect(prompt).toContain('Lost (Tá 67, Níl 83, Staon 0)');
  });

  it('places the division among its siblings: "k of n"', () => {
    expect(prompt).toContain('This is division 3 of 3 in this debate');
    expect(prompt).toContain('Tá 47, Níl 104');
  });

  it('names the bills, their source and primary sponsor, and the government', () => {
    expect(prompt).toContain('An Act to amend the Finance (Local Property Tax) Act 2012.');
    expect(prompt).toContain('Private Member bill; primary sponsor Cian O’Callaghan, Social Democrats');
    expect(prompt).toContain('Fianna Fáil, Fine Gael');
    expect(prompt).toContain('Seán Canney');
    expect(prompt).toContain('I cannot accept the amendment.');
  });

  it('never gives how each party voted, even when the caller has it', () => {
    // divisionDetail() carries byParty; a caller that spreads it in must not leak it.
    const withByParty = {
      ...context,
      division: { ...context.division, byParty: [{ party: 'Aontú', ta: 37, nil: 0, staon: 0 }] },
    } as DivisionContext;
    const leaked = divisionUserPrompt(withByParty);
    expect(leaked).toBe(prompt);
    expect(leaked).not.toMatch(/Aontú|by party/i);
  });

  it('says so when there is no debate record', () => {
    expect(divisionUserPrompt({ ...context, speeches: [] })).toContain('No debate record is available for this division.');
  });
});
