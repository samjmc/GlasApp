import { describe, expect, it } from 'vitest';
import type { ProposalBlock, MatchReply, MeaningReply } from './divisionPrompt';
import { ALLOWED_BLOCKS, MIN_MATCH_CONFIDENCE, MIN_MEANING_CONFIDENCE, figuresIn, verifyMatch, verifyMeaning } from './divisionVerify';

const MOTION =
  'That Dáil Éireann calls on the Government to build fifty thousand public homes every year on public land, and to end the use of tax reliefs for investment funds.';
const COUNTERMOTION =
  'To delete all words after “That Dáil Éireann” and substitute the following: “notes the Government’s Housing for All plan and its targets for the delivery of social and affordable homes”.';
const QUOTE_FROM_MOTION = 'calls on the Government to build fifty thousand public homes every year on public land';

const block = (label: string, text: string): ProposalBlock => ({ label, kind: label[0] as ProposalBlock['kind'], text });
/** A Private Members' motion (M1) and the Government's countermotion, moved as amendment No. 1 (A1). */
const PMM = [block('Q', 'Question put'), block('M1', `I move:\n\n${MOTION}`), block('A1', `I move amendment No. 1:\n\n${COUNTERMOTION}`)];

const reply = (over: Partial<MeaningReply> = {}): MeaningReply => ({
  procedural: false,
  divisionKind: 'words_stand',
  taMeans: 'Keep the motion calling for public homes.',
  quoteBlock: 'M1',
  quote: QUOTE_FROM_MOTION,
  policyDomains: ['housing'],
  confidence: 0.8,
  ...over,
});

describe('verifyMeaning: the as-amended and countermotion questions (GApp 3b)', () => {
  it('(i) words stand: a quote from the motion passes; one from the countermotion is invalid', () => {
    expect(verifyMeaning(reply(), PMM)).toMatchObject({ status: 'ok', block: 'M1', quote: QUOTE_FROM_MOTION, domains: ['housing'] });
    expect(verifyMeaning(reply({ quoteBlock: 'A1', quote: 'notes the Government’s Housing for All plan and its targets for the delivery of social' }), PMM)).toEqual({
      status: 'rejected',
      reason: 'invalid',
    });
  });

  it('(ii) "motion, as amended": ambiguous, whatever the quote', () => {
    expect(verifyMeaning(reply({ divisionKind: 'as_amended' }), PMM)).toEqual({ status: 'rejected', reason: 'ambiguous' });
  });

  it('(iii) an amendment division: one amendment block passes, two (unplaced) are ambiguous', () => {
    const amendment = reply({ divisionKind: 'amendment', quoteBlock: 'A1', quote: 'delete all words after “That Dáil Éireann” and substitute the following' });
    expect(verifyMeaning(amendment, PMM)).toMatchObject({ status: 'ok', block: 'A1' });
    expect(verifyMeaning(amendment, [...PMM, block('A2', 'I move amendment No. 2:\n\nIn page 4, line 2, to delete “may” and substitute “shall” in every case.')])).toEqual({
      status: 'rejected',
      reason: 'ambiguous',
    });
  });

  it('(iv) unclear: ambiguous', () => {
    expect(verifyMeaning(reply({ divisionKind: 'unclear' }), PMM)).toEqual({ status: 'rejected', reason: 'ambiguous' });
  });
});

describe('verifyMeaning', () => {
  it('matches across curly quotes, fadas, case and spacing, and stores the passage as the block has it', () => {
    const typed = 'Delete all words after "That Dail Eireann"   and substitute the following';
    expect(verifyMeaning(reply({ divisionKind: 'amendment', quoteBlock: 'A1', quote: typed }), PMM)).toMatchObject({
      status: 'ok',
      quote: 'delete all words after “That Dáil Éireann” and substitute the following',
    });
  });

  it('a quote found only in another block, or only in the excerpts, is quote_not_found', () => {
    expect(verifyMeaning(reply({ quoteBlock: 'M1', quote: 'notes the Government’s Housing for All plan and its targets' }), PMM)).toEqual({
      status: 'rejected',
      reason: 'quote_not_found',
    });
    expect(verifyMeaning(reply({ quote: 'I thank the Deputy for raising this matter this evening in the House' }), PMM)).toEqual({ status: 'rejected', reason: 'quote_not_found' });
  });

  it('a quote of 7 or 61 words, or with an ellipsis, is invalid; 8 and 60 pass', () => {
    const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
    const blocks = [block('M1', `I move: ${words(70)}`)];
    const at = (n: number, from = 0) => verifyMeaning(reply({ quote: words(n + from).split(' ').slice(from).join(' ') }), blocks).status;
    expect([at(7), at(8), at(60), at(61)]).toEqual(['rejected', 'ok', 'ok', 'rejected']);
    expect(verifyMeaning(reply({ quote: `${QUOTE_FROM_MOTION.slice(0, 40)}... public land` }), PMM)).toEqual({ status: 'rejected', reason: 'invalid' });
  });

  it('keeps known domains only, at most two; none left is invalid', () => {
    expect(verifyMeaning(reply({ policyDomains: ['housing', 'sport', 'economy', 'health'] }), PMM)).toMatchObject({ domains: ['housing', 'economy'] });
    expect(verifyMeaning(reply({ policyDomains: ['sport'] }), PMM)).toEqual({ status: 'rejected', reason: 'invalid' });
  });

  it('procedural and confidence questions are procedural, before any other check', () => {
    expect(verifyMeaning(reply({ procedural: true, quote: '' }), PMM)).toEqual({ status: 'procedural' });
    expect(verifyMeaning(reply({ divisionKind: 'procedural', quote: '' }), PMM)).toEqual({ status: 'procedural' });
    expect(verifyMeaning(reply({ divisionKind: 'confidence', quote: '' }), PMM)).toEqual({ status: 'procedural' });
  });

  it(`below ${MIN_MEANING_CONFIDENCE} is unsure; ${MIN_MEANING_CONFIDENCE} passes`, () => {
    expect(verifyMeaning(reply({ confidence: 0.59 }), PMM)).toEqual({ status: 'rejected', reason: 'unsure' });
    expect(verifyMeaning(reply({ confidence: 0.6 }), PMM).status).toBe('ok');
  });

  it('a block label that was not sent, or of a kind the question does not allow, is invalid', () => {
    expect(verifyMeaning(reply({ quoteBlock: 'M7' }), PMM)).toEqual({ status: 'rejected', reason: 'invalid' });
    // The quote IS in the Q block; a words-stand question still may not be read from it.
    expect(verifyMeaning(reply({ quoteBlock: 'Q' }), [block('Q', MOTION), ...PMM.slice(1)])).toEqual({ status: 'rejected', reason: 'invalid' });
    expect(ALLOWED_BLOCKS).toEqual({ amendment: ['A'], words_stand: ['M'], motion: ['M'], bill_stage: ['B', 'M'], other: ['Q', 'B', 'M'] });
  });
});

describe('figuresIn', () => {
  it('reads each number without its thousands separators, and none from words', () => {
    expect(figuresIn('raise the relief to €50,000 from €30,000')).toEqual(['50000', '30000']);
    expect(figuresIn('from 5 per cent to 10 per cent, 1.5 million homes by 2030.')).toEqual(['5', '10', '1.5', '2030']);
    expect(figuresIn('build fifty thousand homes')).toEqual([]);
  });
});

describe('verifyMatch', () => {
  const candidates = [
    { id: 7, options: [{ key: 'option_a' }, { key: 'option_b' }, { key: 'option_c' }] },
    { id: 9, options: [{ key: 'option_a' }, { key: 'option_b' }] },
  ];
  const match = (over: Partial<MatchReply> = {}): MatchReply => ({ questionId: 7, taOption: 'option_a', nilOption: 'option_b', confidence: 0.8, reason: 'r', ...over });
  const PROPOSAL = 'Financial Resolution No. 1 raises the maximum relief from €30,000 to €35,000. A Tá vote supported raising the relief.';

  it('a candidate that was sent, with its own keys, at 0.7 or more, is a match', () => {
    expect(verifyMatch(match(), candidates, PROPOSAL)).toEqual({ status: 'matched', questionId: 7, taOption: 'option_a', nilOption: 'option_b', confidence: 0.8, reason: 'r' });
    expect(verifyMatch(match({ nilOption: null, confidence: MIN_MATCH_CONFIDENCE }), candidates, PROPOSAL)).toMatchObject({ status: 'matched', nilOption: null });
  });

  it('no question, or below 0.7, is no_match', () => {
    expect(verifyMatch(match({ questionId: null, taOption: null, nilOption: null }), candidates, PROPOSAL)).toEqual({ status: 'no_match' });
    expect(verifyMatch(match({ confidence: 0.69 }), candidates, PROPOSAL)).toEqual({ status: 'no_match' });
  });

  it('a question not sent, an unknown key, Tá = Níl, or Níl without Tá rejects the whole match', () => {
    const invalid = { status: 'rejected', reason: 'invalid' };
    expect(verifyMatch(match({ questionId: 8 }), candidates, PROPOSAL)).toEqual(invalid);
    expect(verifyMatch(match({ taOption: 'option_z' }), candidates, PROPOSAL)).toEqual(invalid);
    expect(verifyMatch(match({ questionId: 9, taOption: 'option_c', nilOption: null }), candidates, PROPOSAL)).toEqual(invalid);
    expect(verifyMatch(match({ nilOption: 'option_z' }), candidates, PROPOSAL)).toEqual(invalid);
    expect(verifyMatch(match({ nilOption: 'option_a' }), candidates, PROPOSAL)).toEqual(invalid);
    expect(verifyMatch(match({ taOption: null }), candidates, PROPOSAL)).toEqual(invalid);
  });

  describe('an answer may not name a figure the vote does not', () => {
    const labelled = (label: string) => [{ id: 7, options: [{ key: 'option_a', label }, { key: 'option_b', label: 'Leave the relief as it is' }] }];

    it('refuses "€50,000" when the proposal says €35,000, and lists the figure', () => {
      const answer = labelled('Raise the Help to Buy tax refund threshold to €50,000 to boost first-time buyers.');
      expect(verifyMatch(match({ nilOption: null }), answer, PROPOSAL)).toEqual({ status: 'no_match', overstated: ['50000'] });
    });

    it('accepts a figure the proposal does name, however it is written', () => {
      expect(verifyMatch(match({ nilOption: null }), labelled('Raise the relief to €35,000.'), PROPOSAL)).toMatchObject({ status: 'matched' });
      expect(verifyMatch(match({ nilOption: null }), labelled('Raise the relief to 35000 euro.'), PROPOSAL)).toMatchObject({ status: 'matched' });
    });

    it('checks the Tá answer only, and an answer with no figure is never refused', () => {
      const answer = [{ id: 7, options: [{ key: 'option_a', label: 'Raise the relief.' }, { key: 'option_b', label: 'Keep it at €99,999' }] }];
      expect(verifyMatch(match(), answer, PROPOSAL)).toMatchObject({ status: 'matched' });
    });
  });
});
