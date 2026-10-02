/**
 * Record what TDs said in one canonical article: extract → verify → the article's question →
 * map → save → evidence. The news pipeline and the rebuild job both run it; they differ only in
 * where the question comes from (made if missing, or only read).
 *
 * A stance that fails verification is never stored and never becomes evidence. Only a stance
 * mapped to an option of the question becomes evidence, under source `stance`.
 */
import { recordTdEvidence } from '../ideology';
import { QUOTE_KIND_WEIGHT } from '../ideology/sources';
import type { CompleteJson, QuestionPositions } from '../voting';
import { extractStances, extractionText, type CandidateTd, type StanceArticle } from './extract';
import { mapStances } from './map';
import { saveStances } from './repository';
import { REJECT_REASONS, verifyStances, type RejectReason } from './verify';

export interface StanceStats {
  /** Stances the model returned. */
  extracted: number;
  /** Passed verification. */
  accepted: number;
  rejected: Record<RejectReason, number>;
  /** Accepted and matched to an option of the article's question. */
  mapped: number;
}

export function emptyStanceStats(): StanceStats {
  const rejected = {} as Record<RejectReason, number>;
  for (const reason of REJECT_REASONS) rejected[reason] = 0;
  return { extracted: 0, accepted: 0, rejected, mapped: 0 };
}

/** A TD row as a stance candidate: offices are `[{ title, since }]` in the tds table. */
export function toCandidate(td: { id: number; name: string; party: string | null; offices: Array<{ title: string }> | null }): CandidateTd {
  return { id: td.id, name: td.name, party: td.party, offices: (td.offices ?? []).map((office) => office.title) };
}

export interface RecordDeps {
  complete: CompleteJson;
  /** The article's question. Called only when at least one stance was verified. */
  question: () => Promise<QuestionPositions | null>;
  /** Count everything, write nothing. */
  dryRun?: boolean;
}

/** Returns how many stances were verified. */
export async function recordStances(
  article: StanceArticle & { id: number },
  candidates: CandidateTd[],
  stats: StanceStats,
  deps: RecordDeps,
): Promise<number> {
  if (candidates.length === 0) return 0;
  const raw = await extractStances(article, candidates, deps.complete);
  if (raw === null) console.warn(`[stances] extraction for article ${article.id} returned nothing usable`);
  const extracted = raw ?? [];
  stats.extracted += extracted.length;

  // Verify against exactly the text the model was sent.
  const verified = verifyStances(extractionText(article), candidates, extracted);
  stats.accepted += verified.accepted.length;
  for (const reason of REJECT_REASONS) stats.rejected[reason] += verified.rejected[reason];
  if (verified.accepted.length === 0) return 0;

  const question = await deps.question();
  const keys = question
    ? await mapStances(
        { question: question.question, options: question.options.map(({ key, label }) => ({ key, label })) },
        verified.accepted.map((stance) => stance.quote),
        deps.complete,
      )
    : null;
  const rows = verified.accepted.map((stance, i) => ({
    stance,
    option: question?.options.find((option) => option.key === keys?.[i]) ?? null,
  }));
  stats.mapped += rows.filter((row) => row.option).length;
  if (deps.dryRun) return verified.accepted.length;

  const saved = await saveStances(
    article.id,
    rows.map(({ stance, option }) => ({
      tdId: stance.tdId,
      questionId: option ? question!.id : null,
      optionKey: option?.key ?? null,
      optionText: option?.label ?? null,
      quote: stance.quote,
      quoteKind: stance.quoteKind,
      policyDomain: stance.policyDomain,
    })),
  );
  const statedAt = new Map(saved.map((row) => [row.tdId, row.statedAt]));
  for (const { stance, option } of rows) {
    const observedAt = statedAt.get(stance.tdId);
    if (!question || !option || !observedAt) continue;
    await recordTdEvidence({
      td: stance.tdId,
      source: 'stance',
      sourceRef: `question:${question.id}`,
      raw: option.vector,
      weight: option.weight * (option.confidence ?? 1) * QUOTE_KIND_WEIGHT[stance.quoteKind],
      observedAt,
      policyTopic: question.policyTopic,
    });
  }
  return verified.accepted.length;
}
