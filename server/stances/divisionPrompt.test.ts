import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIVISION_KINDS } from '@shared/divisionMeaning';
import type { DivisionContext } from '../parliament';
import { parseTranscript } from '../parliament/parse';
import {
  FIT_SYSTEM_PROMPT,
  MATCH_SYSTEM_PROMPT,
  MEANING_SYSTEM_PROMPT,
  MOVED_TEXT_CHARS,
  divisionUserPrompt,
  fitUserPrompt,
  matchUserPrompt,
  parseFit,
  parseMatch,
  parseMeaning,
  proposalBlocks,
  selectSpeechContext,
  type ContextSpeech,
} from './divisionPrompt';

const json = (value: unknown) => JSON.stringify(value);
const meaning = { procedural: false, division_kind: 'amendment', ta_means: ' For the report. ', quote_block: ' A1 ', quote: 'q', policy_domains: [' Housing '], confidence: 0.8 };

describe('parseMeaning', () => {
  it('reads every field, trimming text and lower-casing domains', () => {
    expect(parseMeaning(json(meaning))).toEqual({
      procedural: false,
      divisionKind: 'amendment',
      taMeans: 'For the report.',
      quoteBlock: 'A1',
      quote: 'q',
      policyDomains: ['housing'],
      confidence: 0.8,
    });
  });

  it('is null for bad JSON, a missing or unknown kind, or a wrong type; it never guesses a kind', () => {
    expect(parseMeaning(null)).toBeNull();
    expect(parseMeaning('{"division_kind": "amendment"')).toBeNull();
    expect(parseMeaning(json({ ...meaning, division_kind: undefined }))).toBeNull();
    expect(parseMeaning(json({ ...meaning, division_kind: 'guillotine' }))).toBeNull();
    expect(parseMeaning(json({ ...meaning, policy_domains: 'housing' }))).toBeNull();
    expect(parseMeaning(json([meaning]))).toBeNull();
  });

  it('a procedural reply needs no quote; confidence is clamped to 0..1, unstated = 0', () => {
    expect(parseMeaning(json({ division_kind: 'procedural', procedural: true }))).toMatchObject({ procedural: true, quote: '', policyDomains: [], confidence: 0 });
    expect(parseMeaning(json({ ...meaning, confidence: 4 }))?.confidence).toBe(1);
  });
});

describe('parseMatch', () => {
  it('reads a match, a Níl answer and a null', () => {
    expect(parseMatch(json({ question_id: 3, ta_option: 'option_a', nil_option: 'option_b', confidence: 0.9, reason: ' r ' }))).toEqual({
      questionId: 3,
      taOption: 'option_a',
      nilOption: 'option_b',
      confidence: 0.9,
      reason: 'r',
    });
    expect(parseMatch(json({ question_id: null }))).toMatchObject({ questionId: null, taOption: null, nilOption: null, confidence: 0 });
  });

  it('is null for bad JSON or a wrong shape', () => {
    expect(parseMatch('nope')).toBeNull();
    expect(parseMatch(json({ question_id: '3', ta_option: 'option_a' }))).toBeNull();
    expect(parseMatch(json({ ta_option: 'option_a' }))).toBeNull();
  });
});

describe('parseFit', () => {
  it('reads the claims the vote does not state, trimmed, without blanks, at most five', () => {
    expect(parseFit(json({ unstated: [' accepts little immediate help ', '', '  '] }))).toEqual(['accepts little immediate help']);
    expect(parseFit(json({ unstated: [] }))).toEqual([]);
    expect(parseFit(json({ unstated: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }))).toHaveLength(5);
  });

  it('is null for bad JSON or a wrong shape, so an unusable check is never read as "nothing unstated"', () => {
    expect(parseFit(null)).toBeNull();
    expect(parseFit('nope')).toBeNull();
    expect(parseFit(json({}))).toBeNull();
    expect(parseFit(json({ unstated: 'a claim' }))).toBeNull();
    expect(parseFit(json({ unstated: [1] }))).toBeNull();
  });
});

describe('the claims check prompt', () => {
  it('asks only for claims the vote does not state, and a reason is not a claim', () => {
    expect(FIT_SYSTEM_PROMPT).toMatch(/List every claim that is NOT stated/);
    expect(FIT_SYSTEM_PROMPT).toMatch(/A reason given for a claim is not itself a claim/);
    expect(FIT_SYSTEM_PROMPT).toMatch(/an accepted cost the proposal does not mention/);
    const prompt = fitUserPrompt({ taMeans: 'Cut bills.', quote: 'adopt the plan', answer: 'Invest long term, accepting little cash now' });
    expect(prompt).toContain('Cut bills.');
    expect(prompt).toContain('"adopt the plan"');
    expect(prompt).toContain('"Invest long term, accepting little cash now"');
  });
});

describe('the system prompts', () => {
  it('meaning: how Dáil questions are put, every kind, and no axis numbers', () => {
    expect(MEANING_SYSTEM_PROMPT).toMatch(/"Amendment put".*Tá = for the amendment/);
    expect(MEANING_SYSTEM_PROMPT).toMatch(/"That the words proposed to be deleted stand": division_kind "words_stand"; Tá = keep the original motion and reject the countermotion/);
    expect(MEANING_SYSTEM_PROMPT).toMatch(/"That the motion, as amended, be agreed to": division_kind "as_amended"/);
    expect(MEANING_SYSTEM_PROMPT).toContain('Code the policy content of the proposal; do not infer it from who proposed it.');
    for (const kind of DIVISION_KINDS) expect(MEANING_SYSTEM_PROMPT).toContain(kind);
    // No axis numbers of any kind: a vector only ever comes from the option chosen.
    expect(MEANING_SYSTEM_PROMPT).not.toMatch(/_lean\b|−2|\+2|axis|axes/i);
  });

  it('match: an answer only when it is stated, never from who proposed it', () => {
    expect(MATCH_SYSTEM_PROMPT).toMatch(/ONLY when what a Tá vote supported itself states that choice/);
    expect(MATCH_SYSTEM_PROMPT).toMatch(/Never infer an answer from who proposed the motion/);
    expect(MATCH_SYSTEM_PROMPT).toMatch(/Give a Níl answer only when voting against the proposal itself states/);
  });

  it('match prompt: the meaning, the quote and each candidate with its keyed answers; no tallies', () => {
    const prompt = matchUserPrompt({ taMeans: 'Build homes.', quote: 'calls on the Government to build homes', divisionKind: 'words_stand' }, [
      { id: 7, question: 'How should the State meet housing demand?', options: [{ key: 'option_a', label: 'Build public homes' }, { key: 'option_b', label: 'Leave it to the market' }] },
    ]);
    expect(prompt).toContain('Build homes.');
    expect(prompt).toContain('"calls on the Government to build homes"');
    expect(prompt).toContain('question_id 7: How should the State meet housing demand?');
    expect(prompt).toContain('option_b: Leave it to the market');
    expect(prompt).not.toMatch(/Tá \d|Níl \d/);
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
    expect(out).toContain('Verona Murphy: The question is that amendment No. 1 be made.');
    expect(out).not.toContain('Is that agreed?');
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

  it('labels each excerpt with its speaker by name only: no party, no role', () => {
    expect(out).toContain('Paschal Donohoe: I cannot accept the amendment.');
    expect(out).not.toMatch(/Fine Gael|Sinn Féin|Independent|Minister for Finance|Ceann Comhairle/);
  });

  const many = Array.from({ length: 60 }, (_, k) => speech({ text: `I move amendment No. ${k + 1}: ${'x'.repeat(300)}` }));

  it('stays within the budget, filling it from the "I move" paragraphs first, still in document order', () => {
    const cut = selectSpeechContext(many);
    expect(cut.length).toBeLessThanOrEqual(12_000);
    expect(cut.length).toBeGreaterThan(12_000 - 400);
    expect(cut).toContain('I move amendment No. 1:');
    expect(cut).not.toContain('I move amendment No. 60:');
    expect(cut.indexOf('No. 1:')).toBeLessThan(cut.indexOf('No. 2:'));
  });

  it('for a division placed in a long debate, fills the budget from the motions nearest the vote, still in document order', () => {
    const cut = selectSpeechContext(many, undefined, false, true);
    expect(cut.length).toBeLessThanOrEqual(12_000);
    expect(cut).toContain('I move amendment No. 60:');
    expect(cut).not.toContain('I move amendment No. 1:');
    expect(cut.indexOf('No. 59:')).toBeLessThan(cut.indexOf('No. 60:'));
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

  it("gives each bill's long title as a PROPOSAL block, and neither its source nor its sponsor", () => {
    expect(prompt).toContain('[B1] An Act to amend the Finance (Local Property Tax) Act 2012.');
    expect(prompt).toContain('[B2] Test Bill 2025');
    expect(prompt).toContain('[A1] I move amendment No. 5:');
    expect(prompt).not.toMatch(/Government|Private Member|sponsor|Minister for Finance|O’Callaghan/);
    expect(prompt).toContain('I cannot accept the amendment.');
  });

  it('names no party anywhere: not for a speaker, a sponsor, or the government', () => {
    // A party in the prompt lets the model read the proposal by who made it, and makes the
    // audit (which compares readings with the lobbies' party baselines) check the model against itself.
    const parties = [
      ...context.speeches.map((s) => s.party),
      ...context.bills.map((b) => b.primarySponsor?.party),
      'Fianna Fáil',
      'Fine Gael',
      'Sinn Féin',
      'Social Democrats',
      'Independent',
    ].filter((p): p is string => Boolean(p));
    expect(parties).toEqual(expect.arrayContaining(['Sinn Féin', 'Fine Gael', 'Social Democrats']));
    for (const party of parties) expect(prompt).not.toContain(party);
    expect(prompt).not.toMatch(/government parties|independent ministers/i);
  });

  it('for a placed division in a long debate, reads the motions nearest the vote', () => {
    const long = Array.from({ length: 60 }, (_, k) => speech({ position: k, text: `I move amendment No. ${k + 1}: ${'x'.repeat(300)}` }));
    const placed = divisionUserPrompt({ ...context, division: { ...context.division, sectionPosition: 60 }, speeches: long });
    expect(placed).toContain('I move amendment No. 60:');
    expect(placed).not.toContain('I move amendment No. 1:');
    // Not placed: the whole section, and no way to know which end matters.
    expect(divisionUserPrompt({ ...context, speeches: long })).toContain('I move amendment No. 1:');
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

describe('proposalBlocks', () => {
  // The real 2025-06-25 transcript: dbsect_19 is the Finance Bill's committee stage.
  const transcript = fs.readFileSync(path.join(__dirname, '../parliament/__fixtures__/transcript-2025-06-25.xml'), 'utf8');
  const parsed = parseTranscript(transcript, '2025-06-25');
  const fixtureSpeeches: ContextSpeech[] = parsed.speeches
    .filter((s) => s.sectionId === 'dail-2025-06-25-dbsect_19')
    .map((s) => ({ position: s.position, name: s.role, party: null, role: s.role, isPresiding: s.isPresiding, text: s.text }));
  const fixture = { ...context, speeches: fixtureSpeeches };

  it('Q is the subject; B each long title, with no source or sponsor', () => {
    const blocks = proposalBlocks(fixture);
    expect(blocks.slice(0, 3)).toEqual([
      { label: 'Q', kind: 'Q', text: 'Amendment put' },
      { label: 'B1', kind: 'B', text: 'An Act to amend the Finance (Local Property Tax) Act 2012.' },
      { label: 'B2', kind: 'B', text: 'Test Bill 2025' },
    ]);
    expect(blocks.map((b) => b.text).join(' ')).not.toMatch(/Government|Private Member|O’Callaghan/);
  });

  it('an "I move" block holds its own speech only: A1 is amendment No. 1 and its text, never the Minister’s reply', () => {
    const a1 = proposalBlocks(fixture).find((b) => b.label === 'A1')!;
    expect(a1.text.startsWith('I move amendment No. 1:')).toBe(true);
    expect(a1.text).toContain('In page 3, between lines 23 and 24, to insert the following:');
    expect(a1.text).toContain('defective concrete blocks');
    expect(a1.text).not.toContain('I thank the Deputy for raising this matter');
  });

  it('"I move amendment" is an A block, any other "I move" an M block, numbered in document order', () => {
    const blocks = proposalBlocks({
      ...context,
      speeches: [
        speech({ text: 'I move:\n\nThat Dáil Éireann calls on the Government to build homes.' }),
        minister('I move amendment No. 1:\n\nTo delete all words after "That Dáil Éireann" and substitute the following.\n\nI move amendment No. 2:\n\nIn page 4, line 2, to delete "may".'),
      ],
    });
    expect(blocks.filter((b) => b.kind === 'M' || b.kind === 'A').map((b) => [b.label, b.text.split('\n')[0]])).toEqual([
      ['M1', 'I move:'],
      ['A1', 'I move amendment No. 1:'],
      ['A2', 'I move amendment No. 2:'],
    ]);
    // A block stops at the next "I move", even in the same speech.
    expect(blocks.find((b) => b.label === 'A1')!.text).not.toContain('No. 2');
  });

  it('a moved block takes whole paragraphs, up to MOVED_TEXT_CHARS', () => {
    const long = `${'w '.repeat(1_500)}LONG-PARAGRAPH`;
    const [block] = proposalBlocks({ ...context, bills: [], division: { ...context.division, subject: null }, speeches: [speech({ text: `I move amendment No. 9:\n\nShort text.\n\n${long}` })] });
    expect(block!.text).toBe('I move amendment No. 9:\n\nShort text.');
    expect(MOVED_TEXT_CHARS).toBe(3_000);
  });

  it('within the budget, keeps Q and B, then whole blocks: the earliest, or the nearest the vote when placed', () => {
    const many = Array.from({ length: 10 }, (_, k) => speech({ text: `I move amendment No. ${k + 1}: ${'x'.repeat(90)}` }));
    const small = { ...context, speeches: many };
    const early = proposalBlocks(small, 400);
    expect(early.map((b) => b.label)).toEqual(['Q', 'B1', 'B2', 'A1', 'A2']);
    expect(early.at(-1)!.text).toContain('No. 2:');
    const late = proposalBlocks({ ...small, division: { ...small.division, sectionPosition: 10 } }, 400);
    expect(late.map((b) => b.text.slice(0, 22))).toEqual(['Amendment put', expect.any(String), 'Test Bill 2025', 'I move amendment No. 9', 'I move amendment No. 1']);
    expect(late.at(-1)!.text).toContain('No. 10:');
    expect(late.map((b) => b.label).slice(3)).toEqual(['A1', 'A2']);
  });
});
