/**
 * Which side of the House a TD was on, on a given day: the government side or not. Used only so
 * that a concession scores when it crosses the House (docs/plans/debate-analysis.md, Step 4).
 *
 * Government side = a member of a government party on that day, or anyone holding cabinet or
 * Minister of State office that day (td_offices), which covers the independent ministers and
 * members who have since left the Dáil.
 *
 * Known limit, stated wherever the rule is shown: an independent who supports the government
 * without holding office counts as NOT government, because no sourced, dated list of them is kept.
 * A TD's party is today's party (tds.party): a TD who changed party mid-term is placed by it. A
 * member who left before the roster was first read has no tds row, so only their offices place them.
 */
import type { GovernmentOffices } from './debateItems/verify';

export interface GovernmentParty {
  party: string;
  from: string;
  /** NULL while still in government. */
  to: string | null;
  source: string;
}

const DAIL_START = '2024-11-29';

export const GOVERNMENT_PARTIES: GovernmentParty[] = [
  // The outgoing coalition stayed in office until the new government was appointed.
  { party: 'Fianna Fáil', from: DAIL_START, to: null, source: 'https://en.wikipedia.org/wiki/35th_government_of_Ireland' },
  { party: 'Fine Gael', from: DAIL_START, to: null, source: 'https://en.wikipedia.org/wiki/35th_government_of_Ireland' },
  { party: 'Green Party', from: DAIL_START, to: '2025-01-22', source: 'https://en.wikipedia.org/wiki/34th_government_of_Ireland' },
];

/** Held cabinet or Minister of State office on `date`. */
export function holdsGovernmentOffice(offices: GovernmentOffices, memberCode: string, date: string): boolean {
  return (offices.get(memberCode) ?? []).some((o) => o.start <= date && (o.end === null || date <= o.end));
}

export function isGovernmentSide(party: string | null, memberCode: string, date: string, offices: GovernmentOffices): boolean {
  if (holdsGovernmentOffice(offices, memberCode, date)) return true;
  return party !== null && GOVERNMENT_PARTIES.some((g) => g.party === party && g.from <= date && (g.to === null || date <= g.to));
}
