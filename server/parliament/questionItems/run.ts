/**
 * Q2: read question exchanges with the shared runner (debateItems/run.ts), one window per
 * exchange and no context speeches, so a commitment's askers are always the exchange's own.
 *
 *   npm run questions:items -- --pilot 100 | --limit N | --debate <exchange id>
 */
import { createHash } from 'node:crypto';
import type { QuestionFormat } from '@shared/schema/parliament';
import { extractUnits, type ExtractConfig, type ExtractOptions, type ExtractSummary } from '../debateItems/run';
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
const rank = (id: string) => createHash('sha1').update(id).digest('hex');

/** A fixed sample: per format, the exchanges whose id hashes lowest. The same input gives the same sample. */
export function questionSample(units: QuestionUnit[], n: number): QuestionUnit[] {
  const out: QuestionUnit[] = [];
  for (const [format, share] of SAMPLE_SHARES) {
    const take = format === 'rapid' ? n - out.length : Math.round(n * share);
    out.push(...units.filter((u) => u.format === format).sort((a, b) => (rank(a.id) < rank(b.id) ? -1 : 1)).slice(0, take));
  }
  return out;
}

export const QUESTION_EXTRACTION: ExtractConfig<QuestionUnit> = {
  version: QUESTION_EXTRACTOR_VERSION,
  units: () => repo.questionUnits(),
  speechesOf: (unit) => repo.exchangeSpeechesOf(unit.id),
  windowsOf: (speeches) => (speeches.length > 0 ? [{ context: [], speeches }] : []),
  passes: { question: QUESTION_KINDS },
  prompt: (title, window) => questionPrompt(title, window),
  sample: questionSample,
  rebuild: () => repo.rebuildQuestionRecord(),
};

export const extractQuestions = (options: ExtractOptions = {}): Promise<ExtractSummary> => extractUnits(QUESTION_EXTRACTION, options);
