/**
 * Pure parsers: Oireachtas JSON (divisions, bills, questions) and Akoma Ntoso XML (debate
 * and committee transcripts) → table rows. No I/O. Tested against real API samples in
 * __fixtures__.
 */
import { load } from 'cheerio';
import type {
  DivisionVote,
  NewBill,
  NewBillDebate,
  NewBillSponsor,
  NewBillStage,
  NewDebateSection,
  NewDivision,
  QuestionType,
} from '@shared/schema/parliament';

// ---------------------------------------------------------------------------
// Divisions
// ---------------------------------------------------------------------------
interface RawTally {
  tally?: number;
  members?: Array<{ member?: { memberCode?: string } }> | null;
}

/** The fields of `/divisions` results that are read. */
export interface RawDivision {
  uri?: string;
  voteId?: string;
  date?: string;
  datetime?: string;
  subject?: { showAs?: string | null } | null;
  outcome?: string | null;
  isBill?: boolean;
  debate?: { showAs?: string | null; debateSection?: string | null; uri?: string | null } | null;
  house?: { houseCode?: string; houseNo?: string } | null;
  tallies?: { taVotes?: RawTally | null; nilVotes?: RawTally | null; staonVotes?: RawTally | null } | null;
}

export interface ParsedDivision {
  division: NewDivision;
  votes: Array<{ memberCode: string; vote: DivisionVote }>;
}

const TALLIES: Array<[DivisionVote, 'taVotes' | 'nilVotes' | 'staonVotes']> = [
  ['ta', 'taVotes'],
  ['nil', 'nilVotes'],
  ['staon', 'staonVotes'],
];

export function divisionId(houseNo: number, date: string, voteId: string): string {
  return `dail-${houseNo}-${date}-${voteId}`;
}

export function sectionId(date: string, eId: string): string {
  return `dail-${date}-${eId}`;
}

/** NULL when the record lacks what an id needs; a division is never guessed at. */
export function parseDivision(raw: RawDivision): ParsedDivision | null {
  const houseNo = Number(raw.house?.houseNo);
  if (!raw.uri || !raw.voteId || !raw.date || !Number.isInteger(houseNo) || raw.house?.houseCode !== 'dail') return null;

  const votes: ParsedDivision['votes'] = [];
  const seen = new Set<string>();
  const counts: Record<DivisionVote, number> = { ta: 0, nil: 0, staon: 0 };
  for (const [vote, key] of TALLIES) {
    const tally = raw.tallies?.[key];
    const members = tally?.members ?? [];
    for (const m of members) {
      const code = m.member?.memberCode;
      if (!code || seen.has(code)) continue;
      seen.add(code);
      votes.push({ memberCode: code, vote });
    }
    counts[vote] = typeof tally?.tally === 'number' ? tally.tally : members.length;
  }

  // The division sits inside a debate section of the same day's transcript.
  const debateDate = raw.debate?.uri?.match(/\/(\d{4}-\d{2}-\d{2})\//)?.[1] ?? raw.date;

  return {
    division: {
      id: divisionId(houseNo, raw.date, raw.voteId),
      uri: raw.uri,
      houseNo,
      date: raw.date,
      heldAt: raw.datetime ? new Date(raw.datetime) : null,
      subject: cleanSubject(raw.subject?.showAs),
      outcome: cleanOutcome(raw.outcome),
      debateTitle: raw.debate?.showAs || null,
      debateSectionId: raw.debate?.debateSection ? sectionId(debateDate, raw.debate.debateSection) : null,
      isBill: raw.isBill === true,
      taCount: counts.ta,
      nilCount: counts.nil,
      staonCount: counts.staon,
    },
    votes,
  };
}

/**
 * "Carried" / "Lost" as reported. A few records carry a placeholder such as "_" (6 of the
 * 34th Dáil's first 413); that is "not recorded", so NULL rather than a made-up result.
 */
function cleanOutcome(outcome: string | null | undefined): string | null {
  const o = outcome?.trim();
  return o && /[a-z]/i.test(o) ? o : null;
}

/** "Amendment put: " → "Amendment put". Empty → NULL. */
function cleanSubject(subject: string | null | undefined): string | null {
  const s = subject?.trim().replace(/:$/, '').trim();
  return s ? s : null;
}

// ---------------------------------------------------------------------------
// Debate transcripts (Akoma Ntoso)
// ---------------------------------------------------------------------------
/** Roles spoken from the chair. Compared against the transcript's own role names. */
export const PRESIDING_ROLES = ['Ceann Comhairle', 'Leas-Cheann Comhairle', 'Cathaoirleach Gníomhach', 'Acting Chairman'] as const;

export interface ParsedSpeech {
  id: string;
  sectionId: string;
  date: string;
  position: number;
  memberCode: string | null;
  role: string | null;
  isPresiding: boolean;
  text: string;
  wordCount: number;
}

export interface ParsedTranscript {
  sections: NewDebateSection[];
  speeches: ParsedSpeech[];
}

const MEMBER_HREF = /\/member\/id\/(.+)$/;

export function isPresidingRole(role: string | null): boolean {
  if (!role) return false;
  const r = role.normalize('NFC').trim().replace(/[:.]+$/, '').toLowerCase();
  return PRESIDING_ROLES.some((p) => r === p.toLowerCase() || r === `an ${p.toLowerCase()}`);
}

/**
 * The speaker label in `<from>`, without its timestamp child or "(Deputy …)" suffix.
 * The Ceann Comhairle's speeches carry no `as` role at all; this label is the only mark.
 */
function speakerLabel(from: string): string {
  return from.replace(/\(.*\)\s*$/, '').trim();
}

/** hrefs are usually raw UTF-8 ("Aengus-Ó-Snodaigh"); a stray '%' must not fail the whole day. */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/**
 * One sitting day's transcript → its sections and speeches. Sections with no speeches
 * (headings, containers) are dropped; a nested section keeps its parent's id.
 */
export function parseTranscript(xml: string, date: string): ParsedTranscript {
  const $ = load(xml, { xml: true });

  const members = memberRefs($);
  const roles = new Map<string, string>();
  $('TLCRole').each((_, el) => {
    const eId = $(el).attr('eId');
    const name = $(el).attr('showAs');
    if (eId && name) roles.set(eId, name.normalize('NFC'));
  });

  const sections: NewDebateSection[] = [];
  const speeches: ParsedSpeech[] = [];

  $('debateSection').each((_, el) => {
    const section = $(el);
    const eId = section.attr('eId');
    if (!eId) return;
    const id = sectionId(date, eId);

    const own = section.find('speech').filter((_, s) => $(s).closest('debateSection').attr('eId') === eId);
    const rows: ParsedSpeech[] = [];
    own.each((_, s) => {
      const speech = $(s);
      const text = speech
        .children('p')
        .map((_, p) => $(p).text().trim())
        .get()
        .filter(Boolean)
        .join('\n\n');
      if (!text) return;
      const from = speech.children('from').first().clone();
      from.children().remove();
      const label = speakerLabel(from.text());
      const role = roles.get((speech.attr('as') ?? '').replace(/^#/, '')) ?? (isPresidingRole(label) ? label : null);
      rows.push({
        id: `${id}/${speech.attr('eId') ?? `pos_${rows.length}`}`,
        sectionId: id,
        date,
        position: rows.length,
        memberCode: members.get((speech.attr('by') ?? '').replace(/^#/, '')) ?? null,
        role,
        isPresiding: isPresidingRole(role),
        text,
        wordCount: countWords(text),
      });
    });
    if (rows.length === 0) return;

    const parentEId = section.parents('debateSection').first().attr('eId');
    sections.push({
      id,
      date,
      title: section.children('heading').first().text().trim() || section.attr('name') || 'Untitled',
      parentId: parentEId ? sectionId(date, parentEId) : null,
      speechCount: rows.length,
    });
    speeches.push(...rows);
  });

  return { sections, speeches };
}

/** A transcript's `TLCPerson` references: eId → member code. */
function memberRefs($: ReturnType<typeof load>): Map<string, string> {
  const members = new Map<string, string>();
  $('TLCPerson').each((_, el) => {
    const eId = $(el).attr('eId');
    const code = $(el).attr('href')?.match(MEMBER_HREF)?.[1];
    if (eId && code) members.set(eId, safeDecode(code).normalize('NFC'));
  });
  return members;
}

// ---------------------------------------------------------------------------
// Committee transcripts: only the roll call ("MEMBERS PRESENT") is read.
// ---------------------------------------------------------------------------
export interface RollCall {
  /** Member codes resolved through the transcript's own `TLCPerson` references. */
  codes: string[];
  /**
   * Names of people on the roll call with no `TLCPerson` entry (measured: 103 in June 2026,
   * 55 of them TDs). The caller resolves them against the roster by name.
   */
  unlinkedNames: string[];
}

/** A committee sitting's roll call, deduplicated, in transcript order. */
export function parseRollCall(xml: string): RollCall {
  const $ = load(xml, { xml: true });
  const members = memberRefs($);
  const codes: string[] = [];
  const unlinkedNames: string[] = [];
  $('rollCall person').each((_, el) => {
    const code = members.get(($(el).attr('refersTo') ?? '').replace(/^#/, ''));
    if (code) {
      if (!codes.includes(code)) codes.push(code);
      return;
    }
    const name = $(el).text().replace(/\s+/g, ' ').trim();
    if (name && !unlinkedNames.includes(name)) unlinkedNames.push(name);
  });
  return { codes, unlinkedNames };
}

// "minister of state" before "minister": the first alternative that matches wins.
const HONORIFIC = /^(deputy|teachta|td|senator|seanadoir|an|dr|minister of state|minister)\s+/;

/** "Deputy Seán Ó Fearghaíl" and "Seán Ó Fearghaíl" → "sean o fearghail". */
export function normaliseName(name: string): string {
  let n = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  while (HONORIFIC.test(n)) n = n.replace(HONORIFIC, '');
  return n;
}

/**
 * Resolve roll-call names that had no member reference against the roster, by name. A name
 * shared by two members stays unresolved rather than being given to either. Returns the
 * resolved codes and how many unresolved names could belong to a TD (anyone not titled
 * "Senator"): a sitting with any of those cannot say who was absent.
 */
export function resolveRollCallNames(
  names: string[],
  roster: Array<{ fullName: string; memberCode: string }>,
): { codes: string[]; unresolvedTds: number } {
  const byName = new Map<string, string | null>();
  for (const m of roster) {
    const key = normaliseName(m.fullName);
    byName.set(key, byName.has(key) && byName.get(key) !== m.memberCode ? null : m.memberCode);
  }
  const codes: string[] = [];
  let unresolvedTds = 0;
  for (const name of names) {
    const code = byName.get(normaliseName(name));
    if (code) {
      if (!codes.includes(code)) codes.push(code);
    } else if (!/^\s*senator\b/i.test(name)) {
      unresolvedTds++;
    }
  }
  return { codes, unresolvedTds };
}

/** Last path segment of an Oireachtas URI: ".../committee/dail/34/committee_of_public_accounts" → "committee_of_public_accounts". */
export function uriTail(uri: string): string {
  return uri.replace(/\/+$/, '').split('/').pop() ?? uri;
}

/** "2025-05-07 00:00:00+00:00" or "2025-05-07" → "2025-05-07". NULL for anything else. */
export function isoDay(value: string | null | undefined): string | null {
  const m = value?.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Bills (/legislation)
// ---------------------------------------------------------------------------
interface RawEvent {
  showAs?: string | null;
  dates?: Array<{ date?: string | null }> | null;
  chamber?: { showAs?: string | null } | null;
}

/** The fields of `/legislation` results that are read. */
export interface RawBill {
  uri?: string;
  billNo?: string | number;
  billYear?: string | number;
  shortTitleEn?: string | null;
  longTitleEn?: string | null;
  source?: string | null;
  status?: string | null;
  originHouse?: { showAs?: string | null } | null;
  mostRecentStage?: { event?: RawEvent | null } | null;
  lastUpdated?: string | null;
  act?: { actNo?: string | null; actYear?: string | null } | null;
  sponsors?: Array<{ sponsor?: { isPrimary?: boolean; as?: { showAs?: string | null } | null; by?: { showAs?: string | null; uri?: string | null } | null } }> | null;
  stages?: Array<{ event?: RawEvent | null }> | null;
  debates?: Array<{ date?: string | null; debateSectionId?: string | null; showAs?: string | null; chamber?: { showAs?: string | null; uri?: string | null } | null; uri?: string | null }> | null;
  versions?: Array<{ version?: { date?: string | null; formats?: { pdf?: { uri?: string | null } | null } | null } | null }> | null;
  relatedDocs?: Array<{ relatedDoc?: { docType?: string | null; formats?: { pdf?: { uri?: string | null } | null } | null } | null }> | null;
}

export interface ParsedBill {
  bill: NewBill;
  sponsors: Array<Omit<NewBillSponsor, 'tdId'>>;
  stages: NewBillStage[];
  debates: NewBillDebate[];
}

/** A long title's HTML ("<p>An Act to …&nbsp;</p>") as plain text, entities decoded. */
function plainText(html: string | null | undefined): string | null {
  if (!html) return null;
  const t = load(html).root().text().replace(/\s+/g, ' ').trim();
  return t ? t : null;
}

/**
 * Where a bill's debate took place, for its section id: "dail", "seanad", or
 * "committee-<code>". Read from the debate record URI (".../debateRecord/<house>/<date>/…"),
 * because a committee stage's chamber is ".../def/committee" and treating it as the Dáil
 * joined it to unrelated plenary votes on the same day.
 */
function debateHouse(debate: { uri?: string | null; chamber?: { showAs?: string | null; uri?: string | null } | null }): string {
  const seg = debate.uri?.match(/\/debateRecord\/([^/]+)\//)?.[1];
  if (seg) return seg === 'dail' || seg === 'seanad' ? seg : `committee-${seg}`;
  const chamber = `${debate.chamber?.uri ?? ''} ${debate.chamber?.showAs ?? ''}`;
  if (/\/def\/house\/dail|^\s*Dáil/i.test(chamber)) return 'dail';
  if (/seanad/i.test(chamber)) return 'seanad';
  return 'committee';
}

/** NULL when the record lacks its number or year; a bill is never guessed at. */
export function parseBill(raw: RawBill): ParsedBill | null {
  const billNo = Number(raw.billNo);
  const billYear = Number(raw.billYear);
  if (!raw.uri || !Number.isInteger(billNo) || !Number.isInteger(billYear) || !raw.shortTitleEn) return null;
  const id = `${billYear}-${billNo}`;

  // Versions and documents arrive newest first; take the newest with a PDF.
  const latestVersionPdf =
    [...(raw.versions ?? [])].sort((a, b) => (b.version?.date ?? '').localeCompare(a.version?.date ?? ''))
      .map((v) => v.version?.formats?.pdf?.uri)
      .find(Boolean) ?? null;
  const memoPdf = (raw.relatedDocs ?? []).find((d) => d.relatedDoc?.docType === 'memo')?.relatedDoc?.formats?.pdf?.uri ?? null;

  const sponsors = (raw.sponsors ?? []).flatMap((s, position) => {
    const by = s.sponsor?.by;
    const code = by?.uri?.match(MEMBER_HREF)?.[1];
    const label = by?.showAs || s.sponsor?.as?.showAs;
    if (!label) return [];
    return [{ billId: id, position, memberCode: code ? safeDecode(code).normalize('NFC') : null, label, isPrimary: s.sponsor?.isPrimary === true }];
  });

  const stages = (raw.stages ?? []).flatMap((s, position) => {
    const e = s.event;
    if (!e?.showAs) return [];
    return [{ billId: id, position, stage: e.showAs, chamber: e.chamber?.showAs ?? null, date: isoDay(e.dates?.[0]?.date) }];
  });

  const seen = new Set<string>();
  const debates = (raw.debates ?? []).flatMap((d) => {
    const date = isoDay(d.date);
    if (!date || !d.debateSectionId) return [];
    const debateSectionId = `${debateHouse(d)}-${date}-${d.debateSectionId}`;
    if (seen.has(debateSectionId)) return [];
    seen.add(debateSectionId);
    return [{ billId: id, debateSectionId, date, chamber: d.chamber?.showAs ?? null, title: d.showAs ?? null }];
  });

  return {
    bill: {
      id,
      uri: raw.uri,
      billNo,
      billYear,
      shortTitle: raw.shortTitleEn.trim(),
      longTitle: plainText(raw.longTitleEn),
      source: raw.source || 'Unknown',
      status: raw.status || 'Unknown',
      originHouse: raw.originHouse?.showAs ?? null,
      mostRecentStage: raw.mostRecentStage?.event?.showAs ?? null,
      act: raw.act?.actNo && raw.act?.actYear ? `${raw.act.actNo}/${raw.act.actYear}` : null,
      latestVersionPdf,
      memoPdf,
      lastUpdated: isoDay(raw.lastUpdated),
    },
    sponsors,
    stages,
    debates,
  };
}

// ---------------------------------------------------------------------------
// Questions (/questions): counted, not stored.
// ---------------------------------------------------------------------------
export interface RawQuestion {
  date?: string | null;
  questionType?: string | null;
  by?: { memberCode?: string | null } | null;
  to?: { showAs?: string | null } | null;
}

export interface QuestionCountRow {
  memberCode: string;
  month: string;
  department: string;
  questionType: QuestionType;
  n: number;
}

/** Group questions by asker, month, department and type. Questions missing any of those are skipped. */
export function countQuestions(raws: RawQuestion[]): QuestionCountRow[] {
  const counts = new Map<string, QuestionCountRow>();
  for (const q of raws) {
    const day = isoDay(q.date);
    const code = q.by?.memberCode?.normalize('NFC');
    const department = q.to?.showAs?.trim();
    const type = q.questionType === 'oral' || q.questionType === 'written' ? q.questionType : null;
    if (!day || !code || !department || !type) continue;
    const month = `${day.slice(0, 7)}-01`;
    const key = `${code}\u0000${month}\u0000${department}\u0000${type}`;
    const row = counts.get(key) ?? { memberCode: code, month, department, questionType: type, n: 0 };
    row.n++;
    counts.set(key, row);
  }
  return Array.from(counts.values());
}
