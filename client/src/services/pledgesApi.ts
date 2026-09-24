/**
 * Client for /api/pledges (server/pledges/routes.ts). Unwraps the `{ success, data }`
 * envelope; types come from @shared/pledges.
 */
import { apiRequest } from "@/lib/queryClient";
import type {
  EvidenceKind,
  PartyPledgeSummary,
  Pledge,
  PledgeCategory,
  PledgeEvidence,
  PledgeStatus,
  PledgeWithEvidence,
  PrioritiesView,
} from "@shared/pledges";

export type {
  EvidenceKind,
  PartyPledgeSummary,
  Pledge,
  PledgeCategory,
  PledgeEvidence,
  PledgeStatus,
  PledgeWithEvidence,
  PrioritiesView,
} from "@shared/pledges";

type Envelope<T> = { success: boolean; data: T };

const call = async <T>(method: string, path: string, body?: unknown): Promise<T> =>
  (await apiRequest<Envelope<T>>({ method, path, body })).data;

export interface NewPledgeInput {
  party: string;
  title: string;
  description: string;
  category: PledgeCategory;
  electionYear: number;
  targetDate?: string | null;
  sourceUrl: string;
}

export interface NewEvidenceInput {
  kind: EvidenceKind;
  summary: string;
  occurredOn: string;
  sourceUrl: string;
  divisionId?: string | null;
}

export const pledgesApi = {
  list: (party?: string) =>
    call<Pledge[]>("GET", party ? `/api/pledges?party=${encodeURIComponent(party)}` : "/api/pledges"),
  get: (id: number) => call<PledgeWithEvidence>("GET", `/api/pledges/${id}`),
  parties: () => call<PartyPledgeSummary[]>("GET", "/api/pledges/parties"),
  priorities: () => call<PrioritiesView>("GET", "/api/pledges/priorities"),
  savePriorities: (ranking: PledgeCategory[]) =>
    call<{ mine: PledgeCategory[] | null }>("PUT", "/api/pledges/priorities", { ranking }),
  create: (input: NewPledgeInput) => call<Pledge>("POST", "/api/pledges", input),
  update: (
    id: number,
    changes: Partial<NewPledgeInput> & { status?: PledgeStatus; statusNote?: string | null },
  ) => call<Pledge>("PATCH", `/api/pledges/${id}`, changes),
  remove: (id: number) => call<null>("DELETE", `/api/pledges/${id}`),
  addEvidence: (pledgeId: number, input: NewEvidenceInput) =>
    call<PledgeEvidence>("POST", `/api/pledges/${pledgeId}/evidence`, input),
  removeEvidence: (evidenceId: number) => call<null>("DELETE", `/api/pledges/evidence/${evidenceId}`),
};

/** Display labels. The enums are the source of truth; these only name them for people. */
export const CATEGORY_LABELS: Record<PledgeCategory, string> = {
  housing: "Housing",
  health: "Health",
  cost_of_living: "Cost of living & tax",
  economy: "Economy",
  infrastructure: "Infrastructure",
  climate: "Climate & energy",
  justice: "Justice",
  immigration: "Immigration",
  education: "Education",
  social_welfare: "Social welfare",
  foreign_policy: "Foreign policy",
  other: "Other",
};

export const STATUS_LABELS: Record<PledgeStatus, string> = {
  unassessed: "Not yet assessed",
  not_started: "Not started",
  in_progress: "In progress",
  delivered: "Delivered",
  broken: "Broken",
  superseded: "Superseded",
};

export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  legislation_passed: "Legislation passed",
  bill_introduced: "Bill introduced",
  budget_allocated: "Budget allocated",
  policy_implemented: "Policy implemented",
  division_vote: "Dáil vote",
  ministerial_statement: "Ministerial statement",
  parliamentary_question: "Parliamentary question",
  private_members_bill: "Private member's bill",
  motion_tabled: "Motion tabled",
  reversal: "Reversal",
  other: "Other",
};

/** A rate as a whole percentage, or a dash when there is nothing to divide. */
export const percent = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate * 100)}%`);
