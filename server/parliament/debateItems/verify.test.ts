import { describe, expect, it } from 'vitest';
import type { RawItem } from './prompt';
import { findQuote, verifyItems, type GovernmentOffices } from './verify';
import { labelSpeeches, type DebateWindow } from './windows';

const DATE = '2026-09-23';
const [s1, s2, s3, s4] = labelSpeeches([
  { id: 'sect/spk_1', memberCode: 'A', speaker: 'Ann Murphy', date: DATE, text: 'The waiting list now stands at 600,000 people and that is a disgrace.', wordCount: 13 },
  {
    id: 'sect/spk_2',
    memberCode: 'B',
    speaker: 'Mary Butler (Minister of State at the Department of Health)',
    date: DATE,
    text: 'The Deputy is right that the list is too long. Of course, we have hired 2,000 nurses since January. I will publish the plan by the end of the year.',
    wordCount: 31,
  },
  {
    id: 'sect/spk_3',
    memberCode: 'A',
    speaker: 'Ann Murphy',
    date: DATE,
    text: 'Will the Minister tell us when the new hospital will open? The Ó Briain report said €3 billion would be needed.',
    wordCount: 21,
  },
  { id: 'sect/spk_4', memberCode: 'C', speaker: 'Aengus Ó Snodaigh', date: DATE, text: 'Tá an Rialtas ag déanamh go leor oibre ar an gceist seo agus tá súil agam go n-éireoidh leis.', wordCount: 19 },
]);
const window: DebateWindow = { context: [s1], speeches: [s2, s3, s4] };
const offices: GovernmentOffices = new Map([['B', [{ start: '2025-01-23', end: null }]]]);

const item = (over: Partial<RawItem>): RawItem => ({
  speech: 's2',
  kind: 'specific_claim',
  claimType: 'figure',
  quote: 'we have hired 2,000 nurses',
  targetSpeech: null,
  targetQuote: null,
  addressee: null,
  due: null,
  ...over,
});

describe('findQuote', () => {
  it('finds a quote whatever its case, spacing, quote marks and fadas, in the original offsets', () => {
    const at = findQuote(s3.text, '“the o briain  REPORT said €3 billion”');
    expect(at).not.toBeNull();
    expect(s3.text.slice(at!.start, at!.end)).toBe('The Ó Briain report said €3 billion');
    expect(findQuote(s3.text, 'the Smith report')).toBeNull();
  });
});

describe('verifyItems', () => {
  it('accepts each kind when it passes every check, storing the words as spoken', () => {
    const { accepted, rejected } = verifyItems(
      [
        item({ quote: 'WE HAVE   hired 2,000 nurses' }),
        item({ kind: 'concession', claimType: null, quote: 'The Deputy is right that the list is too long', targetSpeech: 's1' }),
        item({ kind: 'response', claimType: null, quote: 'the list is too long', targetSpeech: 's1', targetQuote: 'waiting list now stands at 600,000 people' }),
        item({ kind: 'commitment', claimType: null, quote: 'I will publish the plan', due: 'by the end of the year' }),
        item({ speech: 's3', kind: 'question', claimType: null, quote: 'Will the Minister tell us when the new hospital will open?', addressee: 'the Minister' }),
        item({ speech: 's3', kind: 'specific_claim', claimType: 'named_source', quote: 'The O Briain report said €3 billion would be needed' }),
        item({ speech: 's4', kind: 'specific_claim', claimType: 'named_source', quote: 'Ta an Rialtas ag deanamh go leor oibre' }),
      ],
      window,
      offices,
    );
    expect(Object.values(rejected).every((r) => r.en + r.ga === 0)).toBe(true);
    expect(accepted.map((a) => [a.kind, a.quote, a.targetSpeechId, a.targetQuote, a.addressee, a.due])).toEqual([
      ['specific_claim', 'we have hired 2,000 nurses', null, null, null, null],
      ['concession', 'The Deputy is right that the list is too long', 'sect/spk_1', null, null, null],
      ['response', 'the list is too long', 'sect/spk_1', 'waiting list now stands at 600,000 people', null, null],
      ['commitment', 'I will publish the plan', null, null, null, 'by the end of the year'],
      ['question', 'Will the Minister tell us when the new hospital will open?', null, null, 'the Minister', null],
      ['specific_claim', 'The Ó Briain report said €3 billion would be needed', null, null, null, null],
      // Irish, accepted, and stored with its fadas.
      ['specific_claim', 'Tá an Rialtas ag déanamh go leor oibre', null, null, null, null],
    ]);
    expect(accepted[0]).toMatchObject({ speechId: 'sect/spk_2', memberCode: 'B', claimType: 'figure' });
    expect(s2.text.slice(accepted[0].quoteStart, accepted[0].quoteEnd)).toBe('we have hired 2,000 nurses');
  });

  it('names each reason it rejects, and the language of the speech', () => {
    const { accepted, rejected } = verifyItems(
      [
        item({ speech: 's9' }), // no such speech
        item({ speech: 's1', quote: 'The waiting list now stands at 600,000 people' }), // context only
        item({ quote: 'hired nurses' }), // two words
        item({ quote: 'we have hired ... nurses since January' }), // ellipsis
        item({ claimType: null }), // a claim needs its type
        item({ quote: 'we have hired 3,000 nurses' }), // not what was said
        item({ speech: 's4', quote: 'The Government is doing a lot of work' }), // translated
        item({ kind: 'response', claimType: null, quote: 'the list is too long', targetSpeech: 's3', targetQuote: 'Will the Minister tell us' }), // later speech
        item({ speech: 's3', kind: 'concession', claimType: null, quote: 'Will the Minister tell us when', targetSpeech: 's1' }), // own speech
        item({ kind: 'concession', claimType: null, quote: 'the list is too long', targetSpeech: null }), // no target
        item({ speech: 's3', kind: 'question', claimType: null, quote: 'Will the Minister tell us when the new hospital will open?', addressee: 'Bob' }),
        item({ speech: 's3', kind: 'question', claimType: null, quote: 'Will the Minister tell us when the new hospital will open?', addressee: null }),
        item({ kind: 'question', claimType: null, quote: 'The Deputy is right that the list is too long', addressee: 'the Deputy' }), // no question mark
        item({ speech: 's3', kind: 'commitment', claimType: null, quote: 'Will the Minister tell us when' }), // not in office
        item({}),
        item({ quote: 'we have hired 2,000 nurses' }), // duplicate of the one above
      ],
      window,
      offices,
    );
    expect(accepted).toHaveLength(1);
    expect(rejected).toEqual({
      invalid: { en: 4, ga: 0 },
      context_speech: { en: 1, ga: 0 },
      quote_not_found: { en: 1, ga: 1 },
      bad_target: { en: 3, ga: 0 },
      not_a_question: { en: 1, ga: 0 },
      unknown_addressee: { en: 2, ga: 0 },
      not_office_holder: { en: 1, ga: 0 },
      duplicate: { en: 1, ga: 0 },
      over_limit: { en: 0, ga: 0 },
    });
  });

  it('accepts a question put to a member who speaks in the window by surname, or to an office in Irish', () => {
    const irish = labelSpeeches([
      { id: 'x/1', memberCode: 'C', speaker: 'Aengus Ó Snodaigh', date: DATE, text: 'An dtabharfaidh an tAire freagra ar an gceist seo?', wordCount: 9 },
    ])[0];
    // The quote stops just before the question mark, which still makes it a question.
    const byName = verifyItems(
      [item({ speech: 's3', kind: 'question', claimType: null, quote: 'Will the Minister tell us when the new hospital will open', addressee: 'Deputy Butler' })],
      { context: [], speeches: [s2, s3] },
      offices,
    );
    expect(byName.accepted).toHaveLength(1);

    const inIrish = verifyItems([item({ speech: 's1', kind: 'question', claimType: null, quote: 'An dtabharfaidh an tAire freagra ar an gceist seo?', addressee: 'an tAire' })], { context: [], speeches: [irish] }, offices);
    expect(inIrish.accepted).toHaveLength(1);
    // v3: a quote that stops well short of the question mark is still a question when its sentence
    // ends with one (the blind check found v2 dropping real questions this way).
    const short = verifyItems([item({ speech: 's1', kind: 'question', claimType: null, quote: 'An dtabharfaidh an tAire freagra', addressee: 'an tAire' })], { context: [], speeches: [irish] }, offices);
    expect(short.accepted).toHaveLength(1);
    // A sentence that ends in a full stop is not a question, wherever the quote sits.
    const stated = labelSpeeches([{ id: 'x/2', memberCode: 'C', speaker: 'Aengus Ó Snodaigh', date: DATE, text: 'Tabharfaidh an tAire freagra ar an gceist seo. Cad eile?', wordCount: 10 }])[0];
    const notQ = verifyItems([item({ speech: 's1', kind: 'question', claimType: null, quote: 'Tabharfaidh an tAire freagra', addressee: 'an tAire' })], { context: [], speeches: [stated] }, offices);
    expect(notQ.rejected.not_a_question).toEqual({ en: 0, ga: 1 });
  });

  it('keeps a response whose target passage was mis-copied, without that passage', () => {
    const { accepted } = verifyItems(
      [item({ kind: 'response', claimType: null, quote: 'the list is too long', targetSpeech: 's1', targetQuote: 'the list is 900,000' })],
      window,
      offices,
    );
    expect(accepted.map((a) => [a.kind, a.targetSpeechId, a.targetQuote])).toEqual([['response', 'sect/spk_1', null]]);
  });

  it('keeps at most MAX_CLAIMS_PER_SPEECH claims in one speech, whatever the model sends', () => {
    const text = 'One is 1 more. Two is 2 more. Three is 3 more. Four is 4 more. Five is 5 more. Six is 6 more.';
    const [long] = labelSpeeches([{ id: 'y/1', memberCode: 'D', speaker: 'Dee Dee', date: DATE, text, wordCount: 24 }]);
    const words = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];
    const { accepted, rejected } = verifyItems(
      words.map((w, i) => item({ speech: 's1', quote: `${w} is ${i + 1} more` })),
      { context: [], speeches: [long] },
      offices,
    );
    expect(accepted).toHaveLength(5);
    expect(rejected.over_limit.en).toBe(1);
  });

  it('counts a commitment only within the office holder\'s dates', () => {
    const before: GovernmentOffices = new Map([['B', [{ start: '2026-10-01', end: null }]]]);
    const { rejected } = verifyItems([item({ kind: 'commitment', claimType: null, quote: 'I will publish the plan' })], window, before);
    expect(rejected.not_office_holder.en).toBe(1);
  });
});
