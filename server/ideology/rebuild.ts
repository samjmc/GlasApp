/**
 * Rebuild every profile from the stored answers and evidence. No model calls.
 */
import { IDEOLOGY_DIMENSIONS, type IdeologyVector } from '@shared/ideology';
import { ideologyLabel } from '../quiz/label';
import { scoreQuiz } from '../quiz/score';
import { forgetMatchInputs } from './matches';
import { isIndependent, partyKey } from './partyBaselines';
import * as repo from './repository';
import { recomputePartyProfile, recomputeTdProfile } from './service';
import type { SourceKind } from './sources';
import { recomputeProfile } from './userProfile';

export interface RecalculateSummary {
  quizzesRescored: number;
  users: number;
  tds: number;
  parties: number;
}

/**
 * Re-score every stored quiz from its answers. The answers are the record; the stored vector
 * is a copy, so a change to the scoring or the bank reaches old results here.
 */
async function rescoreQuizzes(): Promise<number> {
  let changed = 0;
  for (const row of await repo.listAllQuizResults()) {
    let score;
    try {
      score = scoreQuiz(row.answers);
    } catch (error) {
      console.warn(`[ideology] quiz result ${row.id} no longer scores (${error instanceof Error ? error.message : error}); left as is`);
      continue;
    }
    const stored = repo.vectorOf(row);
    if (IDEOLOGY_DIMENSIONS.every((d) => stored[d] === score.vector[d])) continue;
    await repo.updateQuizScore(row.id, { vector: score.vector, ...labelOf(score.vector) });
    changed++;
  }
  return changed;
}

const labelOf = (v: IdeologyVector) => {
  const { name, description } = ideologyLabel(v);
  return { ideology: name, description };
};

/**
 * Delete every TD evidence row of one source (with `dryRun`, only count them). Profiles are not
 * recomputed here: call `recalculateAll` after.
 */
export async function deleteTdEvidence(source: Exclude<SourceKind, 'vote'>, dryRun = false): Promise<number> {
  const count = await repo.deleteTdEvidenceBySource(source, dryRun);
  if (!dryRun) forgetMatchInputs();
  return count;
}

/** Rebuild every active TD's profile from its evidence, then every party's. No model calls. */
export async function recomputeTdsAndParties(now = new Date()): Promise<{ tds: number; parties: number }> {
  const tds = await repo.listActiveTds();
  for (const td of tds) await recomputeTdProfile(td.id, now);
  const parties = new Map<string, string>();
  for (const td of tds) if (!isIndependent(td.party)) parties.set(partyKey(td.party!), td.party!);
  for (const party of Array.from(parties.values())) await recomputePartyProfile(party);
  // Also when there was nothing to recompute: the TD list itself may have changed.
  forgetMatchInputs();
  return { tds: tds.length, parties: parties.size };
}

/** Re-score stored quizzes, then rebuild every profile from evidence. No model calls. */
export async function recalculateAll(): Promise<RecalculateSummary> {
  const quizzesRescored = await rescoreQuizzes();
  const { tds, parties } = await recomputeTdsAndParties();
  const userIds = Array.from(new Set([...(await repo.listQuizUserIds()), ...(await repo.listUserProfileIds())]));
  for (const userId of userIds) await recomputeProfile(userId);
  return { quizzesRescored, users: userIds.length, tds, parties };
}
