/**
 * Division reads for the ideology area: one division with what is needed to say what it
 * meant, and every vote with its party line. The one write is a division's place among its
 * section's speeches (`sectionPosition`), which the debates feed sets from the transcript.
 */
import { and, asc, desc, eq, inArray, like, lte, ne, sql } from 'drizzle-orm';
import { billDebates, debateSections, debateSpeeches, divisions, divisionVotes, type DivisionVote } from '@shared/schema/parliament';
import { tds } from '@shared/schema/politics';
import type { DivisionSummary } from '@shared/parliamentApi';
import { db, type Db } from '../../db';
import { INDEPENDENT, majorityFor, partyMajorities, type PartyVoteRow } from '../metrics';
import { sectionId, type DivisionMarker } from '../parse';
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

/** A division as divisionContext and listDivisionRefs describe it. */
export type DivisionRef = DivisionContext['division'];

const refCols = { ...summaryCols, debateSectionId: divisions.debateSectionId, heldAt: divisions.heldAt, sectionPosition: divisions.sectionPosition };
const toRef = ({ heldAt, ...row }: { heldAt: Date | null } & Omit<DivisionRef, 'heldAt'>): DivisionRef => ({ ...row, heldAt: heldAt?.toISOString() ?? null });

/** The number after the last "_" in an id: `vote_10` → 10, `dbsect_19` → 19. Ids sort as text otherwise. */
const trailingNumber = (column: typeof divisions.id | typeof debateSpeeches.sectionId) => sql`substring(${column} from '_(\\d+)$')::int`;

type SectionRow = { id: string; date: string; title: string };

/** A section and its child sections, with their speeches in order and how many are members'. */
async function sectionSet(section: SectionRow, database: Db) {
  const children = await database.select({ id: debateSections.id }).from(debateSections).where(eq(debateSections.parentId, section.id));
  const speeches = await database
    .select({
      sectionId: debateSpeeches.sectionId,
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
 * A placed division reads only its own section's speeches since the previous placed
 * division there (or the start): the debate on the question it put. Otherwise all of them.
 */
function speechesFor(
  chosen: Awaited<ReturnType<typeof sectionSet>>,
  division: Pick<DivisionRef, 'debateSectionId' | 'sectionPosition'>,
  siblings: Array<{ sectionPosition: number | null }>,
) {
  const at = division.sectionPosition;
  if (at === null || chosen.section.id !== division.debateSectionId) return chosen.speeches;
  const from = Math.max(0, ...siblings.map((s) => s.sectionPosition ?? -1).filter((p) => p < at));
  return chosen.speeches.filter((s) => s.sectionId === division.debateSectionId && s.position >= from && s.position < at);
}

/**
 * Everything the ideology area needs to read one division. NULL when there is no such division.
 *
 * Speeches come from the linked section and its children. When that section is not ingested
 * or has fewer than two member speeches, they come from the latest section with the
 * division's debate title dated on or before the linked section's date (read from its id,
 * which can be after the division's own date), if there is one. A division placed in its
 * linked section (`sectionPosition`) gets only the speeches that led up to it.
 */
export async function divisionContext(id: string, database: Db = db): Promise<DivisionContext | null> {
  const [row] = await database.select(refCols).from(divisions).where(eq(divisions.id, id));
  if (!row) return null;
  const division = toRef(row);
  const { debateSectionId: linkedId, sectionPosition, heldAt: _heldAt, ...summary } = division;

  const [siblings, billRows, [linked]] = await Promise.all([
    linkedId
      ? database
          .select({ ...summaryCols, sectionPosition: divisions.sectionPosition })
          .from(divisions)
          .where(eq(divisions.debateSectionId, linkedId))
          .orderBy(sql`${divisions.heldAt} asc nulls last`, trailingNumber(divisions.id), asc(divisions.id))
      : Promise.resolve([{ ...summary, sectionPosition }]),
    linkedId
      ? database.selectDistinct({ id: billDebates.billId }).from(billDebates).where(eq(billDebates.debateSectionId, linkedId)).orderBy(asc(billDebates.billId))
      : Promise.resolve([]),
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

  const speeches = chosen ? speechesFor(chosen, division, siblings) : [];
  return {
    division,
    section: chosen ? chosen.section : null,
    siblings,
    index: siblings.findIndex((s) => s.id === id) + 1,
    speeches: speeches.map(({ sectionId: _sectionId, ...speech }) => speech),
    bills,
  };
}

/** The division's page on oireachtas.ie, from its id; NULL for an id of another shape. */
export function oireachtasVoteUrl(divisionId: string): string | null {
  const m = divisionId.match(/^dail-(\d+)-(\d{4}-\d{2}-\d{2})-vote_(\d+)$/);
  return m ? `https://www.oireachtas.ie/en/debates/vote/dail/${m[1]}/${m[2]}/${m[3]}/` : null;
}

/** Every division as divisionContext describes it, newest first. One read. */
export async function listDivisionRefs(database: Db = db): Promise<DivisionRef[]> {
  const rows = await database.select(refCols).from(divisions).orderBy(desc(divisions.date), desc(trailingNumber(divisions.id)), desc(divisions.id));
  return rows.map(toRef);
}

/**
 * Place one sitting day's divisions among their sections' speeches from the day's transcript
 * markers, matched on section and Tá/Níl counts. Only a one-to-one match is placed: two
 * markers, or two divisions, in a section with the same counts place neither. Every other
 * division of the day goes back to NULL ("not located"). Returns how many were placed.
 */
export async function setDivisionPositions(date: string, markers: DivisionMarker[], database: Db = db): Promise<number> {
  const key = (section: string | null, ta: number, nil: number) => `${section}\u0000${ta}\u0000${nil}`;
  const ofDay = like(divisions.debateSectionId, sectionId(date, '%'));
  return database.transaction(async (tx) => {
    await tx.update(divisions).set({ sectionPosition: null }).where(ofDay);
    const rows = await tx.select({ id: divisions.id, section: divisions.debateSectionId, ta: divisions.taCount, nil: divisions.nilCount }).from(divisions).where(ofDay);
    const divisionsAt = new Map<string, string[]>();
    for (const r of rows) divisionsAt.set(key(r.section, r.ta, r.nil), [...(divisionsAt.get(key(r.section, r.ta, r.nil)) ?? []), r.id]);
    const markersAt = new Map<string, number>();
    for (const m of markers) markersAt.set(key(m.sectionId, m.ta, m.nil), (markersAt.get(key(m.sectionId, m.ta, m.nil)) ?? 0) + 1);
    let placed = 0;
    for (const m of markers) {
      const k = key(m.sectionId, m.ta, m.nil);
      const ids = divisionsAt.get(k) ?? [];
      if (markersAt.get(k) !== 1 || ids.length !== 1) continue;
      await tx.update(divisions).set({ sectionPosition: m.afterPosition }).where(eq(divisions.id, ids[0]));
      placed++;
    }
    return placed;
  });
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
