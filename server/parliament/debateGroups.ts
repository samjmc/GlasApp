/**
 * Group Official Report sections into debates. Pure; the repository loads the rows and
 * writes the result (repo/debates.ts).
 *
 * A section is not a debate: a bill's Second Stage can run over several days as
 * "… (Resumed)" sections, and question time is a container (often not stored, because it has
 * no speeches of its own) holding one section per exchange. The unit is therefore:
 * - a top-level section, or
 * - the container a nested section sits in (its parent), whether or not it is stored.
 * Units are then chained: a unit whose heading carries "(Resumed)" / "(Atógáil)" joins the
 * most recent earlier debate with the same heading, and a unit with the same heading on the
 * same day as an earlier one joins it. Anything else starts a new debate.
 *
 * The kind comes from fixed lists of Official Report headings, never from the speeches.
 */
import type { DebateKind, DebateMoverSource } from '@shared/schema/parliament';

export interface SectionInput {
  id: string;
  date: string;
  title: string;
  parentId: string | null;
  parentTitle: string | null;
}

export interface GroupedDebate {
  id: string;
  kind: DebateKind;
  title: string;
  billId: string | null;
  firstDate: string;
  lastDate: string;
  /** Stored sections, in record order. */
  sectionIds: string[];
}

const RESUMED = /\s*\((?:Resumed|Atógáil)\)/gi;
/** "Irish - English" headings; the English part decides the kind. */
const BILINGUAL_SEPARATOR = / - /;
/** "[Private Members]", or in Irish "[Comhaltaí Príobháideacha]" (the record has misspelt it). */
const PRIVATE_MEMBERS = /\s*\[(Private Members|Comhaltaí [^\]]+)\]$/i;

/** Straight quotes and dashes, one space, no "(Resumed)": the same heading always compares equal. */
export function normaliseTitle(title: string): string {
  return title
    .normalize('NFC')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(RESUMED, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const isResumed = (title: string): boolean => new RegExp(RESUMED.source, 'i').test(title);

/** Question time and its relatives, by the English part of the heading. */
const HEADING_KINDS: Array<[RegExp, DebateKind]> = [
  [/^Leaders' Questions$/i, 'leaders_questions'],
  [/^(Priority Questions|Other Questions|Questions|Questions on Policy or Legislation|Questions on Promised Legislation|Other Members' Questions)$/i, 'questions'],
  [/^Topical Issue Debate$/i, 'topical_issue'],
  [/^(Nomination of Taoiseach|Appointment of Taoiseach and Nomination of Members of Government)$/i, 'motion'],
  // The Budget: "Financial Resolutions 2025", "Financial Resolution No. 1: Mineral Oil Tax",
  // and in 2026 also "No 6: …" and "No. 8 - General".
  [/^Financial Resolutions?( No\.?\s?\d+)?( \d{4})?((: | - ).+)?$/i, 'motion'],
  [/^Budget Statement \d{4}$/i, 'statements'],
  [
    /^(Order of Business|Business of Dáil|Topical Issue Matters|Messages? from (the )?(Seanad|Select Committees?|Standing Business Committee of Dáil Éireann)|(Revised )?Estimates for Public Services \d{4}|Visit of .+ Delegation|Address by .+|Adjournment of Dáil|Minute's Silence .+|Tributes to .+|Introduction of New Members|Personal (Apology|Explanation) by Member|Resignation of Member|Election of President|Selection of Candidate and Election of (Ceann|Leas-Cheann) Comhairle|Appointment of Ministers and Ministers of State)$/i,
    'procedural',
  ],
];

/** "<subject>: <suffix>" headings: motions, statements and bill stages, in English or Irish. */
const SUFFIX_KINDS: Array<[RegExp, DebateKind]> = [
  [/^(Motions?|Tairiscint)$/i, 'motion'],
  [/^(Statements|Ráitis)$/i, 'statements'],
  [
    /^(Second Stage|An Dara Céim|Committee Stage|Céim an Choiste|Committee and Remaining Stages|Committee Stage and Remaining Stages|Report Stage|Report and Final Stages?|Report Stage and Final Stage|An Tuarascáil agus an Chéim Dheiridh|Fifth Stage|From the Seanad)$/i,
    'bill_stage',
  ],
  [
    /^(First Stage|An Chéad Chéim|Referral to (Select|Joint) Committee|Instruction to Committee|Order for (Second|Committee|Report) Stage|Messages? from Select Committees?|Teachtaireacht ó Roghchoiste|Financial Resolutions?|Leave to Introduce|Appointment of Members|Restoration to Order Paper|Waiver of Pre-Legislative Scrutiny|Issue of Writ)$/i,
    'procedural',
  ],
];

/** The kind of business a (normalised) heading names. A heading in no list is `other`. */
export function kindOf(title: string): DebateKind {
  const parts = title.split(BILINGUAL_SEPARATOR);
  const english = parts[parts.length - 1].trim();
  for (const [pattern, kind] of HEADING_KINDS) if (pattern.test(english)) return kind;
  const colon = title.lastIndexOf(': ');
  if (colon !== -1) {
    const suffix = title.slice(colon + 2).replace(PRIVATE_MEMBERS, '').trim();
    for (const [pattern, kind] of SUFFIX_KINDS) if (pattern.test(suffix)) return kind;
  }
  // An English heading with " - " in it ("Financial Resolution No. 8 - General") is not bilingual.
  if (parts.length > 1) for (const [pattern, kind] of HEADING_KINDS) if (pattern.test(title)) return kind;
  return 'other';
}

/** "dail-2026-09-24-dbsect_12" → 12, so units sort in record order within a day. */
function eIdNumber(id: string): number {
  const m = /dbsect_(\d+)$/.exec(id);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

interface Unit {
  id: string;
  date: string;
  title: string;
}

export function groupDebates(sections: SectionInput[], billLinks: Array<{ sectionId: string; billId: string }>): GroupedDebate[] {
  const byId = new Map(sections.map((s) => [s.id, s]));

  // Each stored section's unit: itself at top level; otherwise its top-most ancestor, which
  // is a container id when the parent was not stored.
  const units = new Map<string, Unit>();
  const unitOf = new Map<string, string>();
  for (const s of sections) {
    let node: SectionInput = s;
    const seen = new Set<string>();
    while (node.parentId && byId.has(node.parentId) && !seen.has(node.parentId)) {
      seen.add(node.parentId);
      node = byId.get(node.parentId)!;
    }
    const unit: Unit = node.parentId
      ? { id: node.parentId, date: node.date, title: node.parentTitle ?? 'Untitled' }
      : { id: node.id, date: node.date, title: node.title };
    if (!units.has(unit.id)) units.set(unit.id, unit);
    unitOf.set(s.id, unit.id);
  }

  const ordered = Array.from(units.values()).sort((a, b) => (a.date === b.date ? eIdNumber(a.id) - eIdNumber(b.id) : a.date < b.date ? -1 : 1));
  const debateOfUnit = new Map<string, string>();
  const latestByTitle = new Map<string, { id: string; date: string }>();
  const debates = new Map<string, GroupedDebate>();
  for (const unit of ordered) {
    const title = normaliseTitle(unit.title);
    const latest = latestByTitle.get(title);
    const joins = latest && (isResumed(unit.title) || latest.date === unit.date);
    const id = joins ? latest!.id : unit.id;
    if (!joins) debates.set(id, { id, kind: kindOf(title), title, billId: null, firstDate: unit.date, lastDate: unit.date, sectionIds: [] });
    const debate = debates.get(id)!;
    if (unit.date > debate.lastDate) debate.lastDate = unit.date;
    latestByTitle.set(title, { id, date: unit.date });
    debateOfUnit.set(unit.id, id);
  }

  const order = (a: string, b: string) => {
    const x = byId.get(a)!;
    const y = byId.get(b)!;
    return x.date === y.date ? eIdNumber(a) - eIdNumber(b) : x.date < y.date ? -1 : 1;
  };
  for (const s of [...sections].sort((a, b) => order(a.id, b.id))) debates.get(debateOfUnit.get(unitOf.get(s.id)!)!)!.sectionIds.push(s.id);

  // A bill link can name a stored section or the container a stage sits in.
  const billsOf = new Map<string, string[]>();
  for (const link of billLinks) {
    const debateId = byId.has(link.sectionId) ? debateOfUnit.get(unitOf.get(link.sectionId)!) : debateOfUnit.get(link.sectionId);
    if (debateId) billsOf.set(debateId, [...(billsOf.get(debateId) ?? []), link.billId]);
  }
  for (const [debateId, bills] of Array.from(billsOf)) debates.get(debateId)!.billId = bills.sort()[0];

  return Array.from(debates.values());
}

export interface MoverContext {
  /** bill id → its primary sponsor: a member, or an office such as "Minister for Health". */
  primarySponsors: Map<string, { memberCode: string | null; label: string }>;
  offices: Array<{ title: string; memberCode: string; start: string; end: string | null }>;
  /** section id → the first member to speak in it, not from the chair. */
  firstSpeakers: Map<string, string>;
}

/**
 * Who moved a debate, from the record only:
 * - a bill stage: the bill's primary sponsor, or the one TD who held the sponsoring office
 *   on the debate's first day;
 * - a motion: the first member to speak (the mover opens a motion);
 * - anything else: nobody.
 */
export function moverOf(debate: GroupedDebate, ctx: MoverContext): { memberCode: string; source: DebateMoverSource } | null {
  if (debate.kind === 'bill_stage' && debate.billId) {
    const sponsor = ctx.primarySponsors.get(debate.billId);
    if (!sponsor) return null;
    if (sponsor.memberCode) return { memberCode: sponsor.memberCode, source: 'bill_sponsor' };
    const holders = ctx.offices.filter((o) => o.title === sponsor.label && o.start <= debate.firstDate && (o.end === null || debate.firstDate <= o.end));
    const codes = Array.from(new Set(holders.map((h) => h.memberCode)));
    return codes.length === 1 ? { memberCode: codes[0], source: 'office_holder' } : null;
  }
  if (debate.kind === 'motion') {
    for (const sectionId of debate.sectionIds) {
      const code = ctx.firstSpeakers.get(sectionId);
      if (code) return { memberCode: code, source: 'first_speaker' };
    }
  }
  return null;
}
