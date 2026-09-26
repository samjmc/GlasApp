import { describe, expect, it } from 'vitest';
import { IDEOLOGY_DIMENSIONS } from '@shared/ideology';
import { QUIZ_QUESTIONS, type QuizQuestion } from '@shared/quiz';
import { SYSTEM_PROMPT, bankIndex, buildMessages, documentsBlock, questionBlock, shuffledOrder, type PromptDocument } from './prompt';

// Invented documents: no manifesto is quoted in this repo.
const DOCS: PromptDocument[] = [
  { slug: 'x-ge2024', pages: [{ ordinal: 1, text: 'We will pay a warden for every river.' }, { ordinal: 2, text: 'Libraries will open on Sundays.' }] },
  { slug: 'y-ge2024', pages: [{ ordinal: 1, text: 'A night bus for every town.' }] },
];

const content = (m: { content?: unknown }) => m.content as string;

describe('buildMessages', () => {
  it('keeps the system rules and the documents byte-identical for every question, so the prefix caches', () => {
    const docs = documentsBlock(DOCS);
    expect(docs).toContain('[doc x-ge2024 page 2]\nLibraries will open on Sundays.');
    expect(docs).toContain('[doc y-ge2024 page 1]\nA night bus for every town.');
    for (const q of QUIZ_QUESTIONS) {
      const messages = buildMessages(DOCS, q);
      expect(messages.map((m) => m.role)).toEqual(['system', 'user']);
      expect(content(messages[0]!)).toBe(SYSTEM_PROMPT);
      expect(content(messages[1]!).startsWith(docs)).toBe(true);
      expect(content(messages[1]!).slice(docs.length)).toBe(`\n\n${questionBlock(q)}`);
    }
  });

  it('shows no answer values and no dimension names', () => {
    const q: QuizQuestion = {
      id: 99, dimension: 'technocratic', text: 'Who should decide where a new bridge goes?',
      answers: [
        { value: -1.75, text: 'Engineers alone', description: 'Leave it to the people who build it.' },
        { value: -0.35, text: 'Engineers, after a hearing', description: 'Experts decide, the public is heard.' },
        { value: 0.35, text: 'The council, after a hearing', description: 'Elected members decide.' },
        { value: 1.75, text: 'A local vote', description: 'Everyone who lives nearby decides.' },
      ],
    };
    const prompt = buildMessages(DOCS, q).map(content).join('\n').toLowerCase();
    for (const d of IDEOLOGY_DIMENSIONS) expect(prompt, d).not.toContain(d);
    for (const v of ['1.75', '0.35', 'value']) expect(prompt, v).not.toContain(v);
    expect(prompt).toContain('who should decide where a new bridge goes?');
    expect(prompt).toContain('3. a local vote\n   everyone who lives nearby decides.');
  });

  it('shows a --shuffle-check permutation whose shown index maps back to the bank index', () => {
    let moved = 0;
    for (const q of QUIZ_QUESTIONS) {
      const order = shuffledOrder(q);
      expect([...order].sort()).toEqual(q.answers.map((_, i) => i));
      const block = questionBlock(q, order);
      q.answers.forEach((_, shown) => {
        const answer = q.answers[bankIndex(order, shown)]!;
        expect(block).toContain(`${shown}. ${answer.text}\n   ${answer.description}`);
      });
      if (order.some((bank, shown) => bank !== shown)) moved++;
    }
    expect(moved).toBeGreaterThan(QUIZ_QUESTIONS.length / 2);
    expect(bankIndex(undefined, 2)).toBe(2);
  });
});
