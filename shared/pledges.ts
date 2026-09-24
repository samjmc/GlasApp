/**
 * Pledges: the one contract between the server and the client.
 *
 * A pledge is a promise a party made, with a source a reader can open. Its status is set
 * by a person reviewing dated, sourced evidence. There is no computed "score": the old
 * scores were hand-typed opinions (per-party integrity and transparency numbers, and
 * per-pledge importance weights keyed by title), and were deleted rather than ported.
 */

export const PLEDGE_CATEGORIES = [
  'housing',
  'health',
  'cost_of_living',
  'economy',
  'infrastructure',
  'climate',
  'justice',
  'immigration',
  'education',
  'social_welfare',
  'foreign_policy',
  'other',
] as const;
export type PledgeCategory = (typeof PLEDGE_CATEGORIES)[number];

/**
 * `unassessed` is the honest default: nobody has reviewed the evidence yet. It is not the
 * same as `not_started`, which is a finding.
 */
export const PLEDGE_STATUSES = ['unassessed', 'not_started', 'in_progress', 'delivered', 'broken', 'superseded'] as const;
export type PledgeStatus = (typeof PLEDGE_STATUSES)[number];

export const EVIDENCE_KINDS = [
  'legislation_passed',
  'bill_introduced',
  'budget_allocated',
  'policy_implemented',
  'division_vote',
  'ministerial_statement',
  'parliamentary_question',
  'private_members_bill',
  'motion_tabled',
  'reversal',
  'other',
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export interface PledgeEvidence {
  id: number;
  kind: EvidenceKind;
  summary: string;
  occurredOn: string;
  sourceUrl: string;
  /** An Oireachtas division id when the evidence is a recorded vote. */
  divisionId: string | null;
}

export interface Pledge {
  id: number;
  party: string;
  title: string;
  description: string;
  category: PledgeCategory;
  electionYear: number;
  targetDate: string | null;
  status: PledgeStatus;
  statusNote: string | null;
  sourceUrl: string;
  /** When a person last set the status. Null for a pledge nobody has reviewed. */
  reviewedAt: string | null;
  evidenceCount: number;
}

export interface PledgeWithEvidence extends Pledge {
  evidence: PledgeEvidence[];
}

export interface PartyPledgeSummary {
  party: string;
  total: number;
  byStatus: Record<PledgeStatus, number>;
  /** delivered ÷ (delivered + broken). Null until at least one pledge is resolved. */
  deliveryRate: number | null;
  /** The same, with each pledge weighted by its category's priority. Null when unweighted. */
  weightedDeliveryRate: number | null;
}

/** A category's weight, 0..1, summing to 1 across ranked categories. */
export type CategoryWeights = Partial<Record<PledgeCategory, number>>;

export interface PrioritiesView {
  /** Everyone's rankings combined. */
  community: CategoryWeights;
  rankers: number;
  /** The caller's own ranking, most important first. Null when signed out or unranked. */
  mine: PledgeCategory[] | null;
}
