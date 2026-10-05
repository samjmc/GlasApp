/**
 * Step 4 of debate analysis: the published rules that turn checked items into points. Pure.
 * Code gives every point; the model only found and quoted the items (prompt.ts, verify.ts).
 *
 * Rules r1 (2026-10-04):
 *   specific claim                 +1, at most 3 per speech, so a long speech does not win
 *   a concession made TO you       +3, only from the other side of the House (governmentSide.ts)
 *   questions, commitments         shown, no points
 *   responses                      not shown and no points: Sam's check found about 3 in 8 linked
 *                                  to the wrong earlier point
 *   speaking time, who moved it,   shown, no points: allotted or decided by procedure
 *   the result of the vote
 *
 * A TD's term figure is points per argued debate taken part in, compared only with TDs in the
 * same role (government office, or not) against the 75th percentile, from MIN_DEBATES debates.
 */
import type { DebateItemKind } from '@shared/schema/parliament';
import { percentile } from '../metrics';

export const RULES_VERSION = 'r1';
export const CLAIM_POINTS = 1;
export const MAX_CLAIM_POINTS_PER_SPEECH = 3;
export const CONCESSION_POINTS = 3;
/** The kinds shown to readers. Responses are kept but not shown until their links are fixed. */
export const SHOWN_KINDS: readonly DebateItemKind[] = ['specific_claim', 'concession', 'question', 'commitment'];
/** Fewer argued debates than this in a role gives no term figure. */
export const MIN_DEBATES = 5;
export const COHORT_PERCENTILE = 0.75;

export type DebateRole = 'office' | 'backbench';

/** One member who spoke in one debate (chair excluded). */
export interface Participant {
  debateId: string;
  memberCode: string;
  tdId: number | null;
  role: DebateRole;
  speeches: number;
  words: number;
}

/** One stored item, with the sides of the speaker and, for a concession, its target. */
export interface ScoredItem {
  debateId: string;
  speechId: string;
  memberCode: string;
  kind: DebateItemKind;
  /** A concession: the member conceded to. */
  targetMemberCode: string | null;
  /** A concession: whether speaker and target were on different sides that day. */
  crossesHouse: boolean;
}

export interface ParticipationRow extends Participant {
  claims: number;
  claimPoints: number;
  concessionsReceived: number;
  concessionPoints: number;
  questions: number;
  commitments: number;
  points: number;
}

/** Points per member per debate. Every participant gets a row, with 0 when nothing scored. */
export function scoreDebates(participants: Participant[], items: ScoredItem[]): ParticipationRow[] {
  const key = (debateId: string, memberCode: string) => `${debateId}\u0000${memberCode}`;
  const rows = new Map<string, ParticipationRow>(
    participants.map((p) => [
      key(p.debateId, p.memberCode),
      { ...p, claims: 0, claimPoints: 0, concessionsReceived: 0, concessionPoints: 0, questions: 0, commitments: 0, points: 0 },
    ]),
  );
  const claimsPerSpeech = new Map<string, number>();
  for (const item of items) {
    const own = rows.get(key(item.debateId, item.memberCode));
    if (!own) continue;
    switch (item.kind) {
      case 'specific_claim': {
        own.claims++;
        const n = (claimsPerSpeech.get(item.speechId) ?? 0) + 1;
        claimsPerSpeech.set(item.speechId, n);
        if (n <= MAX_CLAIM_POINTS_PER_SPEECH) own.claimPoints += CLAIM_POINTS;
        break;
      }
      case 'concession': {
        const target = item.targetMemberCode ? rows.get(key(item.debateId, item.targetMemberCode)) : undefined;
        if (!target) break;
        target.concessionsReceived++;
        if (item.crossesHouse) target.concessionPoints += CONCESSION_POINTS;
        break;
      }
      case 'question':
        own.questions++;
        break;
      case 'commitment':
        own.commitments++;
        break;
      default:
        break; // responses: kept, not scored (see the header)
    }
  }
  const out = Array.from(rows.values());
  for (const r of out) r.points = r.claimPoints + r.concessionPoints;
  return out;
}

export interface RoleFigure {
  role: DebateRole;
  debates: number;
  points: number;
  /** NULL below MIN_DEBATES. */
  pointsPerDebate: number | null;
}

/**
 * A TD's figure: the role they took part in most debates in (government office wins a tie),
 * and the 75th percentile of the TDs with at least MIN_DEBATES debates in that same role.
 */
export function termFigure(
  mine: Array<{ role: DebateRole; debates: number; points: number }>,
  everyone: Array<{ memberCode: string; role: DebateRole; debates: number; points: number }>,
): { figure: RoleFigure; cohortP75: number | null; cohortSize: number } | null {
  if (mine.length === 0) return null;
  const main = [...mine].sort((a, b) => b.debates - a.debates || (a.role === 'office' ? -1 : 1))[0];
  const cohort = everyone.filter((e) => e.role === main.role && e.debates >= MIN_DEBATES).map((e) => e.points / e.debates);
  return {
    figure: { role: main.role, debates: main.debates, points: main.points, pointsPerDebate: main.debates >= MIN_DEBATES ? main.points / main.debates : null },
    cohortP75: cohort.length > 0 ? percentile(cohort, COHORT_PERCENTILE) : null,
    cohortSize: cohort.length,
  };
}
