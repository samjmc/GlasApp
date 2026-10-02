import { describe, expect, it, vi } from 'vitest';
import type { QuizQuestion } from '@shared/quiz';
import { questionFingerprint } from '../quiz/fingerprint';
import type { StoredPage } from './extract';
import { quoteSha } from './normalise';
import { answerQuestion, parseReply, type AnswerContext } from './parse';
import type { ChatMessage } from './prompt';

// Invented question and document: no manifesto is quoted in this repo.
const QUESTION: QuizQuestion = {
  id: 7, dimension: 'environmental', text: 'Should every town get a river warden?',
  answers: [
    { value: -2, text: 'Yes, paid by the state', description: 'Wardens in every town.' },
    { value: -1, text: 'Yes, where councils ask', description: 'Local choice.' },
    { value: 1, text: 'Only on the worst rivers', description: 'Target the damage.' },
    { value: 2, text: 'No, leave it to landowners', description: 'Private care.' },
  ],
};
const PAGES: StoredPage[] = [
  { ordinal: 1, label: 'i', heading: null, text: 'Our plan for the country, set out in full.' },
  { ordinal: 2, label: '1', heading: null, text: 'We will pay a warden for every river in every county by the end of the term.' },
];
const CTX: AnswerContext = { question: QUESTION, docs: new Map([['x-ge2024', PAGES]]) };
const REAL = 'We will pay a warden for every river in every county';
const FAKE = 'Every farmer will be paid to fence off every river bank';

const reply = (over: Record<string, unknown> = {}) => JSON.stringify({
  quotes: [{ document: 'x-ge2024', page: 2, text: REAL }], rationale: 'Promises a paid warden on every river.',
  status: 'answered', answerIndex: 0, abstainReason: null, confidence: 0.9, ...over,
});
const MESSAGES: ChatMessage[] = [{ role: 'system', content: 'rules' }, { role: 'user', content: 'documents and question' }];

describe('parseReply', () => {
  it('strips a code fence and keeps a verified quote with its label and sha', () => {
    const parsed = parseReply('```json\n' + reply() + '\n```', CTX);
    expect(parsed).toEqual({
      item: {
        questionId: 7, fingerprint: questionFingerprint(QUESTION), status: 'answered', answerIndex: 0, abstainReason: null,
        quotes: [{ document: 'x-ge2024', page: 2, pageLabel: '1', text: REAL, quoteSha: quoteSha(REAL) }],
        rationale: 'Promises a paid warden on every river.', modelConfidence: 0.9, review: 'pending',
      },
    });
  });

  it('rejects an answer index out of range and an answered item without a quote', () => {
    expect(parseReply(reply({ answerIndex: 4 }), CTX)).toMatchObject({ problem: expect.stringMatching(/answerIndex/), quote: false });
    expect(parseReply(reply({ answerIndex: 1.5 }), CTX)).toMatchObject({ problem: expect.stringMatching(/answerIndex/) });
    expect(parseReply(reply({ quotes: [] }), CTX)).toMatchObject({ problem: expect.stringMatching(/quote/), quote: false });
    expect(parseReply('not json', CTX)).toMatchObject({ problem: expect.stringMatching(/JSON/) });
  });

  it('drops the index and the quotes of a silent abstention', () => {
    const parsed = parseReply(reply({ status: 'abstained', abstainReason: 'silent', answerIndex: 2 }), CTX);
    expect(parsed).toMatchObject({ item: { status: 'abstained', abstainReason: 'silent', answerIndex: null, quotes: [] } });
    expect(parseReply(reply({ status: 'abstained', abstainReason: 'low_confidence' }), CTX)).toMatchObject({ problem: expect.stringMatching(/abstainReason/) });
  });

  it('turns confidence under 0.5 into a low_confidence abstention that keeps only the tentative answer', () => {
    const parsed = parseReply(reply({ answerIndex: 1, confidence: 0.4 }), CTX);
    expect(parsed).toMatchObject({ item: { status: 'abstained', abstainReason: 'low_confidence', answerIndex: null, tentativeAnswerIndex: 1, quotes: [], modelConfidence: 0.4 } });
  });

  it('maps a shuffled answer number back to the bank index', () => {
    expect(parseReply(reply({ answerIndex: 0 }), { ...CTX, order: [3, 2, 1, 0] })).toMatchObject({ item: { answerIndex: 3 } });
  });
});

describe('answerQuestion', () => {
  it('retries a fabricated quote once, naming the failure, then abstains unverified_quote', async () => {
    const ask = vi.fn(async (_: ChatMessage[]) => reply({ quotes: [{ document: 'x-ge2024', page: 2, text: FAKE }] }));
    const result = await answerQuestion(ask, MESSAGES, CTX);
    expect(ask).toHaveBeenCalledTimes(2);
    const retry = ask.mock.calls[1]![0];
    expect(retry.slice(0, 2)).toEqual(MESSAGES);
    expect(retry[2]).toMatchObject({ role: 'assistant' });
    expect(retry[3]).toMatchObject({ role: 'user', content: expect.stringMatching(/not found/) });
    expect(result).toMatchObject({ item: { status: 'abstained', abstainReason: 'unverified_quote', answerIndex: null, quotes: [] } });
  });

  it('keeps an answer whose quote verifies on the retry', async () => {
    const ask = vi.fn()
      .mockResolvedValueOnce(reply({ quotes: [{ document: 'x-ge2024', page: 2, text: FAKE }] }))
      .mockResolvedValueOnce(reply());
    expect(await answerQuestion(ask, MESSAGES, CTX)).toMatchObject({ item: { status: 'answered', answerIndex: 0 } });
  });

  it('reports a reply that is still malformed after the retry as a failure, not an answer', async () => {
    const ask = vi.fn(async () => 'not json');
    expect(await answerQuestion(ask, MESSAGES, CTX)).toMatchObject({ failure: expect.stringMatching(/JSON/) });
    expect(ask).toHaveBeenCalledTimes(2);
  });
});
