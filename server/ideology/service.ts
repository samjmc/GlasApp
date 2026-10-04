/**
 * Ideology operations: record evidence, recompute and read profiles, match positions.
 */
import { IDEOLOGY_DIMENSIONS, emptyIdeologyVector, type IdeologyDimension, type IdeologyVector } from '@shared/ideology';
import {
  confidenceOf,
  type DimensionConfidence,
  type Matches,
  type PartyIdeology,
  type PartyManifesto,
  type PartyMatch,
  type TdIdeology,
  type TdMatch,
  type UserIdeologyDetail,
} from '@shared/ideologyMatch';
import type { IdeologyProfileRow, QuizResultRow } from '@shared/schema/quiz';
import type { SharedIssue } from '@shared/stancesApi';
import { blendPartyTarget, manifestoPosition } from '../partyQuiz/position';
import { ideologyLabel } from '../quiz/label';
import { answeredCountsOf, coverageOf, scoreQuiz } from '../quiz/score';
// Not '../stances': its record.ts imports this domain, and the two would form a cycle.
import { AGREE_THRESHOLD, agreementFor, latestStances, type AgreementItem } from '../stances/agreement';
import { mappedStancesOn } from '../stances/repository';
import { listUserVoteVectors, questionsWithPositions, type UserVoteVector } from '../voting';
import { alignment, closestAndFurthest, subjectWeights, type DimensionWeights } from './alignment';
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

/**
 * The user's position and, per dimension, how much evidence is behind it: the support the model
 * used (rounded, so a full quiz is exactly QUIZ_WEIGHT = high), the latest quiz's answers on it
 * and the votes that speak to it. Computed on read, as userMatches is. null = no quiz, no votes.
 */
export async function userIdeologyDetail(userId: string): Promise<UserIdeologyDetail | null> {
  const now = new Date();
  const [quizzes, votes] = await Promise.all([repo.listQuizResults(userId), listUserVoteVectors(userId)]);
  const profile = userProfileOf(quizzes, votes, now);
  if (!profile) return null;
  const quiz = quizzes.find((q) => q.createdAt <= now);
  const quizAnswers = quiz ? answeredCountsOf(quiz.answers) : emptyIdeologyVector();
  // The same observations the model counted, so the two cannot drift apart.
  const voteVectors = votes
    .filter((v) => v.votedAt <= now)
    .map(voteObservation)
    .filter((o) => o.weight > 0)
    .map((o) => o.vector);
  const confidence = Object.fromEntries(
    IDEOLOGY_DIMENSIONS.map((d): [IdeologyDimension, DimensionConfidence] => [
      d,
      { level: confidenceOf(profile.support[d]), quizAnswers: quizAnswers[d], votes: voteVectors.filter((v) => v[d] !== undefined).length },
    ]),
  ) as Record<IdeologyDimension, DimensionConfidence>;
  return { vector: profile.vector, confidence };
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

const NO_EVIDENCE: repo.EvidenceSummary = { bySource: {}, measured: [] };

/** Per party key, the dimensions any of its TDs has evidence on. */
function measuredByParty(tds: repo.TdRef[], evidence: Map<number, repo.EvidenceSummary>): Map<string, Set<IdeologyDimension>> {
  const byParty = new Map<string, Set<IdeologyDimension>>();
  for (const td of tds) {
    if (!td.party) continue;
    const dims = byParty.get(partyKey(td.party)) ?? new Set<IdeologyDimension>();
    for (const d of (evidence.get(td.id) ?? NO_EVIDENCE).measured) dims.add(d);
    byParty.set(partyKey(td.party), dims);
  }
  return byParty;
}

/**
 * What a party is matched on: its stored row (the TD mean) blended at read time with its approved
 * manifesto answers (server/partyQuiz/position). TD profiles never see the manifesto. With no
 * baseline, only its TDs' measured dimensions and the manifesto's are a position.
 */
function partyTarget(row: IdeologyProfileRow, tdMeasured: Iterable<IdeologyDimension>) {
  const hasPartyBaseline = partyBaseline(row.subjectId) !== null;
  const position = manifestoPosition(row.subjectId);
  const { vector, measured } = blendPartyTarget(repo.vectorOf(row), position, hasPartyBaseline ? 'all' : new Set(tdMeasured));
  const manifesto: PartyManifesto | null = position && { coverage: position.coverage, answeredCount: position.answeredCount };
  return { vector, hasPartyBaseline, measured: IDEOLOGY_DIMENSIONS.filter((d) => measured.has(d)), manifesto };
}

/**
 * TDs and parties by how close they are to `vector`. A subject with no party baseline is matched
 * only on the dimensions it has evidence on (its 0s elsewhere mean "unknown", not "centrist"),
 * and not at all below MIN_MEASURED_DIMS; see `subjectWeights`. A party is matched on its
 * `partyTarget`, where a manifesto dimension counts as measured.
 */
export async function matchesFor(vector: IdeologyVector, weights: DimensionWeights = {}): Promise<Matches> {
  const [tds, tdProfiles, partyProfiles, evidence] = await Promise.all([
    repo.listActiveTds(),
    repo.listProfiles('td'),
    repo.listProfiles('party'),
    repo.evidenceSummary(),
  ]);
  const byId = new Map(tdProfiles.map((p) => [p.subjectId, p]));
  const tdMatches: TdMatch[] = [];
  for (const td of tds) {
    const { bySource, measured } = evidence.get(td.id) ?? NO_EVIDENCE;
    const profile = byId.get(String(td.id));
    const hasPartyBaseline = partyBaseline(td.party) !== null;
    const tdWeights = profile && subjectWeights(weights, { hasPartyBaseline, measured });
    if (!profile || !tdWeights) continue;
    const other = repo.vectorOf(profile);
    tdMatches.push({
      tdId: td.id,
      name: td.name,
      party: td.party,
      constituency: td.constituency,
      imageUrl: td.imageUrl,
      alignment: alignment(vector, other, tdWeights),
      evidenceCount: profile.evidenceCount,
      ...closestAndFurthest(vector, other, tdWeights),
      confidence: confidenceOf(profile.totalWeight),
      evidenceBySource: bySource,
      measured,
      hasPartyBaseline,
    });
  }
  const partyDims = measuredByParty(tds, evidence);
  const parties: PartyMatch[] = [];
  for (const p of partyProfiles) {
    const target = partyTarget(p, partyDims.get(partyKey(p.subjectId)) ?? []);
    const partyWeights = subjectWeights(weights, target);
    if (!partyWeights) continue;
    parties.push({
      party: p.subjectId,
      alignment: alignment(vector, target.vector, partyWeights),
      tdCount: p.evidenceCount,
      ...closestAndFurthest(vector, target.vector, partyWeights),
      // A party's evidenceCount is its TD count; its totalWeight is its TDs' own evidence.
      confidence: confidenceOf(p.totalWeight),
      hasPartyBaseline: target.hasPartyBaseline,
      manifesto: target.manifesto,
    });
  }
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
        divisionVote: stance.divisionVote as SharedIssue['divisionVote'],
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

export async function tdProfile(tdId: number): Promise<TdIdeology | null> {
  const [td, row, evidence] = await Promise.all([repo.findTd(tdId), repo.getProfile('td', String(tdId)), repo.evidenceSummary(tdId)]);
  if (!td) return null;
  const { bySource, measured } = evidence.get(tdId) ?? NO_EVIDENCE;
  return {
    td,
    hasPartyBaseline: partyBaseline(td.party) !== null,
    profile: row && {
      vector: repo.vectorOf(row),
      totalWeight: row.totalWeight,
      evidenceCount: row.evidenceCount,
      computedAt: row.computedAt.toISOString(),
      confidence: confidenceOf(row.totalWeight),
      evidenceBySource: bySource,
      measured,
    },
  };
}

/** A party's position as matchesFor matches it, with the stored TD mean it was blended from. */
export async function partyProfile(party: string): Promise<PartyIdeology | null> {
  const key = partyKey(party);
  const [rows, tds, evidence] = await Promise.all([repo.listProfiles('party'), repo.listActiveTds(), repo.evidenceSummary()]);
  const row = rows.find((p) => partyKey(p.subjectId) === key);
  if (!row) return null;
  const { vector, hasPartyBaseline, measured, manifesto } = partyTarget(row, measuredByParty(tds, evidence).get(key) ?? []);
  return {
    party: row.subjectId,
    vector,
    tdMean: repo.vectorOf(row),
    tdCount: row.evidenceCount,
    computedAt: row.computedAt.toISOString(),
    hasPartyBaseline,
    measured,
    manifesto,
  };
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

/** Rebuild every active TD's profile from its evidence, then every party's. No model calls. */
export async function recomputeTdsAndParties(now = new Date()): Promise<{ tds: number; parties: number }> {
  const tds = await repo.listActiveTds();
  for (const td of tds) await recomputeTdProfile(td.id, now);
  const parties = new Map<string, string>();
  for (const td of tds) if (!isIndependent(td.party)) parties.set(partyKey(td.party!), td.party!);
  for (const party of Array.from(parties.values())) await recomputePartyProfile(party);
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
