/**
 * Record what TDs said in one canonical article: extract → verify → the article's question →
 * map → save → evidence. The news pipeline and the rebuild job both run it; they differ only in
 * where the question comes from (made if missing, or only read).
 *
 * A stance that fails verification, or that Jev does not call a policy position (./position),
 * is never stored and never becomes evidence. Only a stance mapped to an option of the question
 * becomes evidence, under source `stance`.
 */
import { recordTdEvidence } from '../ideology';
import type { CompleteJson, QuestionPositions } from '../voting';
import { stanceEvidenceWeight } from './evidence';
import { extractStances, extractionText, type CandidateTd, type StanceArticle } from './extract';
import { mapStances } from './map';
import { POSITION_THRESHOLD, type PositionCheck } from './position';
import { saveStances } from './repository';
import { REJECT_REASONS, verifyStances } from './verify';

/** Verification's reasons, then the position check's: below the threshold, or no answer. */
export const STANCE_REJECT_REASONS = [...REJECT_REASONS, 'not_position', 'unchecked'] as const;
export type StanceRejectReason = (typeof STANCE_REJECT_REASONS)[number];

export interface StanceStats {
  /** Stances the model returned. */
  extracted: number;
  /** Passed verification and the position check. */
  accepted: number;
  rejected: Record<StanceRejectReason, number>;
  /** Accepted and matched to an option of the article's question. */
  mapped: number;
}

export function emptyStanceStats(): StanceStats {
  const rejected = {} as Record<StanceRejectReason, number>;
  for (const reason of STANCE_REJECT_REASONS) rejected[reason] = 0;
  return { extracted: 0, accepted: 0, rejected, mapped: 0 };
}

/** A TD row as a stance candidate: offices are `[{ title, since }]` in the tds table. */
export function toCandidate(td: { id: number; name: string; party: string | null; offices: Array<{ title: string }> | null }): CandidateTd {
  return { id: td.id, name: td.name, party: td.party, offices: (td.offices ?? []).map((office) => office.title) };
}

export interface RecordDeps {
  complete: CompleteJson;
  /** P(policy position) for each verified quote (./position). */
  position: PositionCheck;
  /** The article's question. Called only when at least one stance was accepted. */
  question: () => Promise<QuestionPositions | null>;
  /** Count everything, write nothing. */
  dryRun?: boolean;
}

/** Returns how many stances were accepted. */
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
  for (const reason of REJECT_REASONS) stats.rejected[reason] += verified.rejected[reason];

  const accepted: typeof verified.accepted = [];
  for (const stance of verified.accepted) {
    const td = candidates.find((candidate) => candidate.id === stance.tdId)!;
    const p = await deps.position({ td, headline: article.title, quote: stance.quote });
    if (p === null) stats.rejected.unchecked++;
    else if (p < POSITION_THRESHOLD) stats.rejected.not_position++;
    else accepted.push(stance);
  }
  stats.accepted += accepted.length;
  if (accepted.length === 0) return 0;

  const question = await deps.question();
  const keys = question
    ? await mapStances(
        { question: question.question, options: question.options.map(({ key, label }) => ({ key, label })) },
        accepted.map((stance) => stance.quote),
        deps.complete,
      )
    : null;
  const rows = accepted.map((stance, i) => ({
    stance,
    option: question?.options.find((option) => option.key === keys?.[i]) ?? null,
  }));
  stats.mapped += rows.filter((row) => row.option).length;
  if (deps.dryRun) return accepted.length;

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
      weight: stanceEvidenceWeight(option, stance.quoteKind, null),
      observedAt,
      policyTopic: question.policyTopic,
    });
  }
  return accepted.length;
}
