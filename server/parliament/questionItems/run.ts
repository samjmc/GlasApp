/**
 * Q2: read question exchanges with the shared runner (debateItems/run.ts), one window per
 * exchange and no context speeches, so a commitment's askers are always the exchange's own.
 *
 *   npm run questions:items -- --limit N | --pilot 100 | --debate <exchange id> | --all --yes
 */
import type { QuestionFormat } from '@shared/schema/parliament';
import { extractUnits, sampleByShare, type ExtractConfig, type ExtractOptions, type ExtractSummary } from '../debateItems/run';
import * as repo from '../repository';
import type { QuestionUnit } from '../repo/questionRecord';
import { QUESTION_EXTRACTOR_VERSION, QUESTION_KINDS, questionPrompt } from './prompt';

/** Share of a pilot per format: oral PQs and Topical Issues are where commitments are made. */
const SAMPLE_SHARES: Array<[QuestionFormat, number]> = [
  ['oral_pq', 0.5],
  ['topical_issue', 0.3],
  ['leaders_questions', 0.1],
  ['rapid', 0.1],
];

export const questionSample = (units: QuestionUnit[], n: number): QuestionUnit[] => sampleByShare(units, n, SAMPLE_SHARES, (u) => u.format);

export const QUESTION_EXTRACTION: ExtractConfig<QuestionUnit> = {
  version: QUESTION_EXTRACTOR_VERSION,
  operation: 'question-items',
  units: () => repo.questionUnits(),
  speechesOf: (unit) => repo.exchangeSpeechesOf(unit.id),
  windowsOf: (speeches) => (speeches.length > 0 ? [{ context: [], speeches }] : []),
  passes: { question: QUESTION_KINDS },
  prompt: (title, window) => questionPrompt(title, window),
  sample: questionSample,
  rebuild: () => repo.rebuildQuestionRecord(),
};

export const extractQuestions = (options: ExtractOptions = {}): Promise<ExtractSummary> => extractUnits(QUESTION_EXTRACTION, options);
