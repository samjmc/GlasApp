/**
 * Record what TDs said in one canonical article: extract → verify → the article's question →
 * map → save → evidence. The news pipeline and the rebuild job both run it; they differ only in
 * where the question comes from (made if missing, or only read).
 *
 * A stance that fails verification, or that Jev does not call a policy position (./position),
 * is never stored and never becomes evidence, and one an earlier run stored is deleted. Only a
 * stance mapped to an option of the question becomes evidence, under source `stance`.
 */
import { isIndependent, partyKey } from '../ideology/partyBaselines';
import { recomputePartyProfile, recomputeTdProfile } from '../ideology/service';
import { questionsWithPositions, type CompleteJson, type QuestionPositions } from '../voting';
import { stanceEvidenceRows } from './evidence';
import { extractStances, extractionText, type CandidateTd, type StanceArticle } from './extract';
import { mapStances } from './map';
import { isJevConfigured, POSITION_THRESHOLD, type PositionCheck } from './position';
import {
  deleteArticleStancesExcept,
  replaceStanceEvidenceOf,
  saveStances,
  stanceRowsForEvidence,
  withStanceLock,
  type StanceInput,
  type Tx,
} from './repository';
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

/**
 * Returns how many stances were accepted. Throws, writing nothing, when the extraction gave no
 * usable answer or Jev (configured) gave none for a quote: the caller marks the article failed
 * and it is read again later, rather than stored as if it had no stances.
 */
export async function recordStances(
  article: StanceArticle & { id: number },
  candidates: CandidateTd[],
  stats: StanceStats,
  deps: RecordDeps,
): Promise<number> {
  if (candidates.length === 0) return 0;
  const extracted = await extractStances(article, candidates, deps.complete);
  if (extracted === null) throw new Error(`stance extraction for article ${article.id} returned nothing usable`);
  stats.extracted += extracted.length;

  // Verify against exactly the text the model was sent.
  const verified = verifyStances(extractionText(article), candidates, extracted);
  for (const reason of REJECT_REASONS) stats.rejected[reason] += verified.rejected[reason];

  const accepted: typeof verified.accepted = [];
  let unchecked = 0;
  for (const stance of verified.accepted) {
    const td = candidates.find((candidate) => candidate.id === stance.tdId)!;
    const p = await deps.position({ td, headline: article.title, quote: stance.quote });
    if (p === null) unchecked++;
    else if (p < POSITION_THRESHOLD) stats.rejected.not_position++;
    else accepted.push(stance);
  }
  stats.rejected.unchecked += unchecked;
  // Without Jev configured every stance is held back by design; with it, no answer is an outage.
  if (unchecked > 0 && isJevConfigured()) throw new Error(`Jev gave no answer for ${unchecked} quote(s) of article ${article.id}`);
  stats.accepted += accepted.length;

  const question = accepted.length > 0 ? await deps.question() : null;
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

  // Even with nothing accepted: a stance an earlier run stored that the rules now reject must go.
  await saveArticleStances(
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
  return accepted.length;
}

const unique = (ids: number[]) => Array.from(new Set(ids));

/**
 * Make `stances` the article's whole set of news stances: the article's other TDs' rows are
 * deleted, and the `stance` evidence of every TD touched is rebuilt from td_stances, all in one
 * transaction under the stance lock (so a crash leaves no stance without its evidence, and the
 * nightly rebuild never interleaves). Then those TDs' profiles, and their parties', once each.
 */
export async function saveArticleStances(articleId: number, stances: StanceInput[]): Promise<void> {
  const touched = await withStanceLock(async (tx) => {
    const removed = await deleteArticleStancesExcept(articleId, stances.map((s) => s.tdId), tx);
    await saveStances(articleId, stances, tx);
    const tdIds = unique([...removed, ...stances.map((s) => s.tdId)]);
    await rebuildStanceEvidence(tx, tdIds);
    return tdIds;
  });
  const parties = new Map<string, string>();
  for (const tdId of touched) {
    const td = await recomputeTdProfile(tdId);
    if (td && !isIndependent(td.party)) parties.set(partyKey(td.party!), td.party!);
  }
  for (const party of Array.from(parties.values())) await recomputePartyProfile(party);
}

/**
 * Inside a withStanceLock transaction: the `stance` evidence of these TDs (every TD when null),
 * rebuilt from td_stances as they are now. Returns how many evidence rows that is.
 */
export async function rebuildStanceEvidence(tx: Tx, tdIds: number[] | null): Promise<number> {
  const stances = await stanceRowsForEvidence(tx, tdIds);
  const evidence = stanceEvidenceRows(stances, await questionsWithPositions(unique(stances.map((s) => s.questionId))));
  await replaceStanceEvidenceOf(tx, tdIds, evidence);
  return evidence.length;
}
