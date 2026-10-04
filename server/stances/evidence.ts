/**
 * TD stances → `stance` evidence on the ideology axes. ONE weight formula, used by record.ts
 * (one news stance at a time) and by the nightly rebuild from every td_stances row
 * (divisions.ts), so news and Dáil-vote evidence cannot drift apart. Pure.
 *
 * Evidence is one slot per (TD, question): the latest ELIGIBLE row wins. Eligible = a news quote,
 * or a Dáil vote that was the TD's own (free or rebel). A vote with the whip is on the record and
 * counts for item agreement, but never moves an axis profile.
 */
import type { NewTdIdeologyEvidence } from '@shared/schema/quiz';
import type { Discipline, QuoteKind } from '@shared/stancesApi';
import { DIVISION_DISCIPLINE_WEIGHT, QUOTE_KIND_WEIGHT, hasSignal, toObservationVector } from '../ideology/sources';
import type { QuestionPositions } from '../voting';
import { latestStances } from './agreement';

/** `option.weight × (option.confidence ?? 1) × QUOTE_KIND_WEIGHT[kind] × DIVISION_DISCIPLINE_WEIGHT[discipline]`; 0 for the whip. */
export function stanceEvidenceWeight(option: { weight: number; confidence: number | null }, kind: QuoteKind, discipline: Discipline | null): number {
  const own = discipline === null ? 1 : discipline === 'whip' ? 0 : DIVISION_DISCIPLINE_WEIGHT[discipline];
  return option.weight * (option.confidence ?? 1) * QUOTE_KIND_WEIGHT[kind] * own;
}

/** One td_stances row with an answer, as the rebuild reads it. */
export interface StanceForEvidence {
  id: number;
  tdId: number;
  questionId: number;
  optionKey: string;
  quoteKind: string;
  discipline: string | null;
  statedAt: Date;
}

const isEligible = (row: StanceForEvidence) => row.quoteKind !== 'division' || (row.discipline !== null && row.discipline !== 'whip');

/**
 * The whole set of `stance` evidence rows: per (TD, question) the latest eligible row, its
 * option's vector and weight. A row whose question or option is gone, whose option says nothing,
 * or whose weight is not positive gives nothing.
 */
export function stanceEvidenceRows(rows: StanceForEvidence[], questions: QuestionPositions[]): NewTdIdeologyEvidence[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const out: NewTdIdeologyEvidence[] = [];
  for (const row of latestStances(rows.filter(isEligible))) {
    const question = byId.get(row.questionId);
    const option = question?.options.find((o) => o.key === row.optionKey);
    if (!question || !option) continue;
    const vector = toObservationVector('stance', option.vector);
    const weight = stanceEvidenceWeight(option, row.quoteKind as QuoteKind, row.discipline as Discipline | null);
    if (!hasSignal(vector) || !(weight > 0)) continue;
    out.push({ tdId: row.tdId, source: 'stance', sourceRef: `question:${question.id}`, policyTopic: question.policyTopic, ...vector, weight, observedAt: row.statedAt });
  }
  return out;
}
