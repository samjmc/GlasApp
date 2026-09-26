/**
 * A TD's stances as the TD page shows them: grouped by policy domain, each with how often the TD
 * spoke to that question and whether their answer changed. Pure.
 */
import type { TdStanceRow } from '@shared/schema/stances';
import type { QuoteKind, TdStanceDomain, TdStanceRecord, TdStances } from '@shared/stancesApi';

/** `rows` newest first (as `stancesForTd` returns them); domains keep that order by their newest stance. */
export function groupTdStances(tdId: number, rows: TdStanceRow[]): TdStances {
  const byQuestion = new Map<number, TdStanceRow[]>();
  for (const row of rows) {
    if (row.questionId === null) continue;
    const list = byQuestion.get(row.questionId) ?? [];
    list.push(row);
    byQuestion.set(row.questionId, list);
  }
  const changed = new Set<number>();
  byQuestion.forEach((list, questionId) => {
    const answered = list.filter((row) => row.optionKey !== null);
    // Newest first, so answered[0] is the latest answer.
    if (answered.some((row) => row.optionKey !== answered[0]!.optionKey)) changed.add(questionId);
  });

  const domains: TdStanceDomain[] = [];
  for (const row of rows) {
    const record: TdStanceRecord = {
      id: row.id,
      quote: row.quote,
      quoteKind: row.quoteKind as QuoteKind,
      outlet: row.sourceName,
      url: row.articleUrl,
      headline: row.headline,
      statedAt: row.statedAt.toISOString(),
      questionId: row.questionId,
      optionText: row.optionText,
      saidCount: row.questionId === null ? 1 : byQuestion.get(row.questionId)!.length,
      changedPosition: row.questionId !== null && changed.has(row.questionId),
    };
    const domain = domains.find((d) => d.domain === row.policyDomain);
    if (domain) domain.stances.push(record);
    else domains.push({ domain: row.policyDomain, stances: [record] });
  }
  return { tdId, domains };
}
