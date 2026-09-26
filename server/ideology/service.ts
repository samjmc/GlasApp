/**
 * Ideology operations: record evidence, recompute and read profiles, match positions.
 */
import { IDEOLOGY_DIMENSIONS, type IdeologyDimension, type IdeologyVector } from '@shared/ideology';
import type { IdeologyProfileRow, QuizResultRow } from '@shared/schema/quiz';
import type { SharedIssue, TdIssues } from '@shared/stancesApi';
import { ideologyLabel } from '../quiz/label';
import { coverageOf, scoreQuiz } from '../quiz/score';
// Not '../stances': its record.ts imports this domain, and the two would form a cycle.
import { AGREE_THRESHOLD, agreementFor, latestStances, type AgreementItem } from '../stances/agreement';
import { mappedStancesOn } from '../stances/repository';
import { listUserVoteVectors, questionsWithPositions, type UserVoteVector } from '../voting';
import { alignment, closestAndFurthest, type DimensionWeights } from './alignment';
import { computeProfile, meanProfile, type Observation, type Profile } from './model';
import { isIndependent, partyBaseline, partyKey } from './partyBaselines';
import * as repo from './repository';
import {
  PARTY_PRIOR_WEIGHT,
  QUIZ_WEIGHT,
  TD_HALF_LIFE_DAYS,
  hasSignal,
  toObservationVector,
  type SourceKind,
} from './sources';

// --- users -----------------------------------------------------------------

function voteObservation(vote: UserVoteVector): Observation {
  return {
    vector: toObservationVector('vote', vote.vector),
    weight: vote.weight * (vote.confidence ?? 1),
    observedAt: vote.votedAt,
  };
}

/**
 * A quiz speaks only to the dimensions it asked (a 0 elsewhere is "not asked"), and on each
 * one in proportion to how many of that dimension's questions were answered.
 */
function quizObservation(quiz: QuizResultRow): Observation {
  const coverage = coverageOf(quiz.answers);
  const full = repo.vectorOf(quiz);
  const asked = IDEOLOGY_DIMENSIONS.filter((d) => coverage[d] > 0);
  return {
    vector: Object.fromEntries(asked.map((d) => [d, full[d]])),
    dimensionWeight: Object.fromEntries(asked.map((d) => [d, coverage[d]])),
    weight: QUIZ_WEIGHT,
    observedAt: quiz.createdAt,
  };
}

/** The latest quiz as of `until` (quizzes are newest first) plus every vote up to it. */
function userObservations(quizzes: QuizResultRow[], votes: UserVoteVector[], until: Date): Observation[] {
  const quiz = quizzes.find((q) => q.createdAt <= until);
  const observations = votes.filter((v) => v.votedAt <= until).map(voteObservation);
  if (quiz) observations.push(quizObservation(quiz));
  return observations;
}

function userProfileOf(quizzes: QuizResultRow[], votes: UserVoteVector[], now: Date): Profile | null {
  const observations = userObservations(quizzes, votes, now);
  if (observations.length === 0) return null;
  return computeProfile(null, observations, { now, halfLifeDays: null });
}

/** A user's position from their latest quiz and every vote. null = no quiz and no votes yet. */
export async function computeUserProfile(userId: string): Promise<Profile | null> {
  const [quizzes, votes] = await Promise.all([repo.listQuizResults(userId), listUserVoteVectors(userId)]);
  return userProfileOf(quizzes, votes, new Date());
}

/** Called by voting after each vote and by the quiz after each save. */
export async function recomputeProfile(userId: string): Promise<void> {
  const profile = await computeUserProfile(userId);
  if (profile) await repo.upsertProfile('user', userId, profile);
  else await repo.deleteProfile('user', userId);
}

export async function getIdeologyProfile(userId: string): Promise<Record<IdeologyDimension, number> | null> {
  const row = await repo.getProfile('user', userId);
  return row ? repo.vectorOf(row) : null;
}

export interface TimelinePoint {
  date: string;
  vector: IdeologyVector;
}

/** The user's position at the end of each day on which they took a quiz or voted. */
export async function userTimeline(userId: string): Promise<TimelinePoint[]> {
  const [quizzes, votes] = await Promise.all([repo.listQuizResults(userId), listUserVoteVectors(userId)]);
  const days = Array.from(new Set<string>([...quizzes.map((q) => day(q.createdAt)), ...votes.map((v) => day(v.votedAt))])).sort();
  const points: TimelinePoint[] = [];
  for (const date of days) {
    const until = new Date(`${date}T23:59:59.999Z`);
    const observations = userObservations(quizzes, votes, until);
    points.push({ date, vector: computeProfile(null, observations, { now: until, halfLifeDays: null }).vector });
  }
  return points;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

// --- TDs and parties -------------------------------------------------------

export interface TdEvidenceInput {
  /** tds.id, or the TD's name when the caller only has that. */
  td: number | string;
  source: Exclude<SourceKind, 'vote'>;
  sourceRef: string;
  raw: Partial<Record<IdeologyDimension, number | null | undefined>>;
  weight: number;
  observedAt: Date;
  policyTopic?: string | null;
}

export type RecordResult = 'recorded' | 'duplicate' | 'no_signal' | 'unknown_td';

let unknownTdNames = 0;
/** How many evidence items named a TD the tds table does not have, since the process started. */
export const unknownTdCount = () => unknownTdNames;

export async function recordTdEvidence(input: TdEvidenceInput): Promise<RecordResult> {
  const tdId = typeof input.td === 'number' ? input.td : await repo.findTdIdByName(input.td);
  if (tdId === null) {
    unknownTdNames++;
    console.warn(`[ideology] no TD named "${input.td}"; evidence ${input.source}:${input.sourceRef} skipped`);
    return 'unknown_td';
  }
  const vector = toObservationVector(input.source, input.raw);
  if (!hasSignal(vector) || !(input.weight > 0)) return 'no_signal';
  const inserted = await repo.insertTdEvidence({
    tdId,
    source: input.source,
    sourceRef: input.sourceRef,
    policyTopic: input.policyTopic ?? null,
    ...vector,
    weight: input.weight,
    observedAt: input.observedAt,
  });
  if (!inserted) return 'duplicate';
  const td = await recomputeTdProfile(tdId);
  if (td && !isIndependent(td.party)) await recomputePartyProfile(td.party!);
  return 'recorded';
}

function tdPrior(party: string | null) {
  const baseline = partyBaseline(party);
  return baseline ? { vector: baseline, weight: PARTY_PRIOR_WEIGHT } : null;
}

export async function recomputeTdProfile(tdId: number, now = new Date()): Promise<repo.TdRef | null> {
  const td = await repo.findTd(tdId);
  if (!td) return null;
  const evidence = await repo.listTdEvidence(tdId);
  const observations: Observation[] = evidence.map((e) => ({
    vector: Object.fromEntries(IDEOLOGY_DIMENSIONS.filter((d) => e[d] !== null).map((d) => [d, e[d] as number])),
    weight: e.weight,
    observedAt: e.observedAt,
  }));
  await repo.upsertProfile('td', String(tdId), computeProfile(tdPrior(td.party), observations, { now, halfLifeDays: TD_HALF_LIFE_DAYS }));
  return td;
}

/** A party = the weighted mean of its TDs' profiles; its baseline when it has no TD profile. */
export async function recomputePartyProfile(party: string): Promise<void> {
  const key = partyKey(party);
  const [tds, profiles] = await Promise.all([repo.listActiveTds(), repo.listProfiles('td')]);
  const byId = new Map(profiles.map((p) => [p.subjectId, p]));
  const members = tds
    .filter((t) => t.party && partyKey(t.party) === key)
    .map((t) => byId.get(String(t.id)))
    .filter((p): p is IdeologyProfileRow => Boolean(p))
    .map((p) => ({ vector: repo.vectorOf(p), weight: PARTY_PRIOR_WEIGHT + p.totalWeight }));
  const vector = meanProfile(members) ?? partyBaseline(party);
  if (!vector) return;
  const totalWeight = members.reduce((s, m) => s + m.weight - PARTY_PRIOR_WEIGHT, 0);
  await repo.upsertProfile('party', party, { vector, totalWeight: Math.round(totalWeight * 100) / 100, evidenceCount: members.length });
}

// --- reads for the API -----------------------------------------------------

export interface TdMatch {
  tdId: number;
  name: string;
  party: string | null;
  constituency: string | null;
  imageUrl: string | null;
  alignment: number;
  evidenceCount: number;
  closest: IdeologyDimension[];
  furthest: IdeologyDimension[];
  /** Signed-in matches only: the daily-vote questions both the user and this TD answered. */
  issues?: TdIssues;
}

export interface PartyMatch {
  party: string;
  alignment: number;
  tdCount: number;
  closest: IdeologyDimension[];
  furthest: IdeologyDimension[];
}

export async function matchesFor(vector: IdeologyVector, weights: DimensionWeights = {}) {
  const [tds, tdProfiles, partyProfiles] = await Promise.all([repo.listActiveTds(), repo.listProfiles('td'), repo.listProfiles('party')]);
  const byId = new Map(tdProfiles.map((p) => [p.subjectId, p]));
  const tdMatches: TdMatch[] = [];
  for (const td of tds) {
    const profile = byId.get(String(td.id));
    // No baseline and no evidence: the 0s mean "unknown", not "centrist". Leave them out.
    if (!profile || (profile.evidenceCount === 0 && !partyBaseline(td.party))) continue;
    const other = repo.vectorOf(profile);
    tdMatches.push({
      tdId: td.id,
      name: td.name,
      party: td.party,
      constituency: td.constituency,
      imageUrl: td.imageUrl,
      alignment: alignment(vector, other, weights),
      evidenceCount: profile.evidenceCount,
      ...closestAndFurthest(vector, other),
    });
  }
  const parties: PartyMatch[] = partyProfiles
    .filter((p) => p.totalWeight > 0 || partyBaseline(p.subjectId))
    .map((p) => {
    const other = repo.vectorOf(p);
    return { party: p.subjectId, alignment: alignment(vector, other, weights), tdCount: p.evidenceCount, ...closestAndFurthest(vector, other) };
  });
  const byAlignment = <T extends { alignment: number }>(a: T, b: T) => b.alignment - a.alignment;
  return { tds: tdMatches.sort(byAlignment), parties: parties.sort(byAlignment) };
}

/** How many of the best TD matches carry their issue breakdown, besides the TD asked about. */
export const ISSUE_DETAIL_TOP = 5;

type IssueItem = AgreementItem & { issue: Omit<SharedIssue, 'agrees'> };

/**
 * Per TD, the daily-vote questions this user answered on which the TD has a CURRENT stance
 * with an answer (the latest `stated_at` wins).
 */
async function sharedIssueItems(votes: UserVoteVector[]): Promise<Map<number, IssueItem[]>> {
  const byTd = new Map<number, IssueItem[]>();
  if (votes.length === 0) return byTd;
  const questionIds = votes.map((vote) => vote.questionId);
  const [stances, questions] = await Promise.all([mappedStancesOn(questionIds), questionsWithPositions(questionIds)]);
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const voteByQuestion = new Map(votes.map((vote) => [vote.questionId, vote]));
  for (const stance of latestStances(stances)) {
    const question = questionById.get(stance.questionId);
    const vote = voteByQuestion.get(stance.questionId);
    if (!question || !vote) continue;
    const label = (key: string) => question.options.find((option) => option.key === key)?.label ?? key;
    const items = byTd.get(stance.tdId) ?? [];
    items.push({
      questionId: question.id,
      options: Object.fromEntries(question.options.map((option) => [option.key, option.vector])),
      userOption: vote.optionKey,
      tdOption: stance.optionKey,
      quoteKind: stance.quoteKind as AgreementItem['quoteKind'],
      statedAt: stance.statedAt,
      issue: {
        questionId: question.id,
        question: question.question,
        domain: stance.policyDomain,
        yours: label(vote.optionKey),
        theirs: stance.optionText ?? label(stance.optionKey),
        quote: stance.quote,
        quoteKind: stance.quoteKind as SharedIssue['quoteKind'],
        outlet: stance.sourceName,
        url: stance.articleUrl,
        statedAt: stance.statedAt.toISOString(),
      },
    });
    byTd.set(stance.tdId, items);
  }
  return byTd;
}

/**
 * The signed-in user's matches. Computed from their evidence on read, so a dimension they have
 * no evidence on (weight 0) does not count: its 0 means "unknown", not "centrist".
 *
 * Each TD's axis alignment is then blended with how often the TD answered the user's daily-vote
 * questions the way the user did (`agreementFor`; no shared issue = the axis number exactly).
 * The breakdown's items are filled only for `options.tdId` and the top ISSUE_DETAIL_TOP.
 */
export async function userMatches(userId: string, weights: DimensionWeights = {}, options: { tdId?: number; now?: Date } = {}) {
  const now = options.now ?? new Date();
  const [quizzes, votes] = await Promise.all([repo.listQuizResults(userId), listUserVoteVectors(userId)]);
  const profile = userProfileOf(quizzes, votes, now);
  if (!profile) return null;
  const measured: DimensionWeights = { ...weights };
  for (const d of IDEOLOGY_DIMENSIONS) if (!(profile.support[d] > 0)) measured[d] = 0;
  const [matches, itemsByTd] = await Promise.all([matchesFor(profile.vector, measured), sharedIssueItems(votes)]);

  const scored = matches.tds.map((td) => {
    const { alignment, issues } = agreementFor(td.alignment, itemsByTd.get(td.tdId) ?? [], now);
    return { td: { ...td, alignment }, issues };
  });
  scored.sort((a, b) => b.td.alignment - a.td.alignment);
  const tds: TdMatch[] = scored.map(({ td, issues }, rank) => ({
    ...td,
    issues: {
      agree: issues.agree,
      disagree: issues.disagree,
      items:
        rank < ISSUE_DETAIL_TOP || td.tdId === options.tdId
          ? issues.items.map((item) => ({ ...item.issue, agrees: item.agreement >= AGREE_THRESHOLD }))
          : [],
    },
  }));
  return { tds, parties: matches.parties, measured: IDEOLOGY_DIMENSIONS.filter((d) => profile.support[d] > 0) };
}

export async function tdProfile(tdId: number) {
  const [td, row] = await Promise.all([repo.findTd(tdId), repo.getProfile('td', String(tdId))]);
  if (!td) return null;
  return { td, profile: row && { vector: repo.vectorOf(row), totalWeight: row.totalWeight, evidenceCount: row.evidenceCount, computedAt: row.computedAt } };
}

export async function partyProfile(party: string) {
  const row = (await repo.listProfiles('party')).find((p) => partyKey(p.subjectId) === partyKey(party));
  return row ? { party: row.subjectId, vector: repo.vectorOf(row), tdCount: row.evidenceCount, computedAt: row.computedAt } : null;
}

// --- rebuild ---------------------------------------------------------------

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
export function deleteTdEvidence(source: Exclude<SourceKind, 'vote'>, dryRun = false): Promise<number> {
  return repo.deleteTdEvidenceBySource(source, dryRun);
}

/** Re-score stored quizzes, then rebuild every profile from evidence. No model calls. */
export async function recalculateAll(): Promise<RecalculateSummary> {
  const quizzesRescored = await rescoreQuizzes();
  const now = new Date();
  const tds = await repo.listActiveTds();
  for (const td of tds) await recomputeTdProfile(td.id, now);
  const parties = new Map<string, string>();
  for (const td of tds) if (!isIndependent(td.party)) parties.set(partyKey(td.party!), td.party!);
  for (const party of Array.from(parties.values())) await recomputePartyProfile(party);
  const userIds = Array.from(new Set([...(await repo.listQuizUserIds()), ...(await repo.listUserProfileIds())]));
  for (const userId of userIds) await recomputeProfile(userId);
  return { quizzesRescored, users: userIds.length, tds: tds.length, parties: parties.size };
}
