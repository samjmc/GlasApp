/**
 * The prompt for one (party, question) call. Pure.
 *
 * Order matters for DeepSeek's prefix cache: the system rules, then the party's documents, are
 * byte-identical for every question of a party, and the question comes last. The model sees
 * the question and its answers' text and description only: no values, no dimension name, so
 * it cannot aim for a position.
 */
import type OpenAI from 'openai';
import type { QuizQuestion } from '@shared/quiz';
import { answerOrder } from '@shared/quizPlan';
import { MAX_QUOTE_WORDS, MIN_QUOTE_WORDS } from './normalise';

/** Bump when the rules change; every sheet records the version it was answered with. */
export const PROMPT_VERSION = 'v1';
export const MAX_RATIONALE_WORDS = 40;
/** The fixed seed for the --shuffle-check answer order. */
export const SHUFFLE_SEED = 1;

export type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export interface PromptDocument {
  slug: string;
  pages: Array<{ ordinal: number; text: string }>;
}

export const SYSTEM_PROMPT = `You answer one quiz question for an Irish political party, using ONLY the party's election
document(s) below. Each page starts with a marker: [doc <slug> page <n>].

RULES
- Use only the text of the documents. Never use what you know about the party, its reputation,
  its leaders or its record in office.
- Choose an answer only when the documents state a position that matches one answer better than
  the others. Otherwise abstain, with one reason:
    "silent": the documents do not address the question;
    "no_preference": they address the topic but do not choose between the answers;
    "contradictory": they state positions that match different answers.
- Back an answer with 1 or 2 quotes. Copy each quote exactly from one page, ${MIN_QUOTE_WORDS} to ${MAX_QUOTE_WORDS} words, one
  continuous passage with no ellipses, and name its document slug and the page number from the
  nearest marker before it.
- A "contradictory" abstention gives up to 2 quotes that show the conflict. "silent" and
  "no_preference" give no quotes.
- Give the quotes first, then a rationale of at most ${MAX_RATIONALE_WORDS} words that ties them to the answer.
- confidence, 0 to 1: how clearly the quotes support the chosen answer over every other answer.

Reply with JSON only:
{"quotes":[{"document":"<slug>","page":<n>,"text":"<exact quote>"}],"rationale":"<text>",
 "status":"answered"|"abstained","answerIndex":<answer number>|null,
 "abstainReason":"silent"|"no_preference"|"contradictory"|null,"confidence":<0 to 1>}`;

export function documentsBlock(docs: PromptDocument[]): string {
  const pages = docs.flatMap((d) => d.pages.map((p) => `[doc ${d.slug} page ${p.ordinal}]\n${p.text}`));
  return `DOCUMENTS\n\n${pages.join('\n\n')}`;
}

/** `order[shown]` is the bank index of the answer shown at position `shown`; no order = bank order. */
export function questionBlock(question: QuizQuestion, order?: number[]): string {
  const shown = order ?? question.answers.map((_, i) => i);
  const answers = shown.map((bank, i) => `${i}. ${question.answers[bank]!.text}\n   ${question.answers[bank]!.description}`);
  return `QUESTION\n${question.text}\n\nANSWERS\n${answers.join('\n')}`;
}

export function buildMessages(docs: PromptDocument[], question: QuizQuestion, order?: number[]): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${documentsBlock(docs)}\n\n${questionBlock(question, order)}` },
  ];
}

/** The answer order for --shuffle-check: the quiz's own seeded shuffle, at a fixed seed. */
export function shuffledOrder(question: QuizQuestion): number[] {
  return answerOrder(SHUFFLE_SEED, question.id, question.answers.length);
}

export function bankIndex(order: number[] | undefined, shown: number): number {
  return order ? order[shown]! : shown;
}
