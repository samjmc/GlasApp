/**
 * Bills: the bill, its sponsors, stages and debates. A bill joins to the Dáil divisions held
 * in its debates through `bill_debates.debate_section_id` = `divisions.debate_section_id`.
 */
import { and, asc, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { billDebates, bills, billSponsors, billStages, divisions } from '@shared/schema/parliament';
import { tds } from '@shared/schema/politics';
import type { BillDetail, BillSummary, TdBill } from '@shared/parliamentApi';
import { db, type Db } from '../../db';
import type { ParsedBill } from '../parse';
import { chunks } from './util';

/** Replace these bills and all their child rows. Idempotent. */
export async function replaceBills(parsed: ParsedBill[], tdIds: Map<string, number>, database: Db = db): Promise<void> {
  if (parsed.length === 0) return;
  const ids = parsed.map((p) => p.bill.id);
  await database.transaction(async (tx) => {
    for (const batch of chunks(parsed.map((p) => p.bill))) {
      await tx
        .insert(bills)
        .values(batch)
        .onConflictDoUpdate({
          target: bills.id,
          set: {
            uri: sql`excluded.uri`,
            shortTitle: sql`excluded.short_title`,
            longTitle: sql`excluded.long_title`,
            source: sql`excluded.source`,
            status: sql`excluded.status`,
            originHouse: sql`excluded.origin_house`,
            mostRecentStage: sql`excluded.most_recent_stage`,
            act: sql`excluded.act`,
            latestVersionPdf: sql`excluded.latest_version_pdf`,
            memoPdf: sql`excluded.memo_pdf`,
            lastUpdated: sql`excluded.last_updated`,
          },
        });
    }
    for (const batch of chunks(ids)) {
      await tx.delete(billSponsors).where(inArray(billSponsors.billId, batch));
      await tx.delete(billStages).where(inArray(billStages.billId, batch));
      await tx.delete(billDebates).where(inArray(billDebates.billId, batch));
    }
    const sponsors = parsed.flatMap((p) => p.sponsors.map((s) => ({ ...s, tdId: s.memberCode ? (tdIds.get(s.memberCode) ?? null) : null })));
    for (const batch of chunks(sponsors)) await tx.insert(billSponsors).values(batch);
    for (const batch of chunks(parsed.flatMap((p) => p.stages))) await tx.insert(billStages).values(batch);
    for (const batch of chunks(parsed.flatMap((p) => p.debates))) await tx.insert(billDebates).values(batch);
  });
}

/** Sponsor labels per bill, primary sponsor first. */
async function sponsorLabels(ids: string[], database: Db): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (ids.length === 0) return out;
  const rows = await database
    .select({ billId: billSponsors.billId, label: billSponsors.label })
    .from(billSponsors)
    .where(inArray(billSponsors.billId, ids))
    .orderBy(desc(billSponsors.isPrimary), asc(billSponsors.position));
  for (const r of rows) out.set(r.billId, [...(out.get(r.billId) ?? []), r.label]);
  return out;
}

const summaryCols = {
  id: bills.id,
  shortTitle: bills.shortTitle,
  source: bills.source,
  status: bills.status,
  mostRecentStage: bills.mostRecentStage,
  act: bills.act,
  lastUpdated: bills.lastUpdated,
};

export async function listBills(
  filters: { status?: string; source?: string },
  limit: number,
  offset: number,
  database: Db = db,
): Promise<{ rows: BillSummary[]; total: number }> {
  const where: SQL | undefined = and(
    filters.status ? eq(bills.status, filters.status) : undefined,
    filters.source ? eq(bills.source, filters.source) : undefined,
  );
  const [rows, [{ n }]] = await Promise.all([
    database
      .select(summaryCols)
      .from(bills)
      .where(where)
      .orderBy(sql`${bills.lastUpdated} desc nulls last`, desc(bills.billYear), desc(bills.billNo))
      .limit(limit)
      .offset(offset),
    database.select({ n: count() }).from(bills).where(where),
  ]);
  const labels = await sponsorLabels(rows.map((r) => r.id), database);
  return { rows: rows.map((r) => ({ ...r, sponsors: labels.get(r.id) ?? [] })), total: Number(n) };
}

export async function tdBills(tdId: number, limit: number, database: Db = db): Promise<TdBill[]> {
  const rows = await database
    .select({ ...summaryCols, isPrimary: sql<boolean>`bool_or(${billSponsors.isPrimary})` })
    .from(billSponsors)
    .innerJoin(bills, eq(bills.id, billSponsors.billId))
    .where(eq(billSponsors.tdId, tdId))
    .groupBy(bills.id)
    .orderBy(sql`${bills.lastUpdated} desc nulls last`, desc(bills.billYear), desc(bills.billNo))
    .limit(limit);
  const labels = await sponsorLabels(rows.map((r) => r.id), database);
  return rows.map((r) => ({ ...r, isPrimary: Boolean(r.isPrimary), sponsors: labels.get(r.id) ?? [] }));
}

export async function countBillsSponsored(tdId: number, database: Db = db): Promise<number> {
  const [{ n }] = await database
    .select({ n: sql<number>`count(distinct ${billSponsors.billId})::int` })
    .from(billSponsors)
    .where(eq(billSponsors.tdId, tdId));
  return Number(n);
}

export async function billDetail(id: string, database: Db = db): Promise<BillDetail | null> {
  const [bill] = await database.select().from(bills).where(eq(bills.id, id));
  if (!bill) return null;
  const [sponsorRows, stages, debates] = await Promise.all([
    database
      .select({
        label: billSponsors.label,
        memberCode: billSponsors.memberCode,
        tdId: billSponsors.tdId,
        name: tds.name,
        party: tds.party,
        isPrimary: billSponsors.isPrimary,
      })
      .from(billSponsors)
      .leftJoin(tds, eq(tds.id, billSponsors.tdId))
      .where(eq(billSponsors.billId, id))
      .orderBy(desc(billSponsors.isPrimary), asc(billSponsors.position)),
    database
      .select({ stage: billStages.stage, chamber: billStages.chamber, date: billStages.date })
      .from(billStages)
      .where(eq(billStages.billId, id))
      .orderBy(asc(billStages.position)),
    database
      .select({ debateSectionId: billDebates.debateSectionId, date: billDebates.date, chamber: billDebates.chamber, title: billDebates.title })
      .from(billDebates)
      .where(eq(billDebates.billId, id))
      .orderBy(asc(billDebates.date)),
  ]);
  const sectionIds = debates.map((d) => d.debateSectionId);
  const votes = sectionIds.length
    ? await database
        .select({
          id: divisions.id,
          date: divisions.date,
          subject: divisions.subject,
          debateTitle: divisions.debateTitle,
          outcome: divisions.outcome,
          isBill: divisions.isBill,
          taCount: divisions.taCount,
          nilCount: divisions.nilCount,
          staonCount: divisions.staonCount,
        })
        .from(divisions)
        .where(inArray(divisions.debateSectionId, sectionIds))
        .orderBy(asc(divisions.date), asc(divisions.heldAt), asc(divisions.id))
    : [];
  return {
    id: bill.id,
    uri: bill.uri,
    shortTitle: bill.shortTitle,
    longTitle: bill.longTitle,
    source: bill.source,
    status: bill.status,
    originHouse: bill.originHouse,
    mostRecentStage: bill.mostRecentStage,
    act: bill.act,
    lastUpdated: bill.lastUpdated,
    latestVersionPdf: bill.latestVersionPdf,
    memoPdf: bill.memoPdf,
    sponsors: sponsorRows.map((s) => s.label),
    sponsorList: sponsorRows,
    stages,
    debates,
    divisions: votes,
  };
}
