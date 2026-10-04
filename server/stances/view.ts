/**
 * A TD's stances as the TD page shows them: grouped by policy domain, each with how often the TD
 * spoke to (or voted on) that question and whether their quoted answer changed. Pure.
 *
 * News quotes and Dáil votes are two groups per question. "Said N times" and "changed position"
 * count within one group only: two votes (often on different amendments), or a vote against a
 * quote, are never a change of position. A vote whose answer differs from what the TD was quoted
 * saying shows that quote's answer beside it (`saidOption`).
 */
import type { TdStanceRow } from '@shared/schema/stances';
import type { QuoteKind, StanceVote, TdStanceDomain, TdStanceRecord, TdStances } from '@shared/stancesApi';

const isVote = (row: TdStanceRow) => row.quoteKind === 'division';
const groupKey = (questionId: number, vote: boolean) => `${questionId}:${vote ? 'vote' : 'news'}`;

/** `rows` newest first (as `stancesForTd` returns them); domains keep that order by their newest stance. */
export function groupTdStances(tdId: number, rows: TdStanceRow[]): TdStances {
  const byGroup = new Map<string, TdStanceRow[]>();
  for (const row of rows) {
    if (row.questionId === null) continue;
    const key = groupKey(row.questionId, isVote(row));
    byGroup.set(key, [...(byGroup.get(key) ?? []), row]);
  }
  /** Newest first, so answered[0] is the latest quoted answer. */
  const quotedAnswers = (questionId: number) => (byGroup.get(groupKey(questionId, false)) ?? []).filter((row) => row.optionKey !== null);
  const changed = (questionId: number) => {
    const answered = quotedAnswers(questionId);
    return answered.some((row) => row.optionKey !== answered[0]!.optionKey);
  };

  const domains: TdStanceDomain[] = [];
  for (const row of rows) {
    const vote = isVote(row);
    const said = vote && row.questionId !== null ? quotedAnswers(row.questionId).find((news) => news.optionKey !== row.optionKey) : undefined;
    const record: TdStanceRecord = {
      id: row.id,
      quote: row.quote,
      quoteKind: row.quoteKind as QuoteKind,
      divisionVote: row.divisionVote as StanceVote | null,
      outlet: row.sourceName,
      url: row.articleUrl,
      headline: row.headline,
      statedAt: row.statedAt.toISOString(),
      questionId: row.questionId,
      optionText: row.optionText,
      saidCount: row.questionId === null ? 1 : byGroup.get(groupKey(row.questionId, vote))!.length,
      changedPosition: !vote && row.questionId !== null && changed(row.questionId),
      saidOption: said ? said.optionText : null,
    };
    const domain = domains.find((d) => d.domain === row.policyDomain);
    if (domain) domain.stances.push(record);
    else domains.push({ domain: row.policyDomain, stances: [record] });
  }
  return { tdId, domains };
}
