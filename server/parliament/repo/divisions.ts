/**
 * Division reads for the ideology area: one division with what is needed to say what it
 * meant, and every vote with its party line. Nothing here writes.
 *
 * A division's place among its section's speeches is not stored yet, so `sectionPosition`
 * is always NULL and `speeches` is the whole section.
 */
import { and, asc, desc, eq, inArray, lte, ne, sql } from 'drizzle-orm';
import { billDebates, debateSections, debateSpeeches, divisions, divisionVotes, type DivisionVote } from '@shared/schema/parliament';
import { tds } from '@shared/schema/politics';
import type { DivisionSummary } from '@shared/parliamentApi';
import { db, type Db } from '../../db';
import { INDEPENDENT, majorityFor, partyMajorities, type PartyVoteRow } from '../metrics';
import { billDetail } from './bills';

export interface DivisionContext {
  division: DivisionSummary & { debateSectionId: string | null; heldAt: string | null; sectionPosition: number | null };
  /** The debate the speeches come from: the linked section, or the fallback (see divisionContext). */
  section: { id: string; date: string; title: string } | null;
  /** Divisions in the same debate section, in the order they were held. */
  siblings: Array<DivisionSummary & { sectionPosition: number | null }>;
  /** 1-based place of this division among `siblings`. */
  index: number;
  speeches: Array<{ position: number; name: string | null; party: string | null; role: string | null; isPresiding: boolean; text: string }>;
  /** Every bill debated in the linked section: one section can carry several. */
  bills: Array<{ id: string; shortTitle: string; longTitle: string | null; source: string; primarySponsor: { label: string; party: string | null } | null }>;
  /** Now, not at the time of the vote: parties with a minister, and Independent ministers by name. */
  government: { parties: string[]; independents: string[] };
}

export interface DivisionVoteRecord {
  divisionId: string;
  date: string;
  heldAt: string | null;
  tdId: number;
  /** The TD's current party, as every party line here uses. */
  party: string | null;
  vote: DivisionVote;
  /** How most of the TD's party voted. NULL for Independents or a tie. */
  partyMajority: DivisionVote | null;
  /** How the TD's party split between Tá and Níl, the TD included. 0 and 0 for Independents. */
  partyTa: number;
  partyNil: number;
}

/** Fewer member speeches than this and the linked section says too little to read a division by. */
const MIN_MEMBER_SPEECHES = 2;
const GOVERNMENT_OFFICE = /\bminister\b|\btaoiseach\b|\bt[áa]naiste\b/i;

const summaryCols = {
  id: divisions.id,
  date: divisions.date,
  subject: divisions.subject,
  debateTitle: divisions.debateTitle,
  outcome: divisions.outcome,
  isBill: divisions.isBill,
  taCount: divisions.taCount,
  nilCount: divisions.nilCount,
  staonCount: divisions.staonCount,
};

/** The number after the last "_" in an id: `vote_10` → 10, `dbsect_19` → 19. Ids sort as text otherwise. */
const trailingNumber = (column: typeof divisions.id | typeof debateSpeeches.sectionId) => sql`substring(${column} from '_(\\d+)$')::int`;

type SectionRow = { id: string; date: string; title: string };

/** A section and its child sections, with their speeches in order and how many are members'. */
async function sectionSet(section: SectionRow, database: Db) {
  const children = await database.select({ id: debateSections.id }).from(debateSections).where(eq(debateSections.parentId, section.id));
  const speeches = await database
    .select({
      position: debateSpeeches.position,
      name: tds.name,
      party: tds.party,
      role: debateSpeeches.role,
      isPresiding: debateSpeeches.isPresiding,
      text: debateSpeeches.text,
    })
    .from(debateSpeeches)
    .leftJoin(tds, eq(tds.id, debateSpeeches.tdId))
    .where(inArray(debateSpeeches.sectionId, [section.id, ...children.map((c) => c.id)]))
    .orderBy(trailingNumber(debateSpeeches.sectionId), asc(debateSpeeches.position));
  return { section, speeches, memberSpeeches: speeches.filter((s) => !s.isPresiding).length };
}

/**
 * Everything the ideology area needs to read one division. NULL when there is no such division.
 *
 * Speeches come from the linked section and its children. When that section is not ingested
 * or has fewer than two member speeches, they come from the latest section with the
 * division's debate title dated on or before the linked section's date (read from its id,
 * which can be after the division's own date), if there is one.
 */
export async function divisionContext(id: string, database: Db = db): Promise<DivisionContext | null> {
  const [row] = await database
    .select({ ...summaryCols, debateSectionId: divisions.debateSectionId, heldAt: divisions.heldAt })
    .from(divisions)
    .where(eq(divisions.id, id));
  if (!row) return null;
  const { heldAt, debateSectionId: linkedId, ...summary } = row;
  const division = { ...summary, debateSectionId: linkedId, heldAt: heldAt?.toISOString() ?? null, sectionPosition: null };

  const [siblingRows, billRows, officeHolders, [linked]] = await Promise.all([
    linkedId
      ? database
          .select(summaryCols)
          .from(divisions)
          .where(eq(divisions.debateSectionId, linkedId))
          .orderBy(sql`${divisions.heldAt} asc nulls last`, trailingNumber(divisions.id), asc(divisions.id))
      : Promise.resolve([summary]),
    linkedId
      ? database.selectDistinct({ id: billDebates.billId }).from(billDebates).where(eq(billDebates.debateSectionId, linkedId)).orderBy(asc(billDebates.billId))
      : Promise.resolve([]),
    database.select({ name: tds.name, party: tds.party, offices: tds.offices }).from(tds).where(eq(tds.isActive, true)),
    linkedId
      ? database.select({ id: debateSections.id, date: debateSections.date, title: debateSections.title }).from(debateSections).where(eq(debateSections.id, linkedId))
      : Promise.resolve([] as SectionRow[]),
  ]);

  let chosen = linked ? await sectionSet(linked, database) : null;
  if ((!chosen || chosen.memberSpeeches < MIN_MEMBER_SPEECHES) && division.debateTitle) {
    const before = linkedId?.match(/-(\d{4}-\d{2}-\d{2})-/)?.[1] ?? division.date;
    const [fallback] = await database
      .select({ id: debateSections.id, date: debateSections.date, title: debateSections.title })
      .from(debateSections)
      .where(and(eq(debateSections.title, division.debateTitle), lte(debateSections.date, before), linkedId ? ne(debateSections.id, linkedId) : undefined))
      .orderBy(desc(debateSections.date), desc(debateSections.speechCount))
      .limit(1);
    if (fallback) chosen = await sectionSet(fallback, database);
  }

  const bills = (await Promise.all(billRows.map((b) => billDetail(b.id, database)))).flatMap((b) => {
    if (!b) return [];
    const primary = b.sponsorList.find((s) => s.isPrimary);
    return [{ id: b.id, shortTitle: b.shortTitle, longTitle: b.longTitle, source: b.source, primarySponsor: primary ? { label: primary.label, party: primary.party } : null }];
  });

  const ministers = officeHolders.filter((t) => (t.offices ?? []).some((o) => GOVERNMENT_OFFICE.test(o.title.normalize('NFC'))));
  const isIndependent = (party: string | null) => !party || party === INDEPENDENT;
  const government = {
    parties: Array.from(new Set(ministers.filter((m) => !isIndependent(m.party)).map((m) => m.party as string))).sort(),
    independents: ministers.filter((m) => isIndependent(m.party)).map((m) => m.name).sort(),
  };

  const siblings = siblingRows.map((s) => ({ ...s, sectionPosition: null }));
  return {
    division,
    section: chosen ? chosen.section : null,
    siblings,
    index: siblings.findIndex((s) => s.id === id) + 1,
    speeches: chosen ? chosen.speeches : [],
    bills,
    government,
  };
}

/**
 * Every vote linked to a TD, each with its party's line in that division, oldest first.
 * One read; the party counts and majorities are worked out from it, with the same
 * majority rule every other party line in the app uses.
 */
export async function divisionVoteRecords(database: Db = db): Promise<DivisionVoteRecord[]> {
  const rows = await database
    .select({ divisionId: divisions.id, date: divisions.date, heldAt: divisions.heldAt, tdId: tds.id, party: tds.party, vote: divisionVotes.vote })
    .from(divisionVotes)
    .innerJoin(divisions, eq(divisions.id, divisionVotes.divisionId))
    .innerJoin(tds, eq(tds.id, divisionVotes.tdId))
    .orderBy(asc(divisions.date), asc(divisions.id), asc(tds.id));

  const counts = new Map<string, PartyVoteRow>();
  for (const r of rows) {
    if (!r.party || r.party === INDEPENDENT) continue;
    const key = `${r.divisionId}\u0000${r.party}\u0000${r.vote}`;
    const c = counts.get(key) ?? { divisionId: r.divisionId, party: r.party, vote: r.vote, n: 0 };
    c.n++;
    counts.set(key, c);
  }
  const majorities = partyMajorities(Array.from(counts.values()));
  const lobby = (divisionId: string, party: string | null, vote: DivisionVote) =>
    party ? (counts.get(`${divisionId}\u0000${party}\u0000${vote}`)?.n ?? 0) : 0;

  return rows.map((r) => ({
    divisionId: r.divisionId,
    date: r.date,
    heldAt: r.heldAt?.toISOString() ?? null,
    tdId: r.tdId,
    party: r.party,
    vote: r.vote,
    partyMajority: majorityFor(majorities, r.divisionId, r.party),
    partyTa: lobby(r.divisionId, r.party, 'ta'),
    partyNil: lobby(r.divisionId, r.party, 'nil'),
  }));
}
