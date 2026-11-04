/**
 * Reads for the API: TDs and parties by how close they are to a position or to a signed-in user,
 * and one TD's or party's position. All of them read the shared match inputs.
 */
import { IDEOLOGY_DIMENSIONS, type IdeologyDimension, type IdeologyVector } from '@shared/ideology';
import {
  confidenceOf,
  type Matches,
  type PartyIdeology,
  type PartyManifesto,
  type PartyMatch,
  type TdIdeology,
  type TdMatch,
} from '@shared/ideologyMatch';
import type { IdeologyProfileRow } from '@shared/schema/quiz';
import type { SharedIssue } from '@shared/stancesApi';
import { blendPartyTarget, manifestoPosition } from '../partyQuiz/position';
// Not '../stances': its record.ts imports this domain, and the two would form a cycle.
import { AGREE_THRESHOLD, agreementFor, latestStances, type AgreementItem } from '../stances/agreement';
import { mappedStancesOn } from '../stances/repository';
import { listUserVoteVectors, questionsWithPositions, type UserVoteVector } from '../voting';
import { alignment, closestAndFurthest, subjectWeights, type DimensionWeights } from './alignment';
import { partyBaseline, partyKey } from './partyBaselines';
import * as repo from './repository';
import { userProfileOf } from './userProfile';

/**
 * How old the cached match inputs may get. Writes in this process drop them at once
 * (forgetMatchInputs); this bounds what a job in ANOTHER process (`npm run stances`, the CLI
 * recalculation, the parliament sync's `tds` updates) leaves stale on the web server.
 */
export const MATCH_INPUTS_TTL_MS = 60_000;

interface MatchInputs {
  tds: repo.TdRef[];
  tdProfiles: IdeologyProfileRow[];
  partyProfiles: IdeologyProfileRow[];
  evidence: Map<number, repo.EvidenceSummary>;
}

let matchInputs: { at: number; loaded: Promise<MatchInputs> } | null = null;

/**
 * What every match reads: the active TDs, every TD and party profile and the evidence summary
 * (a grouped count over all of td_ideology_evidence). Same for every caller, and changed only
 * by the evidence and profile writes (recompute.ts, rebuild.ts), so read once and shared. Callers
 * must not mutate it.
 */
function loadMatchInputs(): Promise<MatchInputs> {
  if (matchInputs && Date.now() - matchInputs.at < MATCH_INPUTS_TTL_MS) return matchInputs.loaded;
  const entry = {
    at: Date.now(),
    loaded: Promise.all([repo.listActiveTds(), repo.listProfiles('td'), repo.listProfiles('party'), repo.evidenceSummary()]).then(
      ([tds, tdProfiles, partyProfiles, evidence]) => ({ tds, tdProfiles, partyProfiles, evidence }),
    ),
  };
  // A failed read is not kept. A read that a write dropped meanwhile is not put back either.
  entry.loaded.catch(() => {
    if (matchInputs === entry) matchInputs = null;
  });
  matchInputs = entry;
  return entry.loaded;
}

/**
 * Drop the cached match inputs. Called after every TD or party profile write; every evidence
 * write is followed by one (the stance rebuild, deleteTdEvidence + recalculateAll).
 */
export function forgetMatchInputs(): void {
  matchInputs = null;
}

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
  const { tds, tdProfiles, partyProfiles, evidence } = await loadMatchInputs();
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
  const { partyProfiles: rows, tds, evidence } = await loadMatchInputs();
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
