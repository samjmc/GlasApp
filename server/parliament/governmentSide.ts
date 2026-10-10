/**
 * Which side of the House a TD was on, on a given day: the government side or not. Used only so
 * that a concession scores when it crosses the House (docs/plans/debate-analysis.md, Step 4).
 *
 * Government side = a member of a government party on that day, anyone holding cabinet or
 * Minister of State office that day (td_offices, which covers the independent ministers and
 * members who have since left the Dáil), or an independent who formally supported the government
 * that day (GOVERNMENT_SUPPORTERS, each with public sources).
 *
 * Known limits: a TD's party is today's party (tds.party), so a TD who changed party mid-term is
 * placed by it. A member who left before the roster was first read has no tds row, so only their
 * offices place them. A supporter is listed only with a public source; voting with the government
 * alone does not make one (Mattie McGrath and Carol Nolan backed the Taoiseach vote but gave no
 * formal support).
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

export interface GovernmentSupporter {
  memberCode: string;
  from: string;
  /** NULL while still supporting. The last day of support, inclusive. */
  to: string | null;
  sources: string[];
}

const IT_RIG_DEAL = 'https://www.irishtimes.com/politics/2025/01/14/regional-independent-group-strikes-deal-with-fine-gael-and-fianna-fail-on-formation-of-next-government/';
const IT_HEALY_RAES = 'https://www.irishtimes.com/politics/2025/01/15/new-coalition-government-to-be-formed-after-agreement-reached-on-programme-for-government/';
/** The Ceann Comhairle ruled that Lowry, Toole, Heneghan and Danny Healy-Rae were not in Opposition. */
const RTE_NOT_OPPOSITION = 'https://www.rte.ie/news/politics/2025/0203/1494520-regional-technical-group/';
const TAOISEACH_VOTE = 'https://data.oireachtas.ie/ie/oireachtas/division/house/dail/34/2025-01-23/vote_2';
const CONFIDENCE_VOTE = 'https://data.oireachtas.ie/ie/oireachtas/division/house/dail/34/2026-04-14/vote_76';
const RTE_HEALY_RAES_LEAVE = 'https://rte.ie/news/analysis-and-comment/2026/0414/1568240-healy-rae-government/';
const FORMED = '2025-01-23';
/** The Healy-Raes voted against the government in the confidence vote of 2026-04-14. */
const HEALY_RAES_LAST_DAY = '2026-04-13';

/**
 * Independents who formally supported the 35th government: the Regional Independent Group's deal
 * of 2025-01-14 and the Healy-Rae brothers. Researched 2026-10-10. Those who also held office are
 * listed too, because office does not cover every day of their support (Harkin had none until
 * 2025-02-25). Add an entry only with a public source.
 */
export const GOVERNMENT_SUPPORTERS: GovernmentSupporter[] = [
  { memberCode: 'Michael-Lowry.D.1987-03-10', from: FORMED, to: null, sources: [IT_RIG_DEAL, RTE_NOT_OPPOSITION, CONFIDENCE_VOTE] },
  { memberCode: 'Barry-Heneghan.D.2024-11-29', from: FORMED, to: null, sources: [IT_RIG_DEAL, RTE_NOT_OPPOSITION, CONFIDENCE_VOTE] },
  { memberCode: 'Gillian-Toole.D.2024-11-29', from: FORMED, to: null, sources: [IT_RIG_DEAL, RTE_NOT_OPPOSITION, CONFIDENCE_VOTE] },
  { memberCode: 'Seán-Canney.D.2016-10-03', from: FORMED, to: null, sources: [IT_RIG_DEAL, TAOISEACH_VOTE] },
  { memberCode: 'Noel-Grealish.D.2002-06-06', from: FORMED, to: null, sources: [IT_RIG_DEAL, TAOISEACH_VOTE] },
  { memberCode: 'Kevin-Boxer-Moran.D.2016-10-03', from: FORMED, to: null, sources: [IT_RIG_DEAL, TAOISEACH_VOTE] },
  { memberCode: 'Marian-Harkin.D.2002-06-06', from: FORMED, to: null, sources: [IT_RIG_DEAL, TAOISEACH_VOTE] },
  { memberCode: 'Danny-Healy-Rae.D.2016-10-03', from: FORMED, to: HEALY_RAES_LAST_DAY, sources: [IT_HEALY_RAES, RTE_NOT_OPPOSITION, RTE_HEALY_RAES_LEAVE] },
  { memberCode: 'Michael-Healy-Rae.D.2011-03-09', from: FORMED, to: HEALY_RAES_LAST_DAY, sources: [IT_HEALY_RAES, RTE_HEALY_RAES_LEAVE] },
];

/** Held cabinet or Minister of State office on `date`. */
export function holdsGovernmentOffice(offices: GovernmentOffices, memberCode: string, date: string): boolean {
  return (offices.get(memberCode) ?? []).some((o) => o.start <= date && (o.end === null || date <= o.end));
}

export function isGovernmentSide(party: string | null, memberCode: string, date: string, offices: GovernmentOffices): boolean {
  if (holdsGovernmentOffice(offices, memberCode, date)) return true;
  const inRange = (r: { from: string; to: string | null }) => r.from <= date && (r.to === null || date <= r.to);
  if (GOVERNMENT_SUPPORTERS.some((s) => s.memberCode === memberCode && inRange(s))) return true;
  return party !== null && GOVERNMENT_PARTIES.some((g) => g.party === party && inRange(g));
}
