/**
 * Pure parsers: Oireachtas division JSON and Akoma Ntoso debate XML → table rows.
 * No I/O. Tested against real API samples in __fixtures__.
 */
import { load } from 'cheerio';
import type { DivisionVote, NewDebateSection, NewDivision } from '@shared/schema/parliament';

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

  const members = new Map<string, string>();
  $('TLCPerson').each((_, el) => {
    const eId = $(el).attr('eId');
    const code = $(el).attr('href')?.match(MEMBER_HREF)?.[1];
    if (eId && code) members.set(eId, safeDecode(code).normalize('NFC'));
  });
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
